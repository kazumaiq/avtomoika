import { create } from 'zustand';
import { soundEngine } from '../audio/soundEngine';
import {
  createStarterWorker,
  generateHireCandidates,
  getRaiseAmount,
  getTrainingCost,
} from '../config/staff';
import {
  AD_CAMPAIGNS,
  UPGRADE_DEFINITIONS,
  getUpgradeCost,
  getUtilityDiscount,
} from '../config/upgrades';
import { gameSimulation } from '../engine/simulation';
import {
  clearSavedGame,
  hasSavedGame,
  loadGameSync,
  saveGameSync,
} from '../persistence/saveManager';
import type {
  ActivePanel,
  AdCampaignId,
  CameraPreset,
  CompetitorState,
  EconomyMetrics,
  GameSettings,
  HireCandidate,
  SelectionTarget,
  UpgradeKey,
  UpgradeLevels,
  WorkerProfile,
} from '../types/game';

interface GameStoreState {
  started: boolean;
  hasSave: boolean;
  lastSavedAt: number | null;
  paused: boolean;
  simSpeed: 1 | 2;
  day: number;
  /** 0..1 where 0.25=morning, 0.5=midday, 0.72=Spider-Verse golden sunset, 0.92=neon night */
  timeOfDay: number;
  elapsedMinutes: number;
  activePanel: ActivePanel;
  cameraPreset: CameraPreset;
  cameraPresetSeq: number;
  selection: SelectionTarget | null;
  followSelected: boolean;
  entityVersion: number;

  economy: EconomyMetrics;
  upgrades: UpgradeLevels;
  workers: WorkerProfile[];
  candidates: HireCandidate[];
  competitor: CompetitorState;
  settings: GameSettings;

  // Actions
  startNewGame: () => void;
  continueSavedGame: () => void;
  returnToTitle: () => void;
  togglePause: () => void;
  setSimSpeed: (speed: 1 | 2) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelection: (target: SelectionTarget | null, follow?: boolean) => void;
  toggleFollowSelected: () => void;

  // Business actions
  setWashPrice: (price: number) => void;
  setAdCampaign: (id: AdCampaignId) => void;
  buyUpgrade: (key: UpgradeKey) => boolean;

  // Staff actions
  hireCandidate: (candidateId: string) => boolean;
  fireWorker: (workerId: string) => boolean;
  trainWorker: (workerId: string) => boolean;
  giveWorkerRaise: (workerId: string) => boolean;
  assignWorkerBay: (workerId: string, bayIndex: number) => void;
  refreshCandidates: () => void;

  // Settings & Persistence
  updateSettings: (patch: Partial<GameSettings>) => void;
  saveNow: () => void;
  resetProgress: () => void;

  // Internal sim hooks
  _bindSimulation: () => void;
}

function createInitialEconomy(): EconomyMetrics {
  return {
    balance: 1200,
    totalRevenue: 0,
    totalExpenses: 0,
    incomePerMin: 0,
    expensesPerMin: 25,
    profitPerMin: -25,
    carsWashed: 0,
    carsLost: 0,
    reputation: 3.5,
    washPrice: 26,
    adCampaign: 'none',
    history: [{ minute: 0, playerRev: 0, compRev: 0, balance: 1200 }],
  };
}

function createInitialUpgrades(): UpgradeLevels {
  return {
    bays: 1,
    pressureWasher: 1,
    foamSystem: 1,
    dryerWax: 1,
    ecoSolar: 1,
    vipLounge: 1,
    queueLot: 1,
  };
}

function createInitialCompetitor(): CompetitorState {
  return {
    name: 'TURBO SHINE',
    bays: 2,
    price: 28,
    quality: 2.35,
    speedMultiplier: 1.02,
    reputation: 3.4,
    carsWashed: 0,
    totalRevenue: 0,
    revenuePerMin: 0,
    promoActive: false,
    promoTimer: 48,
    lastUpgradeDay: 1,
  };
}

function detectDefaultQuality(): GameSettings['quality'] {
  if (typeof window === 'undefined') return 'high';
  const isSmall = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isSmall || cores <= 4) return 'medium';
  return 'high';
}

function createInitialSettings(): GameSettings {
  return {
    quality: detectDefaultQuality(),
    timeMode: 'cycle',
    sfxVolume: 0.65,
    musicVolume: 0.32,
    muted: false,
    showPopups: true,
  };
}

function computeEstimatedExpensesPerMin(
  workers: WorkerProfile[],
  upgrades: UpgradeLevels,
  adCampaign: AdCampaignId
): number {
  const salaries = workers.reduce((s, w) => s + w.salaryPerMin, 0);
  const ads = AD_CAMPAIGNS[adCampaign].costPerMin;
  const utility = Math.round(upgrades.bays * 9 * getUtilityDiscount(upgrades.ecoSolar));
  return salaries + ads + utility;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const saved = loadGameSync();

  const bindSim = () => {
    gameSimulation.bind({
      getEconomy: () => get().economy,
      getUpgrades: () => get().upgrades,
      getPlayerWorkers: () => get().workers,
      getCompetitor: () => get().competitor,
      getDay: () => get().day,
      getTimeOfDay: () => get().timeOfDay,
      getTimeMode: () => get().settings.timeMode,
      getShowPopups: () => get().settings.showPopups,

      onPlayerWashComplete: (payment, repDelta, workerId) => {
        set((state) => {
          const nextRep = Math.min(5.0, Math.max(1.0, +(state.economy.reputation + repDelta).toFixed(2)));
          let nextWorkers = state.workers;

          if (workerId) {
            nextWorkers = state.workers.map((w) => {
              if (w.id !== workerId) return w;
              let xp = w.xp + 28;
              let level = w.level;
              let xpToNext = w.xpToNext;
              let speed = w.speed;
              let quality = w.quality;

              if (xp >= xpToNext && level < 10) {
                xp -= xpToNext;
                level += 1;
                xpToNext = Math.round(xpToNext * 1.38);
                speed = +(speed + 0.08).toFixed(2);
                quality = +(quality + 0.08).toFixed(2);
                const rt = gameSimulation.workerRuntimes.get(w.id);
                if (rt) {
                  gameSimulation.addPopup(rt.x, 2.5, rt.z, `LVL ${level}!`, '#00D4FF');
                }
              }

              return {
                ...w,
                xp,
                level,
                xpToNext,
                speed,
                quality,
                carsWashed: w.carsWashed + 1,
              };
            });
          }

          return {
            economy: {
              ...state.economy,
              balance: state.economy.balance + payment,
              totalRevenue: state.economy.totalRevenue + payment,
              carsWashed: state.economy.carsWashed + 1,
              reputation: nextRep,
            },
            workers: nextWorkers,
          };
        });
      },

      onPlayerCarLost: (repDelta) => {
        set((state) => ({
          economy: {
            ...state.economy,
            carsLost: state.economy.carsLost + 1,
            reputation: Math.min(5.0, Math.max(1.0, +(state.economy.reputation + repDelta).toFixed(2))),
          },
        }));
      },

      onCompetitorWashComplete: (payment) => {
        set((state) => ({
          competitor: {
            ...state.competitor,
            carsWashed: state.competitor.carsWashed + 1,
            totalRevenue: state.competitor.totalRevenue + payment,
            reputation: Math.min(4.6, +(state.competitor.reputation + 0.004).toFixed(2)),
          },
        }));
      },

      onEconomyMinuteTick: (utility, salary, adCost, playerRevPerMin, compRevPerMin) => {
        set((state) => {
          const totalCycleCost = utility + salary + adCost;
          const estExpPerMin = computeEstimatedExpensesPerMin(
            state.workers,
            state.upgrades,
            state.economy.adCampaign
          );
          const smoothedIncome = Math.round(state.economy.incomePerMin * 0.45 + playerRevPerMin * 0.55);
          const smoothedCompRev = Math.round(state.competitor.revenuePerMin * 0.45 + compRevPerMin * 0.55);
          const nextBalance = Math.max(0, state.economy.balance - totalCycleCost);

          const nextHistory = [
            ...state.economy.history.slice(-19),
            {
              minute: Math.round(state.elapsedMinutes * 10) / 10,
              playerRev: smoothedIncome,
              compRev: smoothedCompRev,
              balance: nextBalance,
            },
          ];

          return {
            economy: {
              ...state.economy,
              balance: nextBalance,
              totalExpenses: state.economy.totalExpenses + totalCycleCost,
              incomePerMin: smoothedIncome,
              expensesPerMin: estExpPerMin,
              profitPerMin: smoothedIncome - estExpPerMin,
              history: nextHistory,
            },
            competitor: {
              ...state.competitor,
              revenuePerMin: smoothedCompRev,
            },
          };
        });
      },

      onTimeAdvance: (newTimeOfDay, dayDelta, minuteDelta) => {
        set((state) => ({
          timeOfDay: newTimeOfDay,
          day: state.day + dayDelta,
          elapsedMinutes: state.elapsedMinutes + minuteDelta,
        }));
      },

      onCompetitorUpdate: (patch) => {
        set((state) => ({
          competitor: { ...state.competitor, ...patch },
        }));
      },

      onEntityListChanged: () => {
        set((state) => ({ entityVersion: state.entityVersion + 1 }));
      },
    });
  };

  return {
    started: false,
    hasSave: hasSavedGame(),
    lastSavedAt: saved?.savedAt ?? null,
    paused: false,
    simSpeed: 1,
    day: saved?.day ?? 1,
    // Start at vibrant Spider-Verse Golden Afternoon!
    timeOfDay: saved?.timeOfDay ?? 0.64,
    elapsedMinutes: saved?.elapsedMinutes ?? 0,
    activePanel: null,
    cameraPreset: 'overview',
    cameraPresetSeq: 0,
    selection: null,
    followSelected: false,
    entityVersion: 0,

    economy: saved?.economy ?? createInitialEconomy(),
    upgrades: saved?.upgrades ?? createInitialUpgrades(),
    workers: saved?.workers ?? [createStarterWorker()],
    candidates: generateHireCandidates(4, saved?.economy.reputation ?? 3.5),
    competitor: saved?.competitor ?? createInitialCompetitor(),
    settings: saved?.settings ?? createInitialSettings(),

    _bindSimulation: bindSim,

    startNewGame: () => {
      soundEngine.unlock();
      soundEngine.playClick();
      clearSavedGame();
      const freshEco = createInitialEconomy();
      const freshUpgrades = createInitialUpgrades();
      const freshWorkers = [createStarterWorker()];
      const freshComp = createInitialCompetitor();
      set({
        started: true,
        hasSave: false,
        paused: false,
        simSpeed: 1,
        day: 1,
        timeOfDay: 0.64,
        elapsedMinutes: 0,
        activePanel: null,
        selection: null,
        followSelected: false,
        economy: freshEco,
        upgrades: freshUpgrades,
        workers: freshWorkers,
        candidates: generateHireCandidates(4, freshEco.reputation),
        competitor: freshComp,
      });
      bindSim();
      gameSimulation.reset();
      get().saveNow();
    },

    continueSavedGame: () => {
      soundEngine.unlock();
      soundEngine.playClick();
      const data = loadGameSync();
      if (data) {
        soundEngine.setSettings(
          data.settings.sfxVolume,
          data.settings.musicVolume,
          data.settings.muted
        );
        set({
          started: true,
          hasSave: true,
          lastSavedAt: data.savedAt,
          paused: false,
          day: data.day,
          timeOfDay: data.timeOfDay,
          elapsedMinutes: data.elapsedMinutes,
          economy: data.economy,
          upgrades: data.upgrades,
          workers: data.workers.length > 0 ? data.workers : [createStarterWorker()],
          candidates: generateHireCandidates(4, data.economy.reputation),
          competitor: data.competitor,
          settings: data.settings,
          activePanel: null,
        });
      } else {
        set({ started: true, paused: false });
      }
      bindSim();
      gameSimulation.syncWorkerRuntimes();
    },

    returnToTitle: () => {
      soundEngine.playClick();
      get().saveNow();
      set({ started: false, activePanel: null, selection: null, followSelected: false });
    },

    togglePause: () => {
      soundEngine.playClick();
      set((s) => ({ paused: !s.paused }));
    },

    setSimSpeed: (speed) => {
      soundEngine.playClick();
      set({ simSpeed: speed, paused: false });
    },

    setActivePanel: (panel) => {
      soundEngine.unlock();
      soundEngine.playClick();
      set((s) => ({
        activePanel: s.activePanel === panel ? null : panel,
      }));
    },

    setCameraPreset: (preset) => {
      soundEngine.playClick();
      set((s) => ({
        cameraPreset: preset,
        cameraPresetSeq: s.cameraPresetSeq + 1,
        followSelected: false,
      }));
    },

    setSelection: (target, follow = false) => {
      if (target) soundEngine.playClick();
      set({ selection: target, followSelected: target ? follow : false });
    },

    toggleFollowSelected: () => {
      soundEngine.playClick();
      set((s) => ({ followSelected: s.selection ? !s.followSelected : false }));
    },

    setWashPrice: (price) => {
      const clamped = Math.max(15, Math.min(75, Math.round(price)));
      set((s) => ({
        economy: { ...s.economy, washPrice: clamped },
      }));
    },

    setAdCampaign: (id) => {
      soundEngine.playClick();
      set((s) => {
        const expPerMin = computeEstimatedExpensesPerMin(s.workers, s.upgrades, id);
        return {
          economy: {
            ...s.economy,
            adCampaign: id,
            expensesPerMin: expPerMin,
            profitPerMin: s.economy.incomePerMin - expPerMin,
          },
        };
      });
    },

    buyUpgrade: (key: UpgradeKey) => {
      const state = get();
      const def = UPGRADE_DEFINITIONS.find((d) => d.key === key);
      if (!def) return false;
      const currentLv = state.upgrades[key];
      if (currentLv >= def.maxLevel) return false;
      const cost = getUpgradeCost(key, currentLv);
      if (state.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }

      soundEngine.playUpgrade();
      const nextUpgrades: UpgradeLevels = {
        ...state.upgrades,
        [key]: currentLv + 1,
      };
      const repBoost = key === 'vipLounge' ? 0.2 : key === 'bays' ? 0.15 : 0.05;
      const expPerMin = computeEstimatedExpensesPerMin(
        state.workers,
        nextUpgrades,
        state.economy.adCampaign
      );

      set({
        upgrades: nextUpgrades,
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
          reputation: Math.min(5.0, +(state.economy.reputation + repBoost).toFixed(2)),
          expensesPerMin: expPerMin,
          profitPerMin: state.economy.incomePerMin - expPerMin,
        },
      });
      get().saveNow();
      return true;
    },

    hireCandidate: (candidateId) => {
      const state = get();
      const cand = state.candidates.find((c) => c.id === candidateId);
      if (!cand) return false;
      if (state.workers.length >= 8) {
        soundEngine.playError();
        return false;
      }
      if (state.economy.balance < cand.hireCost) {
        soundEngine.playError();
        return false;
      }

      soundEngine.playUpgrade();
      const newWorker: WorkerProfile = {
        id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        owner: 'player',
        name: cand.name,
        roleTitle: cand.roleTitle,
        appearance: cand.appearance,
        speed: cand.speed,
        quality: cand.quality,
        salaryPerMin: cand.salaryPerMin,
        morale: 1.0,
        level: cand.level,
        xp: 0,
        xpToNext: Math.round(100 * Math.pow(1.35, cand.level - 1)),
        assignedBay: -1,
        carsWashed: 0,
      };

      const nextWorkers = [...state.workers, newWorker];
      const nextCandidates = state.candidates.filter((c) => c.id !== candidateId);
      const expPerMin = computeEstimatedExpensesPerMin(
        nextWorkers,
        state.upgrades,
        state.economy.adCampaign
      );

      set({
        workers: nextWorkers,
        candidates:
          nextCandidates.length > 0
            ? nextCandidates
            : generateHireCandidates(4, state.economy.reputation),
        economy: {
          ...state.economy,
          balance: state.economy.balance - cand.hireCost,
          totalExpenses: state.economy.totalExpenses + cand.hireCost,
          expensesPerMin: expPerMin,
          profitPerMin: state.economy.incomePerMin - expPerMin,
        },
      });
      gameSimulation.syncWorkerRuntimes();
      get().saveNow();
      return true;
    },

    fireWorker: (workerId) => {
      const state = get();
      if (state.workers.length <= 1) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playClick();
      const nextWorkers = state.workers.filter((w) => w.id !== workerId);
      const expPerMin = computeEstimatedExpensesPerMin(
        nextWorkers,
        state.upgrades,
        state.economy.adCampaign
      );

      set({
        workers: nextWorkers,
        selection:
          state.selection?.type === 'worker' && state.selection.id === workerId
            ? null
            : state.selection,
        economy: {
          ...state.economy,
          expensesPerMin: expPerMin,
          profitPerMin: state.economy.incomePerMin - expPerMin,
        },
      });
      gameSimulation.syncWorkerRuntimes();
      get().saveNow();
      return true;
    },

    trainWorker: (workerId) => {
      const state = get();
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker || worker.level >= 10) return false;
      const cost = getTrainingCost(worker);
      if (state.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }

      soundEngine.playUpgrade();
      const nextWorkers = state.workers.map((w) =>
        w.id === workerId
          ? {
              ...w,
              level: w.level + 1,
              speed: +(w.speed + 0.14).toFixed(2),
              quality: +(w.quality + 0.12).toFixed(2),
              xpToNext: Math.round(w.xpToNext * 1.35),
            }
          : w
      );

      const rt = gameSimulation.workerRuntimes.get(workerId);
      if (rt) {
        gameSimulation.addPopup(rt.x, 2.5, rt.z, `ОБУЧЕН LVL ${worker.level + 1}`, '#00D4FF');
      }

      set({
        workers: nextWorkers,
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
        },
      });
      get().saveNow();
      return true;
    },

    giveWorkerRaise: (workerId) => {
      const state = get();
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker || worker.morale >= 1.35) return false;

      soundEngine.playUpgrade();
      const raise = getRaiseAmount(worker);
      const nextWorkers = state.workers.map((w) =>
        w.id === workerId
          ? {
              ...w,
              salaryPerMin: w.salaryPerMin + raise,
              morale: Math.min(1.35, +(w.morale + 0.12).toFixed(2)),
            }
          : w
      );
      const expPerMin = computeEstimatedExpensesPerMin(
        nextWorkers,
        state.upgrades,
        state.economy.adCampaign
      );

      const rt = gameSimulation.workerRuntimes.get(workerId);
      if (rt) {
        gameSimulation.addPopup(rt.x, 2.5, rt.z, `+МОРАЛЬ!`, '#FFB800');
      }

      set({
        workers: nextWorkers,
        economy: {
          ...state.economy,
          expensesPerMin: expPerMin,
          profitPerMin: state.economy.incomePerMin - expPerMin,
        },
      });
      get().saveNow();
      return true;
    },

    assignWorkerBay: (workerId, bayIndex) => {
      soundEngine.playClick();
      set((s) => ({
        workers: s.workers.map((w) =>
          w.id === workerId ? { ...w, assignedBay: bayIndex } : w
        ),
      }));
    },

    refreshCandidates: () => {
      soundEngine.playClick();
      set((s) => ({
        candidates: generateHireCandidates(4, s.economy.reputation),
      }));
    },

    updateSettings: (patch) => {
      set((s) => {
        const next = { ...s.settings, ...patch };
        soundEngine.setSettings(next.sfxVolume, next.musicVolume, next.muted);
        return { settings: next };
      });
      get().saveNow();
    },

    saveNow: () => {
      const s = get();
      const payload = saveGameSync({
        day: s.day,
        timeOfDay: s.timeOfDay,
        elapsedMinutes: s.elapsedMinutes,
        economy: s.economy,
        upgrades: s.upgrades,
        workers: s.workers,
        competitor: s.competitor,
        settings: s.settings,
      });
      set({ hasSave: true, lastSavedAt: payload.savedAt });
    },

    resetProgress: () => {
      get().startNewGame();
    },
  };
});
