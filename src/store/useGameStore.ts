import { create } from 'zustand';
import { soundEngine } from '../audio/soundEngine';
import {
  BUSINESS_TYPES,
  CONTRACT_TEMPLATES,
  DISTRICTS,
  DISTRICT_ORDER,
  DOCUMENTS_CATALOG,
  ENTREPRENEUR_LEVELS,
  LOAN_PRODUCTS,
  RESEARCH_TREE,
  SPECIALIST_CATALOG,
  WASH_TECHNOLOGIES,
  createEmptyPeriodBucket,
  createInitialDistrictRival,
  createInitialReports,
  createInitialSpecialists,
  getLevelForXp,
} from '../config/empire';
import { CITY_EVENTS, QUEST_CHAIN, TUTORIAL_STEPS } from '../config/progression';
import {
  createStarterWorker,
  generateHireCandidates,
  getRaiseAmount,
  getTrainingCost,
} from '../config/staff';
import {
  UPGRADE_DEFINITIONS,
  WASH_PRICE_DEFAULT,
  WASH_PRICE_MAX,
  WASH_PRICE_MIN,
  getUpgradeCost,
} from '../config/upgrades';
import {
  calculatePlayerExpensesPerMin,
  calculateTaxAccrual,
  computeAuditRisk,
  evaluateTaxAudit,
  recordLedger,
  stepCompetitorEconomy,
  stepOwnedBusiness,
} from '../engine/economyEngine';
import { SHIFT_START_TIME, gameSimulation } from '../engine/simulation';
import {
  clearSavedGame,
  hasSavedGame,
  loadGameSync,
  saveGameSync,
} from '../persistence/saveManager';
import { adService } from '../services/adService';
import type {
  ActiveCityEvent,
  ActivePanel,
  AdCampaignId,
  BusinessTypeId,
  CameraPreset,
  CompetitorState,
  CorporateContract,
  DistrictId,
  DocumentId,
  EconomyMetrics,
  EmpireState,
  GameSettings,
  HireCandidate,
  OwnedBusiness,
  OwnedProperty,
  SelectionTarget,
  ShiftSummary,
  SpecialistRole,
  ToastNotification,
  UpgradeKey,
  UpgradeLevels,
  WashTechId,
  WeatherType,
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
  empire: EmpireState;
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

  // Yandex Games Ad Monetization Actions
  watchRewardedSponsorAd: () => Promise<boolean>;
  watchRewardedTurboAd: () => Promise<boolean>;
  watchRewardedDoubleShiftAd: () => Promise<boolean>;

  // Tutorial Actions
  advanceTutorial: () => void;
  skipTutorial: () => void;
  restartTutorial: () => void;

  // Notifications
  pushToast: (title: string, subtitle: string | undefined, tone: ToastNotification['tone']) => void;
  dismissToast: (id: string) => void;

  // Business & Wash Tech actions
  setWashPrice: (price: number) => void;
  setAdCampaign: (id: AdCampaignId) => void;
  buyUpgrade: (key: UpgradeKey) => boolean;
  repairEquipment: () => boolean;
  unlockWashTech: (techId: WashTechId) => boolean;
  selectWashTech: (techId: WashTechId) => boolean;
  buyResearch: (researchId: string) => boolean;

  // Tax & Documents actions
  buyDocument: (docId: DocumentId) => boolean;
  payTaxes: () => boolean;
  fileTaxDeclaration: () => boolean;

  // Bank & Insurance actions
  takeLoan: (productIndex: number) => boolean;
  repayLoan: (loanId: string) => boolean;
  toggleInsurance: () => void;

  // Staff & Specialist actions
  hireCandidate: (candidateId: string) => boolean;
  fireWorker: (workerId: string) => boolean;
  trainWorker: (workerId: string) => boolean;
  giveWorkerRaise: (workerId: string) => boolean;
  restWorkers: () => boolean;
  assignWorkerBay: (workerId: string, bayIndex: number) => void;
  refreshCandidates: () => void;
  hireSpecialist: (role: SpecialistRole) => boolean;
  fireSpecialist: (role: SpecialistRole) => boolean;

  // Empire: Districts, Real Estate, Auxiliary Businesses, Contracts, Holding
  unlockDistrict: (districtId: DistrictId) => boolean;
  switchDistrict: (districtId: DistrictId) => boolean;
  buyProperty: (districtId: DistrictId, kind: 'land' | 'building') => boolean;
  toggleLeaseProperty: (propertyId: string) => boolean;
  sellProperty: (propertyId: string) => boolean;
  buildBusiness: (type: BusinessTypeId, districtId?: DistrictId) => boolean;
  upgradeBusiness: (bizId: string) => boolean;
  repairBusiness: (bizId: string) => boolean;
  acceptContract: (contractId: string) => boolean;
  foundHolding: (name?: string) => boolean;
  toggleHoldingProcurement: () => void;
  toggleHoldingAccounting: () => void;

  // Settings & Persistence
  updateSettings: (patch: Partial<GameSettings>) => void;
  saveNow: () => void;
  resetProgress: () => void;

  // Internal sim hooks
  _bindSimulation: () => void;
}

const STARTING_BALANCE = 26_000;
const TUTORIAL_BONUS = 3_000;

function createInitialContracts(): CorporateContract[] {
  return CONTRACT_TEMPLATES.map((tpl, i) => ({
    ...tpl,
    id: `contract-${i + 1}-${tpl.sector}`,
    completedCars: 0,
    daysLeft: tpl.daysTotal,
    active: false,
  }));
}

function createInitialDistrictRivals(): Record<DistrictId, CompetitorState> {
  const map = {} as Record<DistrictId, CompetitorState>;
  for (const id of DISTRICT_ORDER) {
    map[id] = createInitialDistrictRival(id);
  }
  return map;
}

function createInitialEmpire(): EmpireState {
  return {
    activeDistrict: 'residential',
    unlockedDistricts: ['residential'],
    weather: 'sunny',
    unlockedResearchIds: [],
    claimedLevelRewards: [],
    specialists: createInitialSpecialists(),
    properties: [],
    businesses: [],
    contracts: createInitialContracts(),
    completedContractIds: [],
    tax: {
      accruedProfitTax: 0,
      accruedPropertyTax: 0,
      accruedPayrollTax: 0,
      overdueAmount: 0,
      lastFilingDay: 1,
      auditRisk: 14,
      documents: {
        business_reg: true,
        lease_contract: false,
        sanitary_permit: false,
        fire_safety: false,
        staff_docs: false,
        bay_permit_2: false,
        bay_permit_3: false,
        bay_permit_4: false,
      },
      history: [],
    },
    bank: {
      creditScore: 620,
      loans: [],
      insuranceActive: false,
      insuranceCostPerMin: 350,
    },
    holding: {
      founded: false,
      name: 'AUTOMOIKA GROUP',
      corporateReserve: 0,
      centralProcurement: false,
      sharedAccounting: false,
      brandSynergyLevel: 1,
    },
    reports: createInitialReports(),
    districtRivals: createInitialDistrictRivals(),
  };
}

function createInitialEconomy(): EconomyMetrics {
  return {
    balance: STARTING_BALANCE,
    totalRevenue: 0,
    totalExpenses: 0,
    incomePerMin: 0,
    expensesPerMin: 1_120,
    profitPerMin: -1_120,
    carsWashed: 0,
    carsLost: 0,
    reputation: 3.25,
    washPrice: WASH_PRICE_DEFAULT,
    adCampaign: 'none',
    combo: 0,
    bestCombo: 0,
    dailyRevenue: 0,
    dailyExpenses: 0,
    dailyTaxes: 0,
    dailyCars: 0,
    happyHourRemaining: 0,
    happyHourCooldown: 0,
    adBoostRemaining: 0,
    adGrantCooldown: 0,
    equipmentCondition: 100,
    activeWashTech: 'manual',
    unlockedWashTechs: ['manual'],
    entrepreneurLevel: 1,
    entrepreneurXp: 0,
    lastPayoutBreakdown: null,
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

function detectDefaultQuality(): GameSettings['quality'] {
  if (typeof window === 'undefined') return 'ultra';
  const cores = navigator.hardwareConcurrency ?? 6;
  return cores <= 2 ? 'medium' : cores <= 4 ? 'high' : 'ultra';
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

function grantEntrepreneurXp(
  eco: EconomyMetrics,
  empire: EmpireState,
  xpGain: number
): { eco: EconomyMetrics; empire: EmpireState; leveledUpTo: number | null; rewardCash: number } {
  const nextXp = eco.entrepreneurXp + xpGain;
  const spec = getLevelForXp(nextXp);
  if (spec.level > eco.entrepreneurLevel) {
    let rewardCash = 0;
    const claimed = [...empire.claimedLevelRewards];
    for (let lv = eco.entrepreneurLevel + 1; lv <= spec.level; lv++) {
      if (!claimed.includes(lv)) {
        const lvSpec = ENTREPRENEUR_LEVELS[lv - 1];
        if (lvSpec) rewardCash += lvSpec.rewardCash;
        claimed.push(lv);
      }
    }
    return {
      eco: {
        ...eco,
        entrepreneurXp: nextXp,
        entrepreneurLevel: spec.level,
        balance: eco.balance + rewardCash,
      },
      empire: {
        ...empire,
        claimedLevelRewards: claimed,
      },
      leveledUpTo: spec.level,
      rewardCash,
    };
  }
  return {
    eco: { ...eco, entrepreneurXp: nextXp },
    empire,
    leveledUpTo: null,
    rewardCash: 0,
  };
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
    set({ toasts: [toast] });
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 2800);
    }
  };

  const bindSim = () => {
    gameSimulation.bind({
      getEconomy: () => get().economy,
      getUpgrades: () => get().upgrades,
      getPlayerWorkers: () => get().workers,
      getCompetitor: () => get().competitor,
      getEmpire: () => get().empire,
      getDay: () => get().day,
      getTimeOfDay: () => get().timeOfDay,
      getTimeMode: () => get().settings.timeMode,
      getShowPopups: () => get().settings.showPopups,
      getActiveEvent: () => get().activeEvent,
      getStarted: () => get().started,

      onPlayerWashComplete: (breakdown, repDelta, workerId, isVip) => {
        let levelToast: string | null = null;
        let contractToast: string | null = null;

        set((state) => {
          const payment = breakdown.total;
          const nextRep = Math.min(
            5.0,
            Math.max(1.0, +(state.economy.reputation + repDelta).toFixed(2))
          );
          const nextCombo = state.economy.combo + 1;
          const nextBestCombo = Math.max(state.economy.bestCombo, nextCombo);

          const hasAdmin = state.empire.specialists.some(
            (s) => s.role === 'administrator' && s.hired
          );
          const hasTech = state.empire.specialists.some((s) => s.role === 'technician' && s.hired);
          const hasDispatch = state.empire.unlockedResearchIds.includes('bay_dispatch_ai');
          const hasPrevMaint = state.empire.unlockedResearchIds.includes('preventive_maint');
          const hasCorpLicense = state.empire.unlockedResearchIds.includes('corp_licensing');
          const eventWear = state.activeEvent
            ? CITY_EVENTS[state.activeEvent.id].wearMultiplier
            : 1.0;

          // Equipment wear per washed car
          const wearDelta =
            0.55 * eventWear * (hasPrevMaint ? 0.6 : 1.0) * (hasTech ? 0.55 : 1.0);
          const nextCondition = Math.max(8, +(state.economy.equipmentCondition - wearDelta).toFixed(1));

          // Worker XP + realistic fatigue
          const fatigueStep = 1.8 * (hasAdmin ? 0.7 : 1.0) * (hasDispatch ? 0.75 : 1.0);
          let nextWorkers = state.workers;
          if (workerId) {
            nextWorkers = state.workers.map((w) => {
              if (w.id !== workerId) return w;
              let xp = w.xp + (isVip ? 42 : 24);
              let level = w.level;
              let xpToNext = w.xpToNext;
              let speed = w.speed;
              let quality = w.quality;

              if (xp >= xpToNext && level < 10) {
                xp -= xpToNext;
                level += 1;
                xpToNext = Math.round(xpToNext * 1.4);
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
                fatigue: Math.min(100, +(w.fatigue + fatigueStep).toFixed(1)),
                carsWashed: w.carsWashed + 1,
              };
            });
          }

          // Advance active corporate contracts
          let contractBonusCash = 0;
          let contractXp = 0;
          const completedIds = [...state.empire.completedContractIds];
          const nextContracts = state.empire.contracts.map((c) => {
            if (!c.active) return c;
            const nextCount = c.completedCars + 1;
            if (nextCount >= c.requiredCars) {
              const reward = Math.round(c.reward * (hasCorpLicense ? 1.2 : 1.0));
              contractBonusCash += reward;
              contractXp += 160;
              if (!completedIds.includes(c.id)) completedIds.push(c.id);
              contractToast = `Контракт «${c.clientName}» выполнен: ${formatRub(reward, { signed: true })}`;
              return { ...c, completedCars: 0, daysLeft: c.daysTotal, active: false };
            }
            return { ...c, completedCars: nextCount };
          });

          const nextReports = recordLedger(state.empire.reports, {
            washRevenue: payment,
            contractRevenue: contractBonusCash,
            carsWashed: 1,
          });

          const baseEco: EconomyMetrics = {
            ...state.economy,
            balance: state.economy.balance + payment + contractBonusCash,
            totalRevenue: state.economy.totalRevenue + payment + contractBonusCash,
            dailyRevenue: state.economy.dailyRevenue + payment + contractBonusCash,
            carsWashed: state.economy.carsWashed + 1,
            dailyCars: state.economy.dailyCars + 1,
            reputation: nextRep,
            combo: nextCombo,
            bestCombo: nextBestCombo,
            equipmentCondition: nextCondition,
            lastPayoutBreakdown: {
              baseTariff: breakdown.baseTariff,
              techBonus: breakdown.techBonus,
              qualityTip: breakdown.qualityTip,
              comboBonus: breakdown.comboBonus,
              vipBonus: breakdown.vipBonus,
              eventBonus: breakdown.eventBonus,
              total: breakdown.total,
            },
          };

          const baseEmpire: EmpireState = {
            ...state.empire,
            contracts: nextContracts,
            completedContractIds: completedIds,
            reports: nextReports,
          };

          const xpRes = grantEntrepreneurXp(baseEco, baseEmpire, (isVip ? 26 : 12) + contractXp);
          if (xpRes.leveledUpTo) {
            const lvSpec = ENTREPRENEUR_LEVELS[xpRes.leveledUpTo - 1];
            levelToast = `Уровень ${xpRes.leveledUpTo}: ${lvSpec?.title ?? ''} (+${formatRub(xpRes.rewardCash)})`;
          }

          return {
            economy: xpRes.eco,
            empire: xpRes.empire,
            workers: nextWorkers,
          };
        });

        if (contractToast) {
          soundEngine.playFanfare();
          pushToastInternal('📋 Контракт выполнен!', contractToast, 'emerald');
        } else if (levelToast) {
          soundEngine.playFanfare();
          pushToastInternal('🏆 Новый уровень бизнеса!', levelToast, 'vip');
        }
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
              ? 0.002
              : state.competitor.reputation > 4.25
                ? 0.005
                : 0.008;
          const nextComp: CompetitorState = {
            ...state.competitor,
            carsWashed: state.competitor.carsWashed + 1,
            totalRevenue: state.competitor.totalRevenue + payment,
            reputation: Math.min(4.9, +(state.competitor.reputation + repStep).toFixed(3)),
          };
          return {
            competitor: nextComp,
            empire: {
              ...state.empire,
              districtRivals: {
                ...state.empire.districtRivals,
                [state.empire.activeDistrict]: nextComp,
              },
            },
          };
        });
      },

      onEconomyMinuteTick: (payload) => {
        let rivalToast: string | null = null;
        let bizCompletedToast: string | null = null;

        set((state) => {
          const dtMin = payload.fractionOfMinute;

          // 1. Recurring player wash expenses
          const expBreakdown = calculatePlayerExpensesPerMin({
            workers: state.workers,
            upgrades: state.upgrades,
            adCampaign: state.economy.adCampaign,
            equipmentCondition: state.economy.equipmentCondition,
            empire: state.empire,
            activeEvent: state.activeEvent,
          });

          const salariesCharge = Math.round((expBreakdown.salaries + expBreakdown.specialistSalaries) * dtMin);
          const rentCharge = Math.round(expBreakdown.rent * dtMin);
          const utilCharge = Math.round(expBreakdown.utilities * dtMin + payload.playerWashUtility);
          const maintCharge = Math.round(expBreakdown.maintenance * dtMin);
          const adCharge = Math.round(expBreakdown.ads * dtMin);
          const insCharge = Math.round(expBreakdown.insurance * dtMin);

          // 2. Step auxiliary businesses
          const hasDirector = state.empire.specialists.some(
            (s) => s.role === 'branch_director' && s.hired
          );
          const hasTech = state.empire.specialists.some((s) => s.role === 'technician' && s.hired);
          const hasWarehouse = state.empire.businesses.some(
            (b) => !b.underConstruction && b.type === 'warehouse'
          );
          const hasCarService = state.empire.businesses.some(
            (b) => !b.underConstruction && b.type === 'car_service'
          );
          const hasHoldingProc =
            state.empire.holding.founded && state.empire.holding.centralProcurement;

          let bizRevDelta = 0;
          let bizExpDelta = 0;
          let bizRevPerMin = 0;
          let bizExpPerMin = 0;
          const nextBusinesses = state.empire.businesses.map((b) => {
            const res = stepOwnedBusiness(
              b,
              state.empire.weather,
              hasDirector,
              hasWarehouse,
              hasCarService,
              hasHoldingProc,
              hasTech,
              dtMin
            );
            bizRevDelta += res.revenueDelta;
            bizExpDelta += res.expenseDelta;
            if (!res.next.underConstruction) {
              bizRevPerMin += res.next.revenuePerMin;
              bizExpPerMin += res.next.expensesPerMin;
            }
            if (res.justCompleted) {
              bizCompletedToast = `Предприятие «${b.title}» построено и открыто!`;
            }
            return res.next;
          });

          // 3. Property lease income
          const leasePerMin = state.empire.properties.reduce(
            (sum, p) => sum + (p.leasedOut && !p.underConstruction ? p.leaseIncomePerMin : 0),
            0
          );
          const leaseDelta = Math.round(leasePerMin * dtMin);
          const propertyValueTotal = state.empire.properties.reduce(
            (sum, p) => sum + p.purchasePrice,
            0
          );

          const totalWashExpCharge =
            salariesCharge + rentCharge + utilCharge + maintCharge + adCharge + insCharge;
          const totalCycleExp = totalWashExpCharge + bizExpDelta;
          const totalCycleRev = payload.playerMinuteRev + bizRevDelta + leaseDelta;
          const netCycleProfit = totalCycleRev - totalCycleExp;

          // 4. Tax accrual
          const taxAccrual = calculateTaxAccrual({
            netProfitDelta: netCycleProfit,
            salariesDelta: salariesCharge,
            propertyValueTotal,
            dtMinutes: dtMin,
            sharedAccounting: state.empire.holding.founded && state.empire.holding.sharedAccounting,
          });
          const nextTax = {
            ...state.empire.tax,
            accruedProfitTax: state.empire.tax.accruedProfitTax + taxAccrual.profitTax,
            accruedPayrollTax: state.empire.tax.accruedPayrollTax + taxAccrual.payrollTax,
            accruedPropertyTax: state.empire.tax.accruedPropertyTax + taxAccrual.propertyTax,
          };

          // 5. Autonomous self-sustaining competitor AI step
          const compStep = stepCompetitorEconomy({
            comp: state.competitor,
            playerPrice: state.economy.washPrice,
            playerQuality: payload.playerQuality,
            playerShare: payload.playerShare,
            day: state.day,
            dtMinutes: dtMin,
            revenueEarnedInStep: payload.compMinuteRev,
            carsWashedInStep: payload.compCarsWashed,
          });
          if (compStep.announcement && state.started) {
            rivalToast = compStep.announcement;
          }

          // 6. Real balance (can go into overdraft so losses are felt!)
          const nextBalance = Math.max(
            -150_000,
            state.economy.balance + bizRevDelta + leaseDelta - totalCycleExp
          );

          const instPlayerRevPerMin = Math.round(payload.playerMinuteRev / dtMin) + bizRevPerMin + leasePerMin;
          const totalExpPerMin = expBreakdown.total + bizExpPerMin;
          const smoothedIncome = Math.round(
            state.economy.incomePerMin * 0.45 + instPlayerRevPerMin * 0.55
          );

          // Technician auto-repairs minor wear gently
          const nextCondition =
            hasTech && state.economy.equipmentCondition < 92
              ? Math.min(95, +(state.economy.equipmentCondition + 1.5 * dtMin).toFixed(1))
              : state.economy.equipmentCondition;

          const nextReports = recordLedger(state.empire.reports, {
            enterpriseRevenue: bizRevDelta,
            rentIncome: leaseDelta,
            salaries: salariesCharge,
            utilities: utilCharge,
            rent: rentCharge,
            maintenance: maintCharge + bizExpDelta,
            ads: adCharge,
            insurance: insCharge,
          });

          const nextEmpire: EmpireState = {
            ...state.empire,
            businesses: nextBusinesses,
            tax: {
              ...nextTax,
              auditRisk: computeAuditRisk({
                empire: { ...state.empire, tax: nextTax },
                day: state.day,
                bays: state.upgrades.bays,
                workersCount: state.workers.length,
              }),
            },
            reports: nextReports,
            districtRivals: {
              ...state.empire.districtRivals,
              [state.empire.activeDistrict]: compStep.next,
            },
          };

          const nextHistory = [
            ...state.economy.history.slice(-23),
            {
              minute: Math.round(state.elapsedMinutes * 10) / 10,
              playerRev: smoothedIncome,
              compRev: compStep.next.revenuePerMin,
              balance: nextBalance,
            },
          ];

          return {
            economy: {
              ...state.economy,
              balance: nextBalance,
              totalRevenue: state.economy.totalRevenue + bizRevDelta + leaseDelta,
              totalExpenses: state.economy.totalExpenses + totalCycleExp,
              dailyRevenue: state.economy.dailyRevenue + bizRevDelta + leaseDelta,
              dailyExpenses: (state.economy.dailyExpenses ?? 0) + totalCycleExp,
              incomePerMin: smoothedIncome,
              expensesPerMin: totalExpPerMin,
              profitPerMin: smoothedIncome - totalExpPerMin,
              equipmentCondition: nextCondition,
              history: nextHistory,
            },
            competitor: compStep.next,
            empire: nextEmpire,
          };
        });

        if (bizCompletedToast) {
          soundEngine.playFanfare();
          pushToastInternal('🏗 Стройка завершена', bizCompletedToast, 'emerald');
        } else if (rivalToast) {
          pushToastInternal(rivalToast, undefined, 'coral');
        }
      },

      onTimeAdvance: (newTimeOfDay, minuteDelta, dtSec) => {
        set((state) => {
          const hasTimers =
            state.economy.happyHourRemaining > 0 ||
            state.economy.happyHourCooldown > 0 ||
            state.economy.adBoostRemaining > 0 ||
            state.economy.adGrantCooldown > 0;
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
              adBoostRemaining: Math.max(0, (state.economy.adBoostRemaining ?? 0) - dtSec),
              adGrantCooldown: Math.max(0, (state.economy.adGrantCooldown ?? 0) - dtSec),
            },
          };
        });
      },

      onShiftComplete: () => {
        const s = get();
        soundEngine.playFanfare();
        const rev = s.economy.dailyRevenue;
        const exp = s.economy.dailyExpenses ?? 0;
        const taxes = s.economy.dailyTaxes ?? 0;
        set({
          paused: true,
          activePanel: null,
          selection: null,
          shiftSummary: {
            day: s.day,
            carsWashed: s.economy.dailyCars,
            revenue: rev,
            expenses: exp,
            taxes,
            profit: rev - exp - taxes,
            bestCombo: s.economy.bestCombo,
          },
        });
        get().saveNow();
      },

      onCompetitorUpdate: (patch) => {
        set((state) => {
          const nextComp = { ...state.competitor, ...patch };
          return {
            competitor: nextComp,
            empire: {
              ...state.empire,
              districtRivals: {
                ...state.empire.districtRivals,
                [state.empire.activeDistrict]: nextComp,
              },
            },
          };
        });
      },

      onCityEventUpdate: (event) => {
        set({ activeEvent: event });
      },

      onWeatherChange: (weather: WeatherType) => {
        set((state) => ({
          empire: { ...state.empire, weather },
        }));
      },

      onTriggerTaxAudit: () => {
        const s = get();
        const result = evaluateTaxAudit({
          empire: s.empire,
          day: s.day,
          workersCount: s.workers.length,
        });
        if (!result) {
          pushToastInternal('🏛 Налоговая проверка пройдена!', 'Все документы в порядке — штрафов нет', 'emerald');
          return;
        }
        soundEngine.playError();
        set((state) => ({
          economy: {
            ...state.economy,
            balance: state.economy.balance - result.fine,
            totalExpenses: state.economy.totalExpenses + result.fine,
            dailyExpenses: state.economy.dailyExpenses + result.fine,
          },
          empire: {
            ...state.empire,
            reports: recordLedger(state.empire.reports, { fines: result.fine }),
            tax: {
              ...state.empire.tax,
              history: [
                {
                  id: `fine-${Date.now()}`,
                  day: state.day,
                  kind: 'fine' as const,
                  amount: result.fine,
                  reason: result.reason,
                  paid: true,
                },
                ...state.empire.tax.history.slice(0, 19),
              ],
            },
          },
        }));
        pushToastInternal(
          `🏛 Штраф налоговой: -${formatRub(result.fine)}`,
          result.reason,
          'coral'
        );
      },

      onToast: (title, subtitle, tone) => {
        pushToastInternal(title, subtitle, tone);
      },

      onEntityListChanged: () => {
        set((state) => ({ entityVersion: state.entityVersion + 1 }));
      },
    });
  };

  const initialEmpire = saved?.empire
    ? { ...createInitialEmpire(), ...saved.empire }
    : createInitialEmpire();
  const initialComp =
    saved?.competitor ?? initialEmpire.districtRivals[initialEmpire.activeDistrict];
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
    candidates: generateHireCandidates(4, saved?.economy.reputation ?? 3.25),
    competitor: initialComp,
    empire: initialEmpire,
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
      const freshEmpire = createInitialEmpire();
      const freshComp = freshEmpire.districtRivals.residential;
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
        empire: freshEmpire,
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
        const restoredEmpire: EmpireState = { ...createInitialEmpire(), ...data.empire };
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
          competitor: data.competitor ?? restoredEmpire.districtRivals[restoredEmpire.activeDistrict],
          empire: restoredEmpire,
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
      const prevSummary = get().shiftSummary;
      const shouldShowInterstitial =
        prevSummary && !prevSummary.doubledByAd && prevSummary.day >= 1 && prevSummary.day % 2 === 1;

      gameSimulation.startNewShift();

      set((state) => {
        const nextDay = state.day + 1;
        const hasAccountant = state.empire.specialists.some(
          (s) => s.role === 'accountant' && s.hired
        );
        const hasTech = state.empire.specialists.some((s) => s.role === 'technician' && s.hired);

        // 1. Process bank loan daily payments
        let loanPaidTotal = 0;
        let loanInterestTotal = 0;
        let creditScore = state.empire.bank.creditScore;
        let balance = state.economy.balance;
        const nextLoans = state.empire.bank.loans
          .map((loan) => {
            const payment = Math.min(loan.remaining, loan.paymentPerDay);
            const interestPart = Math.round(payment * 0.25);
            if (balance >= payment) {
              balance -= payment;
              loanPaidTotal += payment;
              loanInterestTotal += interestPart;
              creditScore = Math.min(850, creditScore + 4);
              return {
                ...loan,
                remaining: Math.max(0, loan.remaining - payment),
                daysLeft: Math.max(0, loan.daysLeft - 1),
              };
            } else {
              creditScore = Math.max(300, creditScore - 18);
              return {
                ...loan,
                missedPayments: loan.missedPayments + 1,
                daysLeft: Math.max(0, loan.daysLeft - 1),
              };
            }
          })
          .filter((l) => l.remaining > 0);

        // 2. Process corporate contract daily deadlines
        let contractPenaltyTotal = 0;
        const nextContracts = state.empire.contracts.map((c) => {
          if (!c.active) return c;
          const left = c.daysLeft - 1;
          if (left <= 0) {
            balance -= c.penalty;
            contractPenaltyTotal += c.penalty;
            return { ...c, completedCars: 0, daysLeft: c.daysTotal, active: false };
          }
          return { ...c, daysLeft: left };
        });

        // 3. Process taxes overnight
        let nextTax = { ...state.empire.tax };
        const totalAccrued =
          nextTax.accruedProfitTax + nextTax.accruedPayrollTax + nextTax.accruedPropertyTax;
        if (hasAccountant) {
          nextTax.lastFilingDay = nextDay;
        } else if (nextDay - nextTax.lastFilingDay >= 3 && totalAccrued > 0) {
          nextTax.overdueAmount += Math.round(totalAccrued * 0.5);
        }

        // 4. Roll financial report periods cleanly
        let nextReports = recordLedger(state.empire.reports, {
          loanInterest: loanInterestTotal,
          fines: contractPenaltyTotal,
        });
        nextReports = {
          today: createEmptyPeriodBucket(),
          week: nextDay % 7 === 1 ? createEmptyPeriodBucket() : nextReports.week,
          month: nextDay % 30 === 1 ? createEmptyPeriodBucket() : nextReports.month,
          year: nextDay % 365 === 1 ? createEmptyPeriodBucket() : nextReports.year,
        };

        // 5. Overnight worker rest & technician maintenance
        const nextWorkers = state.workers.map((w) => ({
          ...w,
          fatigue: Math.max(0, +(w.fatigue - 55).toFixed(1)),
        }));
        const nextCondition = hasTech
          ? Math.min(100, +(state.economy.equipmentCondition + 18).toFixed(1))
          : state.economy.equipmentCondition;

        // 6. Pick new day's weather
        const weathers: WeatherType[] = ['sunny', 'sunny', 'after_rain', 'rain', 'mud_season', 'snow'];
        const nextWeather = weathers[(nextDay * 3 + Math.floor(Math.random() * 2)) % weathers.length];

        return {
          day: nextDay,
          timeOfDay: SHIFT_START_TIME,
          paused: false,
          shiftSummary: null,
          workers: nextWorkers,
          economy: {
            ...state.economy,
            balance,
            totalExpenses: state.economy.totalExpenses + loanPaidTotal + contractPenaltyTotal,
            dailyRevenue: 0,
            dailyExpenses: 0,
            dailyTaxes: 0,
            dailyCars: 0,
            equipmentCondition: nextCondition,
          },
          empire: {
            ...state.empire,
            weather: nextWeather,
            contracts: nextContracts,
            tax: {
              ...nextTax,
              auditRisk: computeAuditRisk({
                empire: { ...state.empire, tax: nextTax },
                day: nextDay,
                bays: state.upgrades.bays,
                workersCount: nextWorkers.length,
              }),
            },
            bank: {
              ...state.empire.bank,
              creditScore,
              loans: nextLoans,
            },
            reports: nextReports,
          },
        };
      });
      get().saveNow();
      if (shouldShowInterstitial) {
        void adService.showFullscreenAd({
          title: 'Рекламная пауза (Яндекс Игры • Interstitial)',
          onPauseGame: (p) => set({ paused: p }),
        });
      }
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
          happyHourCooldown: 120,
        },
      }));
      pushToastInternal('⚡ Счастливый час: 30 сек', '-15% цена, +15% скорость', 'amber');
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
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance + def.reward,
            totalRevenue: state.economy.totalRevenue + def.reward,
            dailyRevenue: state.economy.dailyRevenue + def.reward,
          },
          state.empire,
          120
        );
        return {
          claimedQuestIds: [...state.claimedQuestIds, questId],
          economy: xpRes.eco,
          empire: xpRes.empire,
        };
      });
      pushToastInternal(`🎯 ${def.title}: ${formatRub(def.reward, { signed: true })}`, undefined, 'emerald');
      get().saveNow();
      return true;
    },

    watchRewardedSponsorAd: async () => {
      const s = get();
      if ((s.economy.adGrantCooldown ?? 0) > 0) {
        soundEngine.playError();
        return false;
      }
      const grantAmount = Math.round(7_000 + s.economy.entrepreneurLevel * 1_500 + s.upgrades.bays * 2_000);
      const wasPaused = s.paused;
      const rewarded = await adService.showRewardedVideo({
        title: 'Спонсорский грант (Rewarded Video)',
        rewardLabel: `+${formatRub(grantAmount)} + мгновенный ремонт`,
        onPauseGame: (p) => set({ paused: p ? true : wasPaused }),
      });
      if (!rewarded) return false;

      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance + grantAmount,
          totalRevenue: state.economy.totalRevenue + grantAmount,
          dailyRevenue: state.economy.dailyRevenue + grantAmount,
          equipmentCondition: 100,
          adGrantCooldown: 90,
        },
        workers: state.workers.map((w) => ({ ...w, fatigue: Math.max(0, w.fatigue - 35) })),
      }));
      pushToastInternal(
        `📺 Спонсорский грант: +${formatRub(grantAmount)}`,
        'Оборудование отремонтировано до 100%',
        'vip'
      );
      get().saveNow();
      return true;
    },

    watchRewardedTurboAd: async () => {
      const s = get();
      if ((s.economy.adBoostRemaining ?? 0) > 0) {
        soundEngine.playError();
        return false;
      }
      const wasPaused = s.paused;
      const rewarded = await adService.showRewardedVideo({
        title: 'VIP-кортеж и ×1.5 Турбо-мойка (Rewarded Video)',
        rewardLabel: '45 сек: скорость мойки +50% + волна VIP-клиентов',
        onPauseGame: (p) => set({ paused: p ? true : wasPaused }),
      });
      if (!rewarded) return false;

      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          adBoostRemaining: 45,
          happyHourRemaining: Math.max(state.economy.happyHourRemaining, 35),
        },
        activeEvent: {
          id: 'vip_convoy',
          remainingSec: 36,
          totalSec: 36,
        },
      }));
      pushToastInternal(
        '👑 VIP-кортеж + Турбо-буст (45 сек)!',
        'Скорость мойки +50% и поток золотых VIP-авто',
        'vip'
      );
      return true;
    },

    watchRewardedDoubleShiftAd: async () => {
      const s = get();
      if (!s.shiftSummary || s.shiftSummary.doubledByAd) return false;
      const bonus = Math.max(4_500, Math.round(Math.max(s.shiftSummary.profit, s.shiftSummary.revenue * 0.45)));
      const rewarded = await adService.showRewardedVideo({
        title: 'Удвоение выручки смены (Rewarded Video)',
        rewardLabel: `+${formatRub(bonus)} к кассе за смену`,
        onPauseGame: () => {
          // Shift modal already keeps simulation paused
        },
      });
      if (!rewarded) return false;

      soundEngine.playFanfare();
      set((state) => {
        if (!state.shiftSummary) return {};
        return {
          economy: {
            ...state.economy,
            balance: state.economy.balance + bonus,
            totalRevenue: state.economy.totalRevenue + bonus,
          },
          shiftSummary: {
            ...state.shiftSummary,
            revenue: state.shiftSummary.revenue + bonus,
            profit: state.shiftSummary.profit + bonus,
            doubledByAd: true,
          },
        };
      });
      pushToastInternal(`📺 Бонус смены ×2: +${formatRub(bonus)}!`, 'Зачислено на баланс компании', 'vip');
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
          pushToastInternal(`🎓 Бонус обучения ${formatRub(TUTORIAL_BONUS, { signed: true })}`, undefined, 'emerald');
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
        const exp = calculatePlayerExpensesPerMin({
          workers: s.workers,
          upgrades: s.upgrades,
          adCampaign: id,
          equipmentCondition: s.economy.equipmentCondition,
          empire: s.empire,
          activeEvent: s.activeEvent,
        });
        return {
          economy: {
            ...s.economy,
            adCampaign: id,
            expensesPerMin: exp.total,
            profitPerMin: s.economy.incomePerMin - exp.total,
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

      // Enforce construction permits for Bay #2, #3, #4
      if (key === 'bays') {
        const nextBay = currentLv + 1;
        const permitKey: DocumentId | null =
          nextBay === 2 ? 'bay_permit_2' : nextBay === 3 ? 'bay_permit_3' : nextBay === 4 ? 'bay_permit_4' : null;
        if (permitKey && !state.empire.tax.documents[permitKey]) {
          soundEngine.playError();
          pushToastInternal(
            `Требуется разрешение на Бокс #${nextBay}`,
            'Оформите его в разделе Бизнес → Налоги',
            'amber'
          );
          return false;
        }
      }

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
      const repBoost = key === 'vipLounge' ? 0.18 : key === 'bays' ? 0.14 : 0.05;
      const exp = calculatePlayerExpensesPerMin({
        workers: state.workers,
        upgrades: nextUpgrades,
        adCampaign: state.economy.adCampaign,
        equipmentCondition: state.economy.equipmentCondition,
        empire: state.empire,
        activeEvent: state.activeEvent,
      });

      const autoAdvance = state.tutorialActive && state.tutorialStep === 2;
      const xpRes = grantEntrepreneurXp(
        {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
          reputation: Math.min(5.0, +(state.economy.reputation + repBoost).toFixed(2)),
          expensesPerMin: exp.total,
          profitPerMin: state.economy.incomePerMin - exp.total,
        },
        {
          ...state.empire,
          reports: recordLedger(state.empire.reports, { upgrades: cost }),
        },
        key === 'bays' ? 220 : 85
      );

      set({
        upgrades: nextUpgrades,
        tutorialStep: autoAdvance ? 3 : state.tutorialStep,
        economy: xpRes.eco,
        empire: xpRes.empire,
      });
      get().saveNow();
      return true;
    },

    repairEquipment: () => {
      const s = get();
      const missing = Math.max(0, 100 - s.economy.equipmentCondition);
      if (missing < 2) return false;
      const hasCarService = s.empire.businesses.some(
        (b) => !b.underConstruction && b.type === 'car_service'
      );
      const cost = Math.round(missing * 65 * s.upgrades.bays * (hasCarService ? 0.8 : 1.0));
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playUpgrade();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
          dailyExpenses: state.economy.dailyExpenses + cost,
          equipmentCondition: 100,
        },
        empire: {
          ...state.empire,
          reports: recordLedger(state.empire.reports, { maintenance: cost }),
        },
      }));
      pushToastInternal('🔧 Оборудование отремонтировано (100%)', `-${formatRub(cost)}`, 'emerald');
      get().saveNow();
      return true;
    },

    unlockWashTech: (techId) => {
      const s = get();
      if (s.economy.unlockedWashTechs.includes(techId)) return false;
      const spec = WASH_TECHNOLOGIES[techId];
      if (!spec) return false;
      if (s.economy.entrepreneurLevel < spec.unlockLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${spec.unlockLevel}`, undefined, 'amber');
        return false;
      }
      if (s.economy.balance < spec.unlockCost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - spec.unlockCost,
            totalExpenses: state.economy.totalExpenses + spec.unlockCost,
            unlockedWashTechs: [...state.economy.unlockedWashTechs, techId],
            activeWashTech: techId,
          },
          {
            ...state.empire,
            reports: recordLedger(state.empire.reports, { upgrades: spec.unlockCost }),
          },
          180
        );
        return { economy: xpRes.eco, empire: xpRes.empire };
      });
      pushToastInternal(`✨ Технология: ${spec.title}`, 'Активирована в боксах', 'cyan');
      get().saveNow();
      return true;
    },

    selectWashTech: (techId) => {
      const s = get();
      if (!s.economy.unlockedWashTechs.includes(techId)) return false;
      const spec = WASH_TECHNOLOGIES[techId];
      if (s.workers.length < spec.minWorkers) {
        soundEngine.playError();
        pushToastInternal(`Нужно минимум ${spec.minWorkers} мойщика`, undefined, 'amber');
        return false;
      }
      soundEngine.playClick();
      set((state) => ({
        economy: { ...state.economy, activeWashTech: techId },
      }));
      return true;
    },

    buyResearch: (researchId) => {
      const s = get();
      if (s.empire.unlockedResearchIds.includes(researchId)) return false;
      const spec = RESEARCH_TREE.find((r) => r.id === researchId);
      if (!spec) return false;
      if (s.economy.entrepreneurLevel < spec.unlockLevel) {
        soundEngine.playError();
        return false;
      }
      if (spec.requires && !s.empire.unlockedResearchIds.includes(spec.requires)) {
        soundEngine.playError();
        return false;
      }
      if (s.economy.balance < spec.cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - spec.cost,
            totalExpenses: state.economy.totalExpenses + spec.cost,
          },
          {
            ...state.empire,
            unlockedResearchIds: [...state.empire.unlockedResearchIds, researchId],
            reports: recordLedger(state.empire.reports, { upgrades: spec.cost }),
          },
          210
        );
        return { economy: xpRes.eco, empire: xpRes.empire };
      });
      pushToastInternal(`🔬 Исследование: ${spec.title}`, spec.effectSummary, 'cyan');
      get().saveNow();
      return true;
    },

    buyDocument: (docId) => {
      const s = get();
      if (s.empire.tax.documents[docId]) return false;
      const spec = DOCUMENTS_CATALOG.find((d) => d.id === docId);
      if (!spec) return false;
      if (s.economy.entrepreneurLevel < spec.unlockLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${spec.unlockLevel}`, undefined, 'amber');
        return false;
      }
      if (s.economy.balance < spec.cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playUpgrade();
      set((state) => {
        const nextDocs = { ...state.empire.tax.documents, [docId]: true };
        const nextTax = { ...state.empire.tax, documents: nextDocs };
        const nextEmpire: EmpireState = {
          ...state.empire,
          tax: {
            ...nextTax,
            auditRisk: computeAuditRisk({
              empire: { ...state.empire, tax: nextTax },
              day: state.day,
              bays: state.upgrades.bays,
              workersCount: state.workers.length,
            }),
          },
          reports: recordLedger(state.empire.reports, { upgrades: spec.cost }),
        };
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - spec.cost,
            totalExpenses: state.economy.totalExpenses + spec.cost,
          },
          nextEmpire,
          70
        );
        return { economy: xpRes.eco, empire: xpRes.empire };
      });
      pushToastInternal(`📄 Оформлено: ${spec.title}`, undefined, 'emerald');
      get().saveNow();
      return true;
    },

    payTaxes: () => {
      const s = get();
      const tax = s.empire.tax;
      const total =
        tax.accruedProfitTax + tax.accruedPayrollTax + tax.accruedPropertyTax + tax.overdueAmount;
      if (total <= 0) return false;
      if (s.economy.balance < total) {
        soundEngine.playError();
        pushToastInternal('Недостаточно средств для уплаты налогов', formatRub(total), 'coral');
        return false;
      }
      soundEngine.playCash();
      set((state) => {
        const nextTax = {
          ...state.empire.tax,
          accruedProfitTax: 0,
          accruedPayrollTax: 0,
          accruedPropertyTax: 0,
          overdueAmount: 0,
          lastFilingDay: state.day,
          history: [
            {
              id: `tax-${Date.now()}`,
              day: state.day,
              kind: 'profit' as const,
              amount: total,
              reason: 'Уплата налогов (прибыль, ФОТ, имущество)',
              paid: true,
            },
            ...state.empire.tax.history.slice(0, 19),
          ],
        };
        return {
          economy: {
            ...state.economy,
            balance: state.economy.balance - total,
            totalExpenses: state.economy.totalExpenses + total,
            dailyTaxes: (state.economy.dailyTaxes ?? 0) + total,
          },
          empire: {
            ...state.empire,
            tax: {
              ...nextTax,
              auditRisk: computeAuditRisk({
                empire: { ...state.empire, tax: nextTax },
                day: state.day,
                bays: state.upgrades.bays,
                workersCount: state.workers.length,
              }),
            },
            reports: recordLedger(state.empire.reports, { taxes: total }),
          },
        };
      });
      pushToastInternal('🏛 Налоги оплачены', `-${formatRub(total)}`, 'emerald');
      get().saveNow();
      return true;
    },

    fileTaxDeclaration: () => {
      soundEngine.playClick();
      set((state) => {
        const nextTax = { ...state.empire.tax, lastFilingDay: state.day };
        return {
          empire: {
            ...state.empire,
            tax: {
              ...nextTax,
              auditRisk: computeAuditRisk({
                empire: { ...state.empire, tax: nextTax },
                day: state.day,
                bays: state.upgrades.bays,
                workersCount: state.workers.length,
              }),
            },
          },
        };
      });
      pushToastInternal('📑 Декларация подана в ФНС', 'Риск проверки снижен', 'cyan');
      get().saveNow();
      return true;
    },

    takeLoan: (productIndex) => {
      const s = get();
      const prod = LOAN_PRODUCTS[productIndex];
      if (!prod) return false;
      if (s.economy.entrepreneurLevel < prod.minLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${prod.minLevel}`, undefined, 'amber');
        return false;
      }
      if (s.empire.bank.creditScore < prod.minCreditScore) {
        soundEngine.playError();
        pushToastInternal(`Нужен кредитный рейтинг ${prod.minCreditScore}+`, undefined, 'coral');
        return false;
      }
      if (s.empire.bank.loans.length >= 3) {
        soundEngine.playError();
        pushToastInternal('Максимум 3 активных кредита', undefined, 'amber');
        return false;
      }
      soundEngine.playCash();
      const totalRepay = Math.round(prod.amount * (1 + prod.annualRate * (prod.days / 30)));
      const paymentPerDay = Math.ceil(totalRepay / prod.days);
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance + prod.amount,
        },
        empire: {
          ...state.empire,
          bank: {
            ...state.empire.bank,
            loans: [
              ...state.empire.bank.loans,
              {
                id: `loan-${Date.now()}`,
                kind: prod.kind,
                title: prod.title,
                principal: prod.amount,
                remaining: totalRepay,
                annualRate: prod.annualRate,
                paymentPerDay,
                daysLeft: prod.days,
                missedPayments: 0,
              },
            ],
          },
        },
      }));
      pushToastInternal(`🏦 Кредит одобрен: +${formatRub(prod.amount)}`, `Платёж ${formatRub(paymentPerDay)}/день`, 'cyan');
      get().saveNow();
      return true;
    },

    repayLoan: (loanId) => {
      const s = get();
      const loan = s.empire.bank.loans.find((l) => l.id === loanId);
      if (!loan) return false;
      if (s.economy.balance < loan.remaining) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - loan.remaining,
        },
        empire: {
          ...state.empire,
          bank: {
            ...state.empire.bank,
            creditScore: Math.min(850, state.empire.bank.creditScore + 18),
            loans: state.empire.bank.loans.filter((l) => l.id !== loanId),
          },
        },
      }));
      pushToastInternal('🏦 Кредит полностью погашен!', 'Кредитный рейтинг +18', 'emerald');
      get().saveNow();
      return true;
    },

    toggleInsurance: () => {
      soundEngine.playClick();
      set((state) => ({
        empire: {
          ...state.empire,
          bank: {
            ...state.empire.bank,
            insuranceActive: !state.empire.bank.insuranceActive,
          },
        },
      }));
      get().saveNow();
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
        fatigue: 0,
        level: cand.level,
        xp: 0,
        xpToNext: Math.round(100 * Math.pow(1.35, cand.level - 1)),
        assignedBay: -1,
        carsWashed: 0,
      };

      const nextWorkers = [...state.workers, newWorker];
      const nextCandidates = state.candidates.filter((c) => c.id !== candidateId);
      const exp = calculatePlayerExpensesPerMin({
        workers: nextWorkers,
        upgrades: state.upgrades,
        adCampaign: state.economy.adCampaign,
        equipmentCondition: state.economy.equipmentCondition,
        empire: state.empire,
        activeEvent: state.activeEvent,
      });

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
          expensesPerMin: exp.total,
          profitPerMin: state.economy.incomePerMin - exp.total,
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
      const exp = calculatePlayerExpensesPerMin({
        workers: nextWorkers,
        upgrades: state.upgrades,
        adCampaign: state.economy.adCampaign,
        equipmentCondition: state.economy.equipmentCondition,
        empire: state.empire,
        activeEvent: state.activeEvent,
      });

      set({
        workers: nextWorkers,
        selection:
          state.selection?.type === 'worker' && state.selection.id === workerId
            ? null
            : state.selection,
        economy: {
          ...state.economy,
          expensesPerMin: exp.total,
          profitPerMin: state.economy.incomePerMin - exp.total,
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
      const exp = calculatePlayerExpensesPerMin({
        workers: nextWorkers,
        upgrades: state.upgrades,
        adCampaign: state.economy.adCampaign,
        equipmentCondition: state.economy.equipmentCondition,
        empire: state.empire,
        activeEvent: state.activeEvent,
      });

      const rt = gameSimulation.workerRuntimes.get(workerId);
      if (rt) {
        gameSimulation.addPopup(rt.x, 2.4, rt.z, '+МОРАЛЬ', '#FFB800');
      }

      set({
        workers: nextWorkers,
        economy: {
          ...state.economy,
          expensesPerMin: exp.total,
          profitPerMin: state.economy.incomePerMin - exp.total,
        },
      });
      get().saveNow();
      return true;
    },

    restWorkers: () => {
      const s = get();
      const cost = s.workers.length * 600;
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playUpgrade();
      set((state) => ({
        workers: state.workers.map((w) => ({ ...w, fatigue: 0 })),
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
        },
      }));
      pushToastInternal('☕ Перерыв и кофе для команды', 'Усталость сброшена до 0%', 'emerald');
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

    hireSpecialist: (role) => {
      const s = get();
      const spec = SPECIALIST_CATALOG.find((x) => x.role === role);
      const existing = s.empire.specialists.find((x) => x.role === role);
      if (!spec || !existing || existing.hired) return false;
      if (s.economy.entrepreneurLevel < spec.unlockLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${spec.unlockLevel}`, undefined, 'amber');
        return false;
      }
      if (s.economy.balance < spec.hireCost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - spec.hireCost,
          totalExpenses: state.economy.totalExpenses + spec.hireCost,
        },
        empire: {
          ...state.empire,
          specialists: state.empire.specialists.map((x) =>
            x.role === role ? { ...x, hired: true } : x
          ),
        },
      }));
      pushToastInternal(`👔 Нанят: ${spec.title}`, spec.defaultName, 'emerald');
      get().saveNow();
      return true;
    },

    fireSpecialist: (role) => {
      soundEngine.playClick();
      set((state) => ({
        empire: {
          ...state.empire,
          specialists: state.empire.specialists.map((x) =>
            x.role === role ? { ...x, hired: false } : x
          ),
        },
      }));
      get().saveNow();
      return true;
    },

    unlockDistrict: (districtId) => {
      const s = get();
      if (s.empire.unlockedDistricts.includes(districtId)) return false;
      const d = DISTRICTS[districtId];
      if (!d) return false;
      if (s.economy.entrepreneurLevel < d.unlockLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${d.unlockLevel}`, undefined, 'amber');
        return false;
      }
      if (s.economy.balance < d.unlockCost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - d.unlockCost,
            totalExpenses: state.economy.totalExpenses + d.unlockCost,
          },
          {
            ...state.empire,
            unlockedDistricts: [...state.empire.unlockedDistricts, districtId],
            activeDistrict: districtId,
            reports: recordLedger(state.empire.reports, { upgrades: d.unlockCost }),
          },
          420
        );
        return {
          economy: xpRes.eco,
          empire: xpRes.empire,
          competitor: xpRes.empire.districtRivals[districtId],
        };
      });
      pushToastInternal(`🏙 Открыт район: ${d.name}`, `Конкурент: ${d.rivalName}`, 'vip');
      get().saveNow();
      return true;
    },

    switchDistrict: (districtId) => {
      const s = get();
      if (!s.empire.unlockedDistricts.includes(districtId)) return false;
      soundEngine.playClick();
      set((state) => ({
        empire: { ...state.empire, activeDistrict: districtId },
        competitor: state.empire.districtRivals[districtId],
      }));
      gameSimulation.syncWorkerRuntimes();
      return true;
    },

    buyProperty: (districtId, kind) => {
      const s = get();
      if (!s.empire.unlockedDistricts.includes(districtId)) return false;
      const d = DISTRICTS[districtId];
      const cost = kind === 'land' ? d.landPrice : d.buildingPrice;
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      const prop: OwnedProperty = {
        id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        districtId,
        title: `${kind === 'land' ? 'Участок' : 'Коммерческое здание'} (${d.name})`,
        kind,
        purchasePrice: cost,
        monthlyRent: d.rentPerMin,
        leasedOut: false,
        leaseIncomePerMin: Math.round(cost * 0.0045),
        buildingLevel: kind === 'building' ? 1 : 0,
        underConstruction: false,
        constructionMinutesLeft: 0,
        attachedBusinessId: null,
      };
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - cost,
            totalExpenses: state.economy.totalExpenses + cost,
          },
          {
            ...state.empire,
            properties: [...state.empire.properties, prop],
            reports: recordLedger(state.empire.reports, { upgrades: cost }),
          },
          260
        );
        return { economy: xpRes.eco, empire: xpRes.empire };
      });
      pushToastInternal(`🏢 Куплено: ${prop.title}`, undefined, 'emerald');
      get().saveNow();
      return true;
    },

    toggleLeaseProperty: (propertyId) => {
      soundEngine.playClick();
      set((state) => ({
        empire: {
          ...state.empire,
          properties: state.empire.properties.map((p) =>
            p.id === propertyId ? { ...p, leasedOut: !p.leasedOut } : p
          ),
        },
      }));
      get().saveNow();
      return true;
    },

    sellProperty: (propertyId) => {
      const s = get();
      const prop = s.empire.properties.find((p) => p.id === propertyId);
      if (!prop) return false;
      const saleValue = Math.round(prop.purchasePrice * 0.85);
      soundEngine.playCash();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance + saleValue,
        },
        empire: {
          ...state.empire,
          properties: state.empire.properties.filter((p) => p.id !== propertyId),
        },
      }));
      pushToastInternal(`🏢 Продано: ${prop.title}`, `+${formatRub(saleValue)}`, 'amber');
      get().saveNow();
      return true;
    },

    buildBusiness: (type, districtId) => {
      const s = get();
      const targetDistrict = districtId ?? s.empire.activeDistrict;
      if (!s.empire.unlockedDistricts.includes(targetDistrict)) return false;
      const spec = BUSINESS_TYPES[type];
      if (!spec) return false;
      if (s.economy.entrepreneurLevel < spec.unlockLevel) {
        soundEngine.playError();
        pushToastInternal(`Нужен Уровень ${spec.unlockLevel}`, undefined, 'amber');
        return false;
      }
      if (s.economy.balance < spec.buildCost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      const biz: OwnedBusiness = {
        id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type,
        districtId: targetDistrict,
        title: `${spec.title} (${DISTRICTS[targetDistrict].name})`,
        level: 1,
        staffCount: spec.staffRequired,
        hasManager: false,
        condition: 100,
        priceLevel: 1.0,
        revenuePerMin: 0,
        expensesPerMin: 0,
        profitPerMin: 0,
        totalRevenue: 0,
        totalProfit: 0,
        clientsServed: 0,
        underConstruction: true,
        constructionMinutesLeft: spec.constructionMinutes,
      };
      set((state) => {
        const xpRes = grantEntrepreneurXp(
          {
            ...state.economy,
            balance: state.economy.balance - spec.buildCost,
            totalExpenses: state.economy.totalExpenses + spec.buildCost,
            reputation: Math.min(5.0, +(state.economy.reputation + spec.reputationBoost).toFixed(2)),
          },
          {
            ...state.empire,
            businesses: [...state.empire.businesses, biz],
            reports: recordLedger(state.empire.reports, { upgrades: spec.buildCost }),
          },
          340
        );
        return { economy: xpRes.eco, empire: xpRes.empire };
      });
      pushToastInternal(`🏗 Строится: ${spec.title}`, `Срок: ${spec.constructionMinutes} мин`, 'cyan');
      get().saveNow();
      return true;
    },

    upgradeBusiness: (bizId) => {
      const s = get();
      const biz = s.empire.businesses.find((b) => b.id === bizId);
      if (!biz || biz.underConstruction || biz.level >= 5) return false;
      const spec = BUSINESS_TYPES[biz.type];
      const cost = Math.round(spec.buildCost * 0.65 * Math.pow(1.6, biz.level - 1));
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playUpgrade();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
        },
        empire: {
          ...state.empire,
          businesses: state.empire.businesses.map((b) =>
            b.id === bizId ? { ...b, level: b.level + 1, condition: 100 } : b
          ),
          reports: recordLedger(state.empire.reports, { upgrades: cost }),
        },
      }));
      get().saveNow();
      return true;
    },

    repairBusiness: (bizId) => {
      const s = get();
      const biz = s.empire.businesses.find((b) => b.id === bizId);
      if (!biz || biz.underConstruction || biz.condition >= 98) return false;
      const cost = Math.round((100 - biz.condition) * 180);
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playUpgrade();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
        },
        empire: {
          ...state.empire,
          businesses: state.empire.businesses.map((b) =>
            b.id === bizId ? { ...b, condition: 100 } : b
          ),
          reports: recordLedger(state.empire.reports, { maintenance: cost }),
        },
      }));
      return true;
    },

    acceptContract: (contractId) => {
      const s = get();
      const c = s.empire.contracts.find((x) => x.id === contractId);
      if (!c || c.active) return false;
      const activeCount = s.empire.contracts.filter((x) => x.active).length;
      if (activeCount >= 2) {
        soundEngine.playError();
        pushToastInternal('Максимум 2 активных контракта', undefined, 'amber');
        return false;
      }
      const totalBranches = 1 + s.empire.businesses.filter((b) => !b.underConstruction).length;
      if (s.workers.length < c.minStaff || totalBranches < c.minBranches) {
        soundEngine.playError();
        pushToastInternal(
          `Нужно ${c.minStaff} мойщиков и ${c.minBranches} филиала`,
          undefined,
          'amber'
        );
        return false;
      }
      soundEngine.playFanfare();
      set((state) => ({
        empire: {
          ...state.empire,
          contracts: state.empire.contracts.map((x) =>
            x.id === contractId ? { ...x, active: true, completedCars: 0, daysLeft: x.daysTotal } : x
          ),
        },
      }));
      pushToastInternal(`📋 Контракт принят: ${c.clientName}`, `${c.requiredCars} авто за ${c.daysTotal} дн.`, 'cyan');
      get().saveNow();
      return true;
    },

    foundHolding: (name) => {
      const s = get();
      if (s.empire.holding.founded) return false;
      const cost = 450_000;
      if (!s.empire.unlockedResearchIds.includes('holding_charter')) {
        soundEngine.playError();
        pushToastInternal('Изучите «Устав бизнес-холдинга»', undefined, 'amber');
        return false;
      }
      if (s.economy.balance < cost) {
        soundEngine.playError();
        return false;
      }
      soundEngine.playFanfare();
      set((state) => ({
        economy: {
          ...state.economy,
          balance: state.economy.balance - cost,
          totalExpenses: state.economy.totalExpenses + cost,
        },
        empire: {
          ...state.empire,
          holding: {
            ...state.empire.holding,
            founded: true,
            name: name?.trim() || 'AUTOMOIKA HOLDING',
            centralProcurement: true,
            sharedAccounting: true,
          },
        },
      }));
      pushToastInternal('👑 Холдинг основан!', '-6% расходы, -3% налог на прибыль', 'vip');
      get().saveNow();
      return true;
    },

    toggleHoldingProcurement: () => {
      set((s) => ({
        empire: {
          ...s.empire,
          holding: {
            ...s.empire.holding,
            centralProcurement: !s.empire.holding.centralProcurement,
          },
        },
      }));
    },

    toggleHoldingAccounting: () => {
      set((s) => ({
        empire: {
          ...s.empire,
          holding: {
            ...s.empire.holding,
            sharedAccounting: !s.empire.holding.sharedAccounting,
          },
        },
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
        empire: s.empire,
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
