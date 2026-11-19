import { create } from 'zustand';
import { soundEngine } from '../audio/soundEngine';
import { QUEST_CHAIN, TUTORIAL_STEPS } from '../config/progression';
import {
  createStarterWorker,
  generateHireCandidates,
  getRaiseAmount,
  getTrainingCost,
} from '../config/staff';
import {
  AD_CAMPAIGNS,
  BAY_UTILITY_PER_MIN,
  UPGRADE_DEFINITIONS,
  WASH_PRICE_DEFAULT,
  WASH_PRICE_MAX,
  WASH_PRICE_MIN,
  getUpgradeCost,
  getUtilityDiscount,
} from '../config/upgrades';
import { SHIFT_START_TIME, gameSimulation } from '../engine/simulation';
import {
  clearSavedGame,
  hasSavedGame,
  loadGameSync,
  saveGameSync,
} from '../persistence/saveManager';
import type {
  ActiveCityEvent,
  ActivePanel,
  AdCampaignId,
  CameraPreset,
  CompetitorState,
  EconomyMetrics,
  GameSettings,
  HireCandidate,
  SelectionTarget,
  ShiftSummary,
  ToastNotification,
  UpgradeKey,
  UpgradeLevels,
  WorkerProfile,
} from '../types/game';
import { formatRub } from '../utils/currency';

interface GameStoreState {
  started: boolean;
  hasSave: boolean;
  lastSavedAt: number | null;
  paused: boolean;
  simSpeed: 1 | 2 | 3;
  day: number;
  /** 0..1 where 7/24 (0.2917) = 07:00 morning start, 22/24 (0.9167) = 22:00 shift close */
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

  // Progression, Shifts, Events, Tutorial & Toasts
  shiftSummary: ShiftSummary | null;
  activeEvent: ActiveCityEvent | null;
  claimedQuestIds: string[];
  tutorialActive: boolean;
  tutorialStep: number;
  tutorialCompleted: boolean;
  toasts: ToastNotification[];

  // Actions
  startNewGame: () => void;
  continueSavedGame: () => void;
  startNextShift: () => void;
  returnToTitle: () => void;
  togglePause: () => void;
  setSimSpeed: (speed: 1 | 2 | 3) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSelection: (target: SelectionTarget | null, follow?: boolean) => void;
  toggleFollowSelected: () => void;

  // Interactive Gameplay Actions
  boostVehicleWash: (vehicleId: string) => boolean;
  activateHappyHour: () => boolean;
  claimQuestReward: (questId: string) => boolean;

  // Tutorial Actions
  advanceTutorial: () => void;
  skipTutorial: () => void;
  restartTutorial: () => void;

  // Notifications
  pushToast: (title: string, subtitle: string | undefined, tone: ToastNotification['tone']) => void;
  dismissToast: (id: string) => void;

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

const STARTING_BALANCE = 20_000;
const TUTORIAL_BONUS = 3_500;

function createInitialEconomy(): EconomyMetrics {
  return {
    balance: STARTING_BALANCE,
    totalRevenue: 0,
    totalExpenses: 0,
    incomePerMin: 0,
    expensesPerMin: 1_850,
    profitPerMin: -1_850,
    carsWashed: 0,
    carsLost: 0,
    reputation: 3.25,
    washPrice: WASH_PRICE_DEFAULT,
    adCampaign: 'none',
    combo: 0,
    bestCombo: 0,
    dailyRevenue: 0,
    dailyExpenses: 0,
    dailyCars: 0,
    happyHourRemaining: 0,
    happyHourCooldown: 0,
    history: [{ minute: 0, playerRev: 0, compRev: 0, balance: STARTING_BALANCE }],
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
    price: 900,
    quality: 2.85,
    speedMultiplier: 1.15,
    reputation: 3.85,
    carsWashed: 0,
    totalRevenue: 0,
    revenuePerMin: 0,
    promoActive: false,
    promoTimer: 36,
    lastUpgradeDay: 1,
  };
}

function detectDefaultQuality(): GameSettings['quality'] {
  if (typeof window === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency ?? 6;
  return cores <= 2 ? 'medium' : 'high';
}

function createInitialSettings(): GameSettings {
  return {
    quality: detectDefaultQuality(),
    timeMode: 'cycle',
    sfxVolume: 0.65,
    musicVolume: 0.28,
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
  const utility = Math.round(
    upgrades.bays * BAY_UTILITY_PER_MIN * getUtilityDiscount(upgrades.ecoSolar)
  );
  return salaries + ads + utility;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const saved = loadGameSync();

  const pushToastInternal = (
    title: string,
    subtitle: string | undefined,
    tone: ToastNotification['tone']
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const toast: ToastNotification = { id, title, subtitle, tone, createdAt: Date.now() };
    // Never stack notifications: show at most 1 compact pill at a time for 2.6 seconds
    set({ toasts: [toast] });
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2600);
  };

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
      getActiveEvent: () => get().activeEvent,
      getStarted: () => get().started,

      onPlayerWashComplete: (payment, repDelta, workerId, isVip) => {
        set((state) => {
          const nextRep = Math.min(
            5.0,
            Math.max(1.0, +(state.economy.reputation + repDelta).toFixed(2))
          );
          const nextCombo = state.economy.combo + 1;
          const nextBestCombo = Math.max(state.economy.bestCombo, nextCombo);
          let nextWorkers = state.workers;

          if (workerId) {
            nextWorkers = state.workers.map((w) => {
              if (w.id !== workerId) return w;
              let xp = w.xp + (isVip ? 52 : 30);
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
                  gameSimulation.addPopup(rt.x, 2.4, rt.z, `LVL ${level}!`, '#00D4FF');
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
              dailyRevenue: state.economy.dailyRevenue + payment,
              carsWashed: state.economy.carsWashed + 1,
              dailyCars: state.economy.dailyCars + 1,
              reputation: nextRep,
              combo: nextCombo,
              bestCombo: nextBestCombo,
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
            combo: 0,
            reputation: Math.min(
              5.0,
              Math.max(1.0, +(state.economy.reputation + repDelta).toFixed(2))
            ),
          },
        }));
      },

      onCompetitorWashComplete: (payment) => {
        set((state) => {
          const repStep =
            state.competitor.reputation > 4.6
              ? 0.003
              : state.competitor.reputation > 4.25
                ? 0.006
                : 0.01;
          return {
            competitor: {
              ...state.competitor,
              carsWashed: state.competitor.carsWashed + 1,
              totalRevenue: state.competitor.totalRevenue + payment,
              reputation: Math.min(4.9, +(state.competitor.reputation + repStep).toFixed(3)),
            },
          };
        });
      },

      onEconomyMinuteTick: (utility, salary, adCost, playerRevPerMin, compRevPerMin) => {
        set((state) => {
          const totalCycleCost = utility + salary + adCost;
          const estExpPerMin = computeEstimatedExpensesPerMin(
            state.workers,
            state.upgrades,
            state.economy.adCampaign
          );
          const smoothedIncome = Math.round(
            state.economy.incomePerMin * 0.45 + playerRevPerMin * 0.55
          );
          const smoothedCompRev = Math.round(
            state.competitor.revenuePerMin * 0.45 + compRevPerMin * 0.55
          );
          const nextBalance = Math.max(0, state.economy.balance - totalCycleCost);

          const nextHistory = [
            ...state.economy.history.slice(-23),
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
              dailyExpenses: (state.economy.dailyExpenses ?? 0) + totalCycleCost,
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

      // Called only at 2Hz (every 0.5s), and avoids mutating state.economy when timers are idle!
      onTimeAdvance: (newTimeOfDay, minuteDelta, dtSec) => {
        set((state) => {
          const hasTimers =
            state.economy.happyHourRemaining > 0 || state.economy.happyHourCooldown > 0;
          if (!hasTimers) {
            return {
              timeOfDay: newTimeOfDay,
              elapsedMinutes: state.elapsedMinutes + minuteDelta,
            };
          }
          return {
            timeOfDay: newTimeOfDay,
            elapsedMinutes: state.elapsedMinutes + minuteDelta,
            economy: {
              ...state.economy,
              happyHourRemaining: Math.max(0, state.economy.happyHourRemaining - dtSec),
              happyHourCooldown: Math.max(0, state.economy.happyHourCooldown - dtSec),
            },
          };
        });
      },

      onShiftComplete: () => {
        const s = get();
        soundEngine.playFanfare();
        const rev = s.economy.dailyRevenue;
        const exp = s.economy.dailyExpenses ?? 0;
        set({
          paused: true,
          activePanel: null,
          selection: null,
          shiftSummary: {
            day: s.day,
            carsWashed: s.economy.dailyCars,
            revenue: rev,
            expenses: exp,
            profit: rev - exp,
            bestCombo: s.economy.bestCombo,
          },
        });
        get().saveNow();
      },

      onCompetitorUpdate: (patch) => {
        set((state) => ({
          competitor: { ...state.competitor, ...patch },
        }));
      },

      onCityEventUpdate: (event) => {
        set({ activeEvent: event });
      },

      onToast: (title, subtitle, tone) => {
        pushToastInternal(title, subtitle, tone);
      },

      onEntityListChanged: () => {
        set((state) => ({ entityVersion: state.entityVersion + 1 }));
      },
    });
  };

  const initialTime =
    saved?.timeOfDay !== undefined &&
    saved.timeOfDay >= SHIFT_START_TIME &&
    saved.timeOfDay < 22 / 24
      ? saved.timeOfDay
      : SHIFT_START_TIME;

  return {
    started: false,
    hasSave: hasSavedGame(),
    lastSavedAt: saved?.savedAt ?? null,
    paused: false,
    simSpeed: 1,
    day: saved?.day ?? 1,
    timeOfDay: initialTime,
    elapsedMinutes: saved?.elapsedMinutes ?? 0,
    activePanel: null,
    cameraPreset: 'overview',
    cameraPresetSeq: 0,
    selection: null,
    followSelected: false,
    entityVersion: 0,

    economy: saved?.economy
      ? { ...createInitialEconomy(), ...saved.economy }
      : createInitialEconomy(),
    upgrades: saved?.upgrades ?? createInitialUpgrades(),
    workers: saved?.workers ?? [createStarterWorker()],
    candidates: generateHireCandidates(4, saved?.economy.reputation ?? 3.55),
    competitor: saved?.competitor ?? createInitialCompetitor(),
    settings: saved?.settings ?? createInitialSettings(),

    shiftSummary: null,
    activeEvent: null,
    claimedQuestIds: saved?.claimedQuestIds ?? [],
    tutorialActive: false,
    tutorialStep: 0,
    tutorialCompleted: saved?.tutorialCompleted ?? false,
    toasts: [],

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
        timeOfDay: SHIFT_START_TIME,
        elapsedMinutes: 0,
        activePanel: null,
        cameraPreset: 'overview',
        selection: null,
        followSelected: false,
        shiftSummary: null,
        economy: freshEco,
        upgrades: freshUpgrades,
        workers: freshWorkers,
        candidates: generateHireCandidates(4, freshEco.reputation),
        competitor: freshComp,
        activeEvent: null,
        claimedQuestIds: [],
        tutorialActive: true,
        tutorialStep: 0,
        tutorialCompleted: false,
        toasts: [],
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
        const restoredTime =
          data.timeOfDay >= SHIFT_START_TIME && data.timeOfDay < 22 / 24
            ? data.timeOfDay
            : SHIFT_START_TIME;
        set({
          started: true,
          hasSave: true,
          lastSavedAt: data.savedAt,
          paused: false,
          shiftSummary: null,
          day: data.day,
          timeOfDay: restoredTime,
          elapsedMinutes: data.elapsedMinutes,
          economy: {
            ...createInitialEconomy(),
            ...data.economy,
            washPrice: Math.min(
              WASH_PRICE_MAX,
              Math.max(WASH_PRICE_MIN, data.economy.washPrice ?? WASH_PRICE_DEFAULT)
            ),
          },
          upgrades: data.upgrades,
          workers: data.workers.length > 0 ? data.workers : [createStarterWorker()],
          candidates: generateHireCandidates(4, data.economy.reputation),
          competitor: data.competitor,
          settings: data.settings,
          claimedQuestIds: data.claimedQuestIds ?? [],
          tutorialCompleted: data.tutorialCompleted ?? true,
          tutorialActive: !(data.tutorialCompleted ?? true),
          tutorialStep: 0,
          activePanel: null,
        });
      } else {
        set({ started: true, paused: false, shiftSummary: null });
      }
      bindSim();
      gameSimulation.syncWorkerRuntimes();
    },

    startNextShift: () => {
      soundEngine.unlock();
      soundEngine.playClick();
      gameSimulation.startNewShift();
      set((state) => ({
        day: state.day + 1,
        timeOfDay: SHIFT_START_TIME,
        paused: false,
        shiftSummary: null,
        economy: {
          ...state.economy,
          dailyRevenue: 0,
          dailyExpenses: 0,
          dailyCars: 0,
        },
      }));
      get().saveNow();
    },

    returnToTitle: () => {
      soundEngine.playClick();
      get().saveNow();
      set({
        started: false,
        activePanel: null,
        selection: null,
        followSelected: false,
        shiftSummary: null,
      });
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

    boostVehicleWash: (vehicleId) => {
      soundEngine.unlock();
      const ok = gameSimulation.boostVehicleWash(vehicleId);
      if (ok) {
        const s = get();
        if (s.tutorialActive && s.tutorialStep === 0) {
          set({ tutorialStep: 1 });
        }
      }
      return ok;
    },

    activateHappyHour: () => {
      const s = get();
      if (s.economy.happyHourRemaining > 0 || s.economy.happyHourCooldown > 0) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          happyHourRemaining: 30,
          happyHourCooldown: 75,
        },
      }));
      pushToastInternal('⚡ Счастливый час: 30 сек (-15% цена, +25% скорость)', undefined, 'amber');
      return true;
    },

    claimQuestReward: (questId) => {
      const s = get();
      if (s.claimedQuestIds.includes(questId)) return false;
      const def = QUEST_CHAIN.find((q) => q.id === questId);
      if (!def) return false;
      const sharePct = Math.round(gameSimulation.getPlayerAttractionShare() * 100);
      const cur = def.getCurrent({
        economy: s.economy,
        upgrades: s.upgrades,
        workers: s.workers,
        playerSharePct: sharePct,
      });
      if (cur < def.target) return false;

      soundEngine.playFanfare();
      set((state) => ({
        claimedQuestIds: [...state.claimedQuestIds, questId],
        economy: {
          ...state.economy,
          balance: state.economy.balance + def.reward,
          totalRevenue: state.economy.totalRevenue + def.reward,
          dailyRevenue: state.economy.dailyRevenue + def.reward,
        },
      }));
      pushToastInternal(`🎯 ${def.title}: ${formatRub(def.reward, { signed: true })}`, undefined, 'emerald');
      get().saveNow();
      return true;
    },

    advanceTutorial: () => {
      soundEngine.unlock();
      const s = get();
      if (!s.tutorialActive) return;
      const lastIdx = TUTORIAL_STEPS.length - 1;
      if (s.tutorialStep >= lastIdx) {
        soundEngine.playFanfare();
        const giveBonus = !s.tutorialCompleted;
        set((state) => ({
          tutorialActive: false,
          tutorialCompleted: true,
          tutorialStep: 0,
          economy: giveBonus
            ? {
                ...state.economy,
                balance: state.economy.balance + TUTORIAL_BONUS,
              }
            : state.economy,
        }));
        if (giveBonus) {
          pushToastInternal(`🎓 Бонус ${formatRub(TUTORIAL_BONUS, { signed: true })}`, undefined, 'emerald');
        }
        get().saveNow();
      } else {
        soundEngine.playClick();
        set({ tutorialStep: s.tutorialStep + 1 });
      }
    },

    skipTutorial: () => {
      soundEngine.playClick();
      set({
        tutorialActive: false,
        tutorialCompleted: true,
        tutorialStep: 0,
      });
      get().saveNow();
    },

    restartTutorial: () => {
      soundEngine.playClick();
      set({
        tutorialActive: true,
        tutorialStep: 0,
        activePanel: null,
      });
    },

    pushToast: pushToastInternal,

    dismissToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    setWashPrice: (price) => {
      const clamped = Math.max(WASH_PRICE_MIN, Math.min(WASH_PRICE_MAX, Math.round(price / 50) * 50));
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
      const repBoost = key === 'vipLounge' ? 0.22 : key === 'bays' ? 0.16 : 0.06;
      const expPerMin = computeEstimatedExpensesPerMin(
        state.workers,
        nextUpgrades,
        state.economy.adCampaign
      );

      // Auto-advance tutorial step 2 when player buys an upgrade!
      const autoAdvance = state.tutorialActive && state.tutorialStep === 2;

      set({
        upgrades: nextUpgrades,
        tutorialStep: autoAdvance ? 3 : state.tutorialStep,
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

      // Auto-advance tutorial step 1 when player hires a worker!
      const autoAdvance = state.tutorialActive && state.tutorialStep === 1;

      set({
        workers: nextWorkers,
        tutorialStep: autoAdvance ? 2 : state.tutorialStep,
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
        gameSimulation.addPopup(rt.x, 2.4, rt.z, `LVL ${worker.level + 1}`, '#00D4FF');
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
        gameSimulation.addPopup(rt.x, 2.4, rt.z, '+МОРАЛЬ', '#FFB800');
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
        claimedQuestIds: s.claimedQuestIds,
        tutorialCompleted: s.tutorialCompleted,
      });
      set({ hasSave: true, lastSavedAt: payload.savedAt });
    },

    resetProgress: () => {
      get().startNewGame();
    },
  };
});
