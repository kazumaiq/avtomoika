export type OwnerSide = 'player' | 'competitor';

export type VehicleCategory =
  | 'budget'
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'sports'
  | 'premium';

export type CustomerSegment =
  | 'economy'
  | 'regular'
  | 'loyal'
  | 'premium'
  | 'corporate'
  | 'vip';

export type WeatherType = 'sunny' | 'rain' | 'after_rain' | 'mud_season' | 'snow';

export type WashStage =
  | 'none'
  | 'greeting'
  | 'rinse'
  | 'foam'
  | 'scrub'
  | 'dry'
  | 'done';

export type VehicleState =
  | 'approaching'
  | 'entering'
  | 'queued'
  | 'moving_to_bay'
  | 'washing'
  | 'exiting'
  | 'leaving';

export type WorkerActionState =
  | 'idle'
  | 'walking'
  | 'greeting'
  | 'rinsing'
  | 'foaming'
  | 'scrubbing'
  | 'drying'
  | 'celebrating';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type TimeOfDayMode = 'cycle' | 'morning' | 'day' | 'sunset' | 'night';
export type CameraPreset = 'overview' | 'player' | 'competitor' | 'street';

export type ActivePanel =
  | null
  | 'business'
  | 'empire'
  | 'staff'
  | 'upgrades'
  | 'competitor'
  | 'settings';

export type AdCampaignId = 'none' | 'flyers' | 'billboard' | 'radio';

export type CityEventId =
  | 'rain_aftermath'
  | 'rush_hour'
  | 'car_blogger'
  | 'vip_convoy'
  | 'water_hike'
  | 'power_hike'
  | 'equipment_fault'
  | 'weekend_boom'
  | 'seasonal_mud'
  | 'snowfall'
  | 'economic_crisis'
  | 'tax_audit'
  | 'corp_offer';

export type CompetitorStrategy =
  | 'aggressive_price'
  | 'premium_service'
  | 'mass_flow'
  | 'cost_cutting'
  | 'expansion_invest';

export type DistrictId =
  | 'residential'
  | 'industrial'
  | 'suburban'
  | 'downtown'
  | 'business'
  | 'premium';

export type BusinessTypeId =
  | 'car_service'
  | 'tire_shop'
  | 'gas_station'
  | 'cafe'
  | 'auto_parts'
  | 'detailing'
  | 'parking'
  | 'dealership'
  | 'chem_shop'
  | 'warehouse';

export type WashTechId =
  | 'manual'
  | 'touchless'
  | 'automatic_portal'
  | 'dry_cleaning'
  | 'polishing'
  | 'detailing_pro'
  | 'vip_spa'
  | 'truck_wash';

export type SpecialistRole =
  | 'administrator'
  | 'manager'
  | 'accountant'
  | 'branch_director'
  | 'marketer'
  | 'technician';

export type DocumentId =
  | 'business_reg'
  | 'sanitary_permit'
  | 'fire_safety'
  | 'bay_permit_2'
  | 'bay_permit_3'
  | 'bay_permit_4'
  | 'staff_docs'
  | 'lease_contract';

export interface ActiveCityEvent {
  id: CityEventId;
  remainingSec: number;
  totalSec: number;
}

export interface ToastNotification {
  id: string;
  title: string;
  subtitle?: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'coral' | 'vip';
  createdAt: number;
}

export interface ShiftSummary {
  day: number;
  carsWashed: number;
  revenue: number;
  expenses: number;
  taxes: number;
  profit: number;
  bestCombo: number;
  doubledByAd?: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface VehicleAppearance {
  primaryColor: string;
  accentColor: string;
  rimColor: string;
  dirtSeed: number;
}

export interface VehicleEntity {
  id: string;
  owner: OwnerSide;
  category: VehicleCategory;
  segment: CustomerSegment;
  modelName: string;
  appearance: VehicleAppearance;
  isVip: boolean;
  lastBoostAt: number;
  boostCount: number;
  state: VehicleState;
  washStage: WashStage;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  steerAngle: number;
  wheelSpin: number;
  braking: boolean;
  /** 1 = very dirty, 0 = spotless */
  dirtLevel: number;
  /** 0..1 visual foam coverage */
  foamLevel: number;
  /** 0..1 wash completion */
  washProgress: number;
  /** 0..1 patience remaining while queued */
  patience: number;
  queueSlot: number;
  bayIndex: number;
  assignedWorkerId: string | null;
  waypoints: Vec3[];
  waypointIndex: number;
  expectedPrice: number;
  washDuration: number;
  spawnTime: number;
  sparkleTimer: number;
}

export interface WorkerAppearance {
  skinColor: string;
  uniformColor: string;
  vestColor: string;
  hairColor: string;
  hatStyle: 'cap' | 'beanie' | 'none';
  hatColor: string;
  hasGlasses: boolean;
}

export interface WorkerProfile {
  id: string;
  owner: OwnerSide;
  name: string;
  roleTitle: string;
  appearance: WorkerAppearance;
  /** 0.7 - 2.4 wash speed multiplier */
  speed: number;
  /** 0.7 - 2.4 quality / tip multiplier */
  quality: number;
  /** Salary paid per in-game minute (in Rubles) */
  salaryPerMin: number;
  /** Morale 0.5 - 1.35 boosted by raises */
  morale: number;
  /** Fatigue 0..100 (reduces speed when > 65%) */
  fatigue: number;
  level: number;
  xp: number;
  xpToNext: number;
  /** -1 = auto assign, 0..3 = specific bay */
  assignedBay: number;
  carsWashed: number;
}

export interface SpecialistStaff {
  id: string;
  role: SpecialistRole;
  name: string;
  level: number;
  salaryPerMin: number;
  hireCost: number;
  hired: boolean;
}

export interface WorkerRuntime {
  id: string;
  owner: OwnerSide;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  targetX: number;
  targetZ: number;
  action: WorkerActionState;
  activeBay: number;
  activeVehicleId: string | null;
  patrolStep: number;
  patrolTimer: number;
  animPhase: number;
  sprayTarget: Vec3 | null;
}

export interface HireCandidate {
  id: string;
  name: string;
  roleTitle: string;
  appearance: WorkerAppearance;
  speed: number;
  quality: number;
  salaryPerMin: number;
  hireCost: number;
  level: number;
}

export interface UpgradeLevels {
  bays: number; // 1..4
  pressureWasher: number; // 1..5
  foamSystem: number; // 1..5
  dryerWax: number; // 1..5
  ecoSolar: number; // 1..4
  vipLounge: number; // 1..4
  queueLot: number; // 1..3
}

export type UpgradeKey = keyof UpgradeLevels;

export interface UpgradeDefinition {
  key: UpgradeKey;
  title: string;
  subtitle: string;
  category: 'expansion' | 'equipment' | 'facility';
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectLabel: (level: number) => string;
  nextEffectLabel: (nextLevel: number) => string;
}

export interface CompetitorState {
  name: string;
  districtId: DistrictId;
  bays: number;
  staffCount: number;
  price: number;
  quality: number; // 1..5
  speedMultiplier: number;
  reputation: number; // 1..5
  carsWashed: number;
  balance: number;
  totalRevenue: number;
  totalExpenses: number;
  revenuePerMin: number;
  expensesPerMin: number;
  profitPerMin: number;
  avgCheck: number;
  adLevel: number; // 0..3
  strategy: CompetitorStrategy;
  promoActive: boolean;
  promoTimer: number;
  lastUpgradeDay: number;
}

export interface FinancialPeriodBucket {
  washRevenue: number;
  enterpriseRevenue: number;
  contractRevenue: number;
  rentIncome: number;
  salaries: number;
  utilities: number;
  rent: number;
  maintenance: number;
  ads: number;
  taxes: number;
  loanInterest: number;
  insurance: number;
  fines: number;
  upgrades: number;
  carsWashed: number;
}

export interface FinancialReports {
  today: FinancialPeriodBucket;
  week: FinancialPeriodBucket;
  month: FinancialPeriodBucket;
  year: FinancialPeriodBucket;
}

export interface TaxRecord {
  id: string;
  day: number;
  kind: 'profit' | 'property' | 'payroll' | 'fine';
  amount: number;
  reason: string;
  paid: boolean;
}

export interface TaxState {
  accruedProfitTax: number;
  accruedPropertyTax: number;
  accruedPayrollTax: number;
  overdueAmount: number;
  lastFilingDay: number;
  auditRisk: number; // 0..100
  documents: Record<DocumentId, boolean>;
  history: TaxRecord[];
}

export interface LoanItem {
  id: string;
  kind: 'business' | 'mortgage' | 'credit_line';
  title: string;
  principal: number;
  remaining: number;
  annualRate: number; // e.g. 0.16
  paymentPerDay: number;
  daysLeft: number;
  missedPayments: number;
}

export interface BankState {
  creditScore: number; // 300..850
  loans: LoanItem[];
  insuranceActive: boolean;
  insuranceCostPerMin: number;
}

export interface OwnedProperty {
  id: string;
  districtId: DistrictId;
  title: string;
  kind: 'land' | 'leased' | 'building';
  purchasePrice: number;
  monthlyRent: number;
  leasedOut: boolean;
  leaseIncomePerMin: number;
  buildingLevel: number;
  underConstruction: boolean;
  constructionMinutesLeft: number;
  attachedBusinessId: string | null;
}

export interface OwnedBusiness {
  id: string;
  type: BusinessTypeId;
  districtId: DistrictId;
  title: string;
  level: number;
  staffCount: number;
  hasManager: boolean;
  condition: number; // 0..100
  priceLevel: number; // 0.85..1.25
  revenuePerMin: number;
  expensesPerMin: number;
  profitPerMin: number;
  totalRevenue: number;
  totalProfit: number;
  clientsServed: number;
  underConstruction: boolean;
  constructionMinutesLeft: number;
}

export interface CorporateContract {
  id: string;
  clientName: string;
  sector: 'taxi' | 'delivery' | 'courier' | 'fleet' | 'gov' | 'rental';
  requiredCars: number;
  completedCars: number;
  minQuality: number;
  minBranches: number;
  minStaff: number;
  reward: number;
  penalty: number;
  daysTotal: number;
  daysLeft: number;
  active: boolean;
}

export interface HoldingState {
  founded: boolean;
  name: string;
  corporateReserve: number;
  centralProcurement: boolean;
  sharedAccounting: boolean;
  brandSynergyLevel: number;
}

export interface EconomyMetrics {
  balance: number;
  totalRevenue: number;
  totalExpenses: number;
  incomePerMin: number;
  expensesPerMin: number;
  profitPerMin: number;
  carsWashed: number;
  carsLost: number;
  reputation: number; // 1.0 .. 5.0
  washPrice: number; // in Rubles
  adCampaign: AdCampaignId;
  combo: number;
  bestCombo: number;
  dailyRevenue: number;
  dailyExpenses: number;
  dailyTaxes: number;
  dailyCars: number;
  happyHourRemaining: number;
  happyHourCooldown: number;
  /** Rewarded Ad x2 Speed + VIP Convoy boost timer (seconds) */
  adBoostRemaining: number;
  /** Rewarded Ad Sponsor Cash Grant cooldown (seconds) */
  adGrantCooldown: number;
  /** Equipment condition 0..100% */
  equipmentCondition: number;
  /** Active wash technology */
  activeWashTech: WashTechId;
  unlockedWashTechs: WashTechId[];
  /** Entrepreneur progression */
  entrepreneurLevel: number;
  entrepreneurXp: number;
  /** Last wash payout breakdown for full transparency */
  lastPayoutBreakdown: {
    baseTariff: number;
    techBonus: number;
    qualityTip: number;
    comboBonus: number;
    vipBonus: number;
    eventBonus: number;
    total: number;
  } | null;
  history: Array<{
    minute: number;
    playerRev: number;
    compRev: number;
    balance: number;
  }>;
}

export interface EmpireState {
  activeDistrict: DistrictId;
  unlockedDistricts: DistrictId[];
  weather: WeatherType;
  unlockedResearchIds: string[];
  claimedLevelRewards: number[];
  specialists: SpecialistStaff[];
  properties: OwnedProperty[];
  businesses: OwnedBusiness[];
  contracts: CorporateContract[];
  completedContractIds: string[];
  tax: TaxState;
  bank: BankState;
  holding: HoldingState;
  reports: FinancialReports;
  districtRivals: Record<DistrictId, CompetitorState>;
}

export interface GameSettings {
  quality: GraphicsQuality;
  timeMode: TimeOfDayMode;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  showPopups: boolean;
}

export interface FloatingPopup {
  id: string;
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  createdAt: number;
  duration: number;
}

export interface SelectionTarget {
  type: 'vehicle' | 'worker';
  id: string;
}

export interface SavePayload {
  version: number;
  savedAt: number;
  day: number;
  timeOfDay: number;
  elapsedMinutes: number;
  economy: EconomyMetrics;
  upgrades: UpgradeLevels;
  workers: WorkerProfile[];
  competitor: CompetitorState;
  empire: EmpireState;
  settings: GameSettings;
  claimedQuestIds: string[];
  tutorialCompleted: boolean;
}
