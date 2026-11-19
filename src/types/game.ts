export type OwnerSide = 'player' | 'competitor';

export type VehicleCategory =
  | 'budget'
  | 'sedan'
  | 'hatchback'
  | 'suv'
  | 'sports'
  | 'premium';

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

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type TimeOfDayMode = 'cycle' | 'morning' | 'day' | 'sunset' | 'night';
export type CameraPreset = 'overview' | 'player' | 'competitor' | 'street';
export type ActivePanel =
  | null
  | 'business'
  | 'staff'
  | 'upgrades'
  | 'competitor'
  | 'settings';

export type AdCampaignId = 'none' | 'flyers' | 'billboard' | 'radio';
export type CityEventId = 'rain_aftermath' | 'rush_hour' | 'car_blogger' | 'vip_convoy';

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
  profit: number;
  bestCombo: number;
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
  modelName: string;
  appearance: VehicleAppearance;
  isVip: boolean;
  lastBoostAt: number;
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
  level: number;
  xp: number;
  xpToNext: number;
  /** -1 = auto assign, 0..3 = specific bay */
  assignedBay: number;
  carsWashed: number;
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
  bays: number;
  price: number;
  quality: number; // 1..5
  speedMultiplier: number;
  reputation: number; // 1..5
  carsWashed: number;
  totalRevenue: number;
  revenuePerMin: number;
  promoActive: boolean;
  promoTimer: number;
  lastUpgradeDay: number;
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
  dailyExpenses?: number;
  dailyCars: number;
  happyHourRemaining: number;
  happyHourCooldown: number;
  history: Array<{
    minute: number;
    playerRev: number;
    compRev: number;
    balance: number;
  }>;
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
  settings: GameSettings;
  claimedQuestIds: string[];
  tutorialCompleted: boolean;
}
