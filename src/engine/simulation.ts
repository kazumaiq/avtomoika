import { soundEngine } from '../audio/soundEngine';
import { CITY_EVENTS } from '../config/progression';
import { createCompetitorWorkers } from '../config/staff';
import {
  AD_CAMPAIGNS,
  BAY_UTILITY_PER_MIN,
  LOUNGE_TIP_PER_LEVEL,
  WASH_UTILITY_COST,
  WAX_BONUS_PER_LEVEL,
  getEquipmentSpeedMultiplier,
  getFairWashPrice,
  getMaxQueueCapacity,
  getPlayerQualityScore,
  getUtilityDiscount,
} from '../config/upgrades';
import { VEHICLE_SPECS, pickVehicleForReputation } from '../config/vehicles';
import {
  getBayGreetingPoint,
  getBayPatrolPoints,
  getSiteLayout,
} from '../config/worldLayout';
import type {
  ActiveCityEvent,
  CityEventId,
  CompetitorState,
  EconomyMetrics,
  FloatingPopup,
  OwnerSide,
  ToastNotification,
  UpgradeLevels,
  Vec3,
  VehicleEntity,
  WashStage,
  WorkerProfile,
  WorkerRuntime,
} from '../types/game';
import { formatRub } from '../utils/currency';
import { buildSmoothPath, distanceXZ, lerpAngle, normalizeAngle } from './pathing';

export const SHIFT_START_TIME = 7 / 24; // 07:00 morning
export const SHIFT_END_TIME = 22 / 24; // 22:00 evening close
export const SHIFT_DURATION_SEC = 180; // 3 real minutes per work shift at 1x speed

export interface SimulationCallbacks {
  getEconomy: () => EconomyMetrics;
  getUpgrades: () => UpgradeLevels;
  getPlayerWorkers: () => WorkerProfile[];
  getCompetitor: () => CompetitorState;
  getDay: () => number;
  getTimeOfDay: () => number;
  getTimeMode: () => string;
  getShowPopups: () => boolean;
  getActiveEvent: () => ActiveCityEvent | null;
  getStarted: () => boolean;
  onPlayerWashComplete: (
    payment: number,
    repDelta: number,
    workerId: string | null,
    isVip: boolean
  ) => void;
  onPlayerCarLost: (repDelta: number) => void;
  onCompetitorWashComplete: (payment: number) => void;
  onEconomyMinuteTick: (
    playerUtilityCost: number,
    playerSalaryCost: number,
    playerAdCost: number,
    playerMinuteRev: number,
    compMinuteRev: number
  ) => void;
  onTimeAdvance: (newTimeOfDay: number, minuteDelta: number, dtSec: number) => void;
  onShiftComplete: () => void;
  onCompetitorUpdate: (patch: Partial<CompetitorState>) => void;
  onCityEventUpdate: (event: ActiveCityEvent | null) => void;
  onToast: (title: string, subtitle: string | undefined, tone: ToastNotification['tone']) => void;
  onEntityListChanged: () => void;
}

export interface SplashBurst {
  x: number;
  y: number;
  z: number;
  createdAt: number;
  isVip?: boolean;
}

class GameSimulation {
  public vehicles: VehicleEntity[] = [];
  public workerRuntimes: Map<string, WorkerRuntime> = new Map();
  public competitorWorkers: WorkerProfile[] = createCompetitorWorkers(2);
  public popups: FloatingPopup[] = [];
  public pendingBursts: SplashBurst[] = [];
  /** Smooth 60 FPS time of day read directly by 3D lighting without causing React re-renders */
  public liveTimeOfDay = SHIFT_START_TIME;

  private callbacks: SimulationCallbacks | null = null;
  private spawnTimer = 1.0;
  private eventCooldown = 36;
  private activeEventTimer = 0;
  private lastSyncedEventSec = -1;
  private compAiTimer = 15;
  private compInvestedTier = 0;
  private uiSyncAccum = 0;
  private pendingMinuteDelta = 0;
  private pendingDtSec = 0;
  private minuteAccumulator = 0;
  private minutePlayerRev = 0;
  private minuteCompRev = 0;
  private minutePlayerUtility = 0;
  private entityCounter = 1;
  private initialized = false;

  public bind(callbacks: SimulationCallbacks): void {
    this.callbacks = callbacks;
    const storeTime = callbacks.getTimeOfDay();
    this.liveTimeOfDay = Math.min(SHIFT_END_TIME, Math.max(SHIFT_START_TIME, storeTime));
    this.syncWorkerRuntimes();
    if (!this.initialized) {
      this.initialized = true;
      this.seedInitialLiveTraffic();
    }
  }

  public startNewShift(): void {
    this.liveTimeOfDay = SHIFT_START_TIME;
    this.uiSyncAccum = 0;
    this.pendingMinuteDelta = 0;
    this.pendingDtSec = 0;
  }

  public reset(): void {
    this.vehicles = [];
    this.workerRuntimes.clear();
    this.popups = [];
    this.pendingBursts = [];
    this.competitorWorkers = createCompetitorWorkers(2);
    this.liveTimeOfDay = SHIFT_START_TIME;
    this.spawnTimer = 0.8;
    this.eventCooldown = 36;
    this.activeEventTimer = 0;
    this.lastSyncedEventSec = -1;
    this.compAiTimer = 15;
    this.compInvestedTier = 0;
    this.uiSyncAccum = 0;
    this.pendingMinuteDelta = 0;
    this.pendingDtSec = 0;
    this.minuteAccumulator = 0;
    this.minutePlayerRev = 0;
    this.minuteCompRev = 0;
    this.minutePlayerUtility = 0;
    this.initialized = false;
    if (this.callbacks) {
      this.syncWorkerRuntimes();
      this.initialized = true;
      this.seedInitialLiveTraffic();
      this.callbacks.onEntityListChanged();
    }
  }

  /**
   * Immediately populates the world with arriving cars on both sides so
   * the city feels alive within 1 second of opening the game!
   */
  private seedInitialLiveTraffic(): void {
    if (!this.callbacks) return;
    this.spawnCustomerVehicle('player', 0.85, false);
    this.spawnCustomerVehicle('competitor', 0.85, false);
    this.spawnCustomerVehicle('player', 0.35, false);
    this.callbacks.onEntityListChanged();
  }

  public syncWorkerRuntimes(): void {
    if (!this.callbacks) return;
    const playerWorkers = this.callbacks.getPlayerWorkers();
    const comp = this.callbacks.getCompetitor();

    if (this.competitorWorkers.length !== comp.bays) {
      this.competitorWorkers = createCompetitorWorkers(comp.bays);
    }

    const allProfiles = [...playerWorkers, ...this.competitorWorkers];
    const validIds = new Set(allProfiles.map((w) => w.id));

    for (const [id] of this.workerRuntimes.entries()) {
      if (!validIds.has(id)) {
        for (const v of this.vehicles) {
          if (v.assignedWorkerId === id) {
            v.assignedWorkerId = null;
          }
        }
        this.workerRuntimes.delete(id);
      }
    }

    allProfiles.forEach((profile, index) => {
      if (!this.workerRuntimes.has(profile.id)) {
        const layout = getSiteLayout(profile.owner);
        const slotIdx =
          profile.assignedBay >= 0
            ? profile.assignedBay % layout.workerRestPositions.length
            : index % layout.workerRestPositions.length;
        const rest = layout.workerRestPositions[slotIdx] ?? layout.workerRestPositions[0];
        this.workerRuntimes.set(profile.id, {
          id: profile.id,
          owner: profile.owner,
          x: rest.x,
          y: 0,
          z: rest.z,
          rotationY: profile.owner === 'player' ? Math.PI : 0,
          targetX: rest.x,
          targetZ: rest.z,
          action: 'idle',
          activeBay: -1,
          activeVehicleId: null,
          patrolStep: 0,
          patrolTimer: 0,
          animPhase: Math.random() * Math.PI * 2,
          sprayTarget: null,
        });
      }
    });
  }

  public getWorkerProfileById(id: string): WorkerProfile | undefined {
    if (!this.callbacks) return undefined;
    const p = this.callbacks.getPlayerWorkers().find((w) => w.id === id);
    if (p) return p;
    return this.competitorWorkers.find((w) => w.id === id);
  }

  public getBayStatus(owner: OwnerSide, bayIndex: number): 'free' | 'incoming' | 'washing' | 'done' {
    const v = this.vehicles.find(
      (car) =>
        car.owner === owner &&
        car.bayIndex === bayIndex &&
        (car.state === 'moving_to_bay' || car.state === 'washing')
    );
    if (!v) return 'free';
    if (v.state === 'moving_to_bay') return 'incoming';
    if (v.washProgress >= 0.92) return 'done';
    return 'washing';
  }

  public getBayVehicle(owner: OwnerSide, bayIndex: number): VehicleEntity | undefined {
    return this.vehicles.find(
      (car) =>
        car.owner === owner &&
        car.bayIndex === bayIndex &&
        car.state === 'washing'
    );
  }

  public getQueueCount(owner: OwnerSide): number {
    return this.vehicles.filter(
      (v) => v.owner === owner && (v.state === 'queued' || v.state === 'entering')
    ).length;
  }

  public getPlayerAttractionShare(): number {
    if (!this.callbacks) return 0.5;
    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const comp = this.callbacks.getCompetitor();

    const pScore = this.computeAttractionScore('player', eco, upgrades, comp);
    const cScore = this.computeAttractionScore('competitor', eco, upgrades, comp);
    const total = pScore + cScore;
    if (total <= 0.001) return 0.5;
    return Math.min(0.84, Math.max(0.12, pScore / total));
  }

  private computeAttractionScore(
    owner: OwnerSide,
    eco: EconomyMetrics,
    upgrades: UpgradeLevels,
    comp: CompetitorState
  ): number {
    const queueLen = this.getQueueCount(owner);
    const playerEffPrice = eco.happyHourRemaining > 0 ? eco.washPrice * 0.85 : eco.washPrice;
    const compEffPrice = comp.promoActive ? comp.price * 0.78 : comp.price;

    if (owner === 'player') {
      const quality = getPlayerQualityScore(upgrades);
      const fairPrice = getFairWashPrice(quality, eco.reputation);
      // True multiplicative price elasticity: overpricing sharply drives customers to TURBO SHINE!
      const priceMult =
        playerEffPrice <= fairPrice
          ? Math.min(1.22, 1 + ((fairPrice - playerEffPrice) / fairPrice) * 0.45)
          : Math.max(0.14, Math.pow(fairPrice / playerEffPrice, 2.35));

      const priceGapBonus = Math.max(
        -0.65,
        Math.min(0.55, (compEffPrice - playerEffPrice) / 420)
      );
      const repFactor = 0.65 + eco.reputation * 0.48;
      const qualityFactor = 0.6 + quality * 0.42;
      const bayPresence = (upgrades.bays - 1) * 0.24;
      const adBoost = AD_CAMPAIGNS[eco.adCampaign].demandBoost;
      const happyBoost = eco.happyHourRemaining > 0 ? 0.95 : 0;
      const queuePenalty = Math.max(
        0.24,
        1 - queueLen * (0.115 - (upgrades.vipLounge - 1) * 0.018)
      );
      const baseDesire = Math.max(
        0.3,
        repFactor + qualityFactor + bayPresence + adBoost + happyBoost + priceGapBonus
      );
      return Math.max(0.15, baseDesire * priceMult * queuePenalty);
    } else {
      const fairPrice = getFairWashPrice(comp.quality, comp.reputation);
      const priceMult =
        compEffPrice <= fairPrice
          ? Math.min(1.24, 1 + ((fairPrice - compEffPrice) / fairPrice) * 0.48)
          : Math.max(0.22, Math.pow(fairPrice / compEffPrice, 2.1));

      const priceGapBonus = Math.max(
        -0.55,
        Math.min(0.7, (playerEffPrice - compEffPrice) / 420)
      );
      const repFactor = 0.65 + comp.reputation * 0.48;
      const qualityFactor = 0.6 + comp.quality * 0.42;
      const bayPresence = (comp.bays - 1) * 0.28;
      // During -22% promo, TURBO SHINE also runs a local ad blitz to steal customers back!
      const promoBlitz = comp.promoActive ? 1.15 : 0.25;
      const queuePenalty = Math.max(0.26, 1 - queueLen * 0.11);
      const baseDesire = Math.max(
        0.35,
        repFactor + qualityFactor + bayPresence + promoBlitz + priceGapBonus
      );
      return Math.max(0.2, baseDesire * priceMult * queuePenalty);
    }
  }

  /**
   * Interactive hands-on turbo wash boost triggered by the player!
   */
  public boostVehicleWash(vehicleId: string): boolean {
    const car = this.vehicles.find((v) => v.id === vehicleId);
    if (!car || car.owner !== 'player' || car.state !== 'washing') return false;
    const now = performance.now();
    if (now - car.lastBoostAt < 750) return false;

    car.lastBoostAt = now;
    car.washProgress = Math.min(0.99, car.washProgress + 0.15);
    car.sparkleTimer = Math.max(car.sparkleTimer, 0.9);
    this.pendingBursts.push({
      x: car.x,
      y: 1.1,
      z: car.z,
      createdAt: now,
      isVip: car.isVip,
    });
    soundEngine.playTurboSplash();
    this.addPopup(car.x, 2.45, car.z, '⚡ +15%', '#00D4FF');
    return true;
  }

  public addPopup(x: number, y: number, z: number, text: string, color: string): void {
    if (!this.callbacks || !this.callbacks.getShowPopups() || !this.callbacks.getStarted()) return;
    this.popups.push({
      id: `pop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      z,
      text,
      color,
      createdAt: performance.now(),
      duration: 1550,
    });
    if (this.popups.length > 6) {
      this.popups.shift();
    }
  }

  public step(rawDt: number, speedMultiplier: number): void {
    if (!this.callbacks || speedMultiplier <= 0) return;
    const dt = Math.min(rawDt, 0.05) * speedMultiplier;
    if (dt <= 0) return;

    this.syncWorkerRuntimes();

    // 1. Advance realistic 07:00 -> 22:00 work shift smoothly at 60 FPS,
    //    but sync React UI only twice per second (0.5s) to guarantee zero frame drops!
    const timeMode = this.callbacks.getTimeMode();
    if (timeMode === 'cycle') {
      const shiftSpan = SHIFT_END_TIME - SHIFT_START_TIME;
      this.liveTimeOfDay += (dt / SHIFT_DURATION_SEC) * shiftSpan;

      if (this.liveTimeOfDay >= SHIFT_END_TIME) {
        if (this.callbacks.getStarted()) {
          this.liveTimeOfDay = SHIFT_END_TIME;
          this.callbacks.onTimeAdvance(
            this.liveTimeOfDay,
            this.pendingMinuteDelta + dt / 60,
            this.pendingDtSec + dt
          );
          this.uiSyncAccum = 0;
          this.pendingMinuteDelta = 0;
          this.pendingDtSec = 0;
          this.callbacks.onShiftComplete();
          return;
        } else {
          // On start screen, gracefully loop back to sunny morning
          this.liveTimeOfDay = SHIFT_START_TIME;
        }
      }
    }

    this.uiSyncAccum += dt;
    this.pendingMinuteDelta += dt / 60;
    this.pendingDtSec += dt;
    if (this.uiSyncAccum >= 0.5) {
      this.callbacks.onTimeAdvance(
        this.liveTimeOfDay,
        this.pendingMinuteDelta,
        this.pendingDtSec
      );
      this.uiSyncAccum = 0;
      this.pendingMinuteDelta = 0;
      this.pendingDtSec = 0;
    }

    // 2. Dynamic City Events (only while actively playing)
    if (this.callbacks.getStarted()) {
      this.stepCityEvents(dt);
    }

    // 3. Competitor autonomous evolution & promotions
    this.stepCompetitorAI(dt);

    // 4. Vehicle spawning based on total city demand + time of day + advertising + events
    this.stepSpawner(dt);

    // 5. Queue advancement & bay dispatching
    this.stepSiteDispatch('player');
    this.stepSiteDispatch('competitor');

    // 6. Vehicle movement, washing progression & cleanup
    this.stepVehicles(dt);

    // 7. Worker AI & animations
    this.stepWorkers(dt);

    // 8. Economy billing cycle (every 15 seconds)
    this.stepEconomyBilling(dt);

    // 9. Prune expired popups & splash bursts
    const nowMs = performance.now();
    if (this.popups.length > 0) {
      this.popups = this.popups.filter((p) => nowMs - p.createdAt < p.duration);
    }
    if (this.pendingBursts.length > 0) {
      this.pendingBursts = this.pendingBursts.filter((b) => nowMs - b.createdAt < 400);
    }
  }

  private stepCityEvents(dt: number): void {
    if (!this.callbacks) return;
    const active = this.callbacks.getActiveEvent();
    if (active) {
      this.activeEventTimer -= dt;
      if (this.activeEventTimer <= 0) {
        this.activeEventTimer = 0;
        this.lastSyncedEventSec = -1;
        this.callbacks.onCityEventUpdate(null);
        this.eventCooldown = 62 + Math.random() * 36;
      } else {
        const sec = Math.ceil(this.activeEventTimer);
        if (sec !== this.lastSyncedEventSec) {
          this.lastSyncedEventSec = sec;
          this.callbacks.onCityEventUpdate({ ...active, remainingSec: sec });
        }
      }
      return;
    }

    this.eventCooldown -= dt;
    if (this.eventCooldown <= 0) {
      const pool: CityEventId[] = ['rain_aftermath', 'rush_hour', 'car_blogger', 'vip_convoy'];
      const chosenId = pool[Math.floor(Math.random() * pool.length)];
      const spec = CITY_EVENTS[chosenId];
      this.activeEventTimer = spec.duration;
      this.lastSyncedEventSec = Math.ceil(spec.duration);
      this.callbacks.onCityEventUpdate({
        id: chosenId,
        remainingSec: spec.duration,
        totalSec: spec.duration,
      });
      soundEngine.playFanfare();
      this.callbacks.onToast(spec.title, undefined, chosenId === 'vip_convoy' ? 'vip' : 'cyan');

      if (chosenId === 'vip_convoy' && this.vehicles.length < 16) {
        this.spawnCustomerVehicle('player', 0.15, true);
        this.callbacks.onEntityListChanged();
      }
    }
  }

  private stepCompetitorAI(dt: number): void {
    if (!this.callbacks) return;
    const comp = this.callbacks.getCompetitor();
    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const day = this.callbacks.getDay();
    const playerShare = this.getPlayerAttractionShare();
    const playerQuality = getPlayerQualityScore(upgrades);

    // 1. Reactive Promo & Price-War Blitz (-22% + ad push when losing market share!)
    let promoActive = comp.promoActive;
    let promoTimer = comp.promoTimer - dt;
    if (promoTimer <= 0) {
      if (promoActive) {
        promoActive = false;
        // Shorter cooldown when player is dominating so TURBO SHINE keeps pushing back!
        promoTimer = playerShare > 0.54 ? 32 + Math.random() * 18 : 54 + Math.random() * 28;
      } else {
        const triggerChance = playerShare > 0.56 ? 0.78 : playerShare > 0.48 ? 0.48 : 0.25;
        if (Math.random() < triggerChance) {
          promoActive = true;
          promoTimer = 38;
          if (this.callbacks.getStarted()) {
            this.callbacks.onToast('TURBO SHINE: акция -22%!', undefined, 'coral');
          }
        } else {
          promoTimer = 36;
        }
      }
      this.callbacks.onCompetitorUpdate({ promoActive, promoTimer });
    } else {
      comp.promoTimer = promoTimer;
    }

    // 2. Active Strategic AI every 16 seconds: pricing, bay expansion & equipment race!
    this.compAiTimer -= dt;
    if (this.compAiTimer > 0) return;
    this.compAiTimer = 16;

    const patch: Partial<CompetitorState> = {};

    // Open Bay #3 as soon as TURBO SHINE earns 42 000 ₽ OR player expands!
    if (
      comp.bays < 3 &&
      (comp.totalRevenue >= 42_000 || (upgrades.bays >= 2 && day >= 2) || upgrades.bays >= 3)
    ) {
      patch.bays = 3;
      if (this.callbacks.getStarted()) {
        this.callbacks.onToast('TURBO SHINE открыл 3-й бокс!', undefined, 'coral');
      }
    }

    // Invest competitor profits & match player's quality/speed upgrades so rivalry stays fierce!
    const revTier = Math.floor(comp.totalRevenue / 40_000);
    const qualityGap = playerQuality - comp.quality;
    if (
      (revTier > this.compInvestedTier || qualityGap >= 0.35 || comp.lastUpgradeDay < day) &&
      (comp.quality < 4.85 || comp.speedMultiplier < 1.95)
    ) {
      this.compInvestedTier = Math.max(this.compInvestedTier, revTier);
      const qStep = qualityGap >= 0.5 ? 0.24 : 0.16;
      const sStep = qualityGap >= 0.5 ? 0.08 : 0.05;
      patch.quality = Math.min(4.85, +(comp.quality + qStep).toFixed(2));
      patch.speedMultiplier = Math.min(1.95, +(comp.speedMultiplier + sStep).toFixed(2));
      patch.lastUpgradeDay = day;
    }

    // Dynamic Price Adaptation: undercut player when trailing, maximize margin when leading!
    const compQualityNext = patch.quality ?? comp.quality;
    const compFair = getFairWashPrice(compQualityNext, comp.reputation);
    let desiredPrice = comp.price;

    if (playerShare > 0.54) {
      // Fight back by undercutting the player's price (within profitable bounds)
      const undercut = Math.max(700, Math.min(compFair, eco.washPrice - 50));
      desiredPrice = Math.round(undercut / 50) * 50;
    } else if (playerShare < 0.44) {
      // Leading the street: creep price up toward fair value to grow profits faster
      const targetUp = Math.min(1_750, compFair, eco.washPrice + 100);
      desiredPrice = Math.round(targetUp / 50) * 50;
    } else {
      // Stay competitive near fair market price
      const balanced = Math.min(compFair, Math.max(800, eco.washPrice));
      desiredPrice = Math.round(balanced / 50) * 50;
    }

    if (desiredPrice !== comp.price) {
      const delta = Math.max(-100, Math.min(100, desiredPrice - comp.price));
      patch.price = Math.max(700, Math.min(1_750, Math.round((comp.price + delta) / 50) * 50));
    }

    if (Object.keys(patch).length > 0) {
      this.callbacks.onCompetitorUpdate(patch);
    }
  }

  private stepSpawner(dt: number): void {
    if (!this.callbacks) return;
    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const comp = this.callbacks.getCompetitor();
    const activeEvent = this.callbacks.getActiveEvent();

    // Feel the rhythm of the day: calm early morning, vibrant midday, lively sunset rush hour!
    const hour = this.liveTimeOfDay * 24;
    const timeWave =
      hour < 9.5 ? 0.9 : hour >= 16.5 && hour <= 19.8 ? 1.2 : hour > 20.5 ? 0.92 : 1.04;

    const adSpec = AD_CAMPAIGNS[eco.adCampaign];
    const eventTraffic = activeEvent ? CITY_EVENTS[activeEvent.id].trafficMultiplier : 1.0;
    const happyTraffic = eco.happyHourRemaining > 0 ? 1.25 : 1.0;
    const baseInterval = 4.35 / (adSpec.trafficMultiplier * eventTraffic * happyTraffic * timeWave);
    const bayBonus = Math.max(0.66, 1 - (upgrades.bays - 1) * 0.11);
    const targetInterval = Math.max(1.9, baseInterval * bayBonus);

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = targetInterval * (0.78 + Math.random() * 0.44);

    if (this.vehicles.length >= 16) return;

    const playerShare = this.getPlayerAttractionShare();
    let chosenSide: OwnerSide = Math.random() < playerShare ? 'player' : 'competitor';

    const playerMaxQ = getMaxQueueCapacity(upgrades.queueLot);
    const playerQ = this.getQueueCount('player');
    const compQ = this.getQueueCount('competitor');

    if (chosenSide === 'player' && playerQ >= playerMaxQ) {
      if (compQ < 5) {
        chosenSide = 'competitor';
      } else {
        return;
      }
    } else if (chosenSide === 'competitor' && compQ >= 5) {
      if (playerQ < playerMaxQ) {
        chosenSide = 'player';
      } else {
        return;
      }
    }

    const layout = getSiteLayout(chosenSide);
    const tooClose = this.vehicles.some(
      (v) =>
        v.owner === chosenSide &&
        distanceXZ(v.x, v.z, layout.spawnPoint.x, layout.spawnPoint.z) < 7.5
    );
    if (tooClose) return;

    // VIP roll for player side (and high-rep competitor too!)
    let isVip = false;
    if (this.callbacks.getStarted()) {
      if (chosenSide === 'player') {
        const vipChance =
          0.05 +
          Math.max(0, eco.reputation - 3.5) * 0.035 +
          (eco.adCampaign === 'radio' ? 0.04 : 0) +
          (activeEvent ? CITY_EVENTS[activeEvent.id].vipChanceBonus : 0);
        if (Math.random() < vipChance) {
          isVip = true;
        }
      } else if (comp.reputation >= 4.0 && Math.random() < 0.06) {
        isVip = true;
      }
    }

    this.spawnCustomerVehicle(chosenSide, 0, isVip);
    if (chosenSide === 'player') {
      soundEngine.playCarArrival();
      if (isVip) {
        soundEngine.playFanfare();
      }
    }
    this.callbacks.onEntityListChanged();
  }

  private spawnCustomerVehicle(owner: OwnerSide, startProgress: number, isVip: boolean): void {
    if (!this.callbacks) return;
    const eco = this.callbacks.getEconomy();
    const comp = this.callbacks.getCompetitor();
    const activeEvent = this.callbacks.getActiveEvent();
    const layout = getSiteLayout(owner);

    const rep = owner === 'player' ? (isVip ? 5.0 : eco.reputation) : comp.reputation;
    const picked = pickVehicleForReputation(rep);

    // VIP cars always drive luxury / sports vehicles with golden accent!
    const category = isVip
      ? (Math.random() < 0.55 ? 'premium' : 'sports')
      : picked.category;
    const spec = VEHICLE_SPECS[category];
    const modelName = isVip
      ? spec.models[Math.floor(Math.random() * spec.models.length)] ?? 'Maybach VIP'
      : picked.modelName;
    const appearance = isVip
      ? {
          primaryColor: Math.random() < 0.5 ? '#121624' : '#F8FAFC',
          accentColor: '#FACC15',
          rimColor: '#FDE047',
          dirtSeed: Math.random() * 1000,
        }
      : picked.appearance;

    const rawApproach: Vec3[] = [
      layout.spawnPoint,
      layout.roadEntryPoint,
      layout.lotEntryPoint,
    ];
    const smoothApproach = buildSmoothPath(rawApproach, 2.8);

    const startIdx = Math.min(
      smoothApproach.length - 2,
      Math.floor(startProgress * (smoothApproach.length - 1))
    );
    const startPt = smoothApproach[startIdx];
    const nextPt = smoothApproach[startIdx + 1] ?? layout.lotEntryPoint;
    const initialYaw = Math.atan2(nextPt.x - startPt.x, nextPt.z - startPt.z);

    const basePrice =
      owner === 'player'
        ? eco.happyHourRemaining > 0
          ? eco.washPrice * 0.85
          : eco.washPrice
        : comp.promoActive
          ? comp.price * 0.78
          : comp.price;
    const vipMult = isVip ? 1.75 : 1.0;
    const expectedPrice = Math.round((basePrice * spec.priceMultiplier * vipMult) / 10) * 10;
    const rainDirt = activeEvent?.id === 'rain_aftermath' ? 1.0 : 0.82 + Math.random() * 0.18;

    this.entityCounter += 1;
    const car: VehicleEntity = {
      id: `car-${owner[0]}-${this.entityCounter}`,
      owner,
      category,
      modelName: isVip ? `VIP ${modelName}` : modelName,
      appearance,
      isVip,
      lastBoostAt: 0,
      state: 'approaching',
      washStage: 'none',
      x: startPt.x,
      y: 0,
      z: startPt.z,
      rotationY: initialYaw,
      speed: 7.5,
      steerAngle: 0,
      wheelSpin: 0,
      braking: false,
      dirtLevel: rainDirt,
      foamLevel: 0,
      washProgress: 0,
      patience: 1.0,
      queueSlot: -1,
      bayIndex: -1,
      assignedWorkerId: null,
      waypoints: smoothApproach,
      waypointIndex: startIdx + 1,
      expectedPrice,
      washDuration: spec.baseWashSeconds * (isVip ? 0.92 : 1),
      spawnTime: performance.now(),
      sparkleTimer: 0,
    };

    this.vehicles.push(car);
  }

  private stepSiteDispatch(owner: OwnerSide): void {
    if (!this.callbacks) return;
    const layout = getSiteLayout(owner);
    const upgrades = this.callbacks.getUpgrades();
    const comp = this.callbacks.getCompetitor();
    const maxBays = owner === 'player' ? upgrades.bays : comp.bays;
    const workers =
      owner === 'player' ? this.callbacks.getPlayerWorkers() : this.competitorWorkers;

    const queuedCars = this.vehicles
      .filter((v) => v.owner === owner && (v.state === 'entering' || v.state === 'queued'))
      .sort((a, b) => {
        const sa = a.queueSlot === -1 ? 99 : a.queueSlot;
        const sb = b.queueSlot === -1 ? 99 : b.queueSlot;
        return sa - sb;
      });

    queuedCars.forEach((car, targetSlot) => {
      if (car.queueSlot !== targetSlot && targetSlot < layout.queueSlots.length) {
        car.queueSlot = targetSlot;
        const slotPos = layout.queueSlots[targetSlot];
        car.waypoints = buildSmoothPath([{ x: car.x, y: 0, z: car.z }, slotPos], 1.4);
        car.waypointIndex = 1;
        if (car.state === 'queued') {
          car.state = 'entering';
        }
      }
    });

    const frontCar = queuedCars.find(
      (c) =>
        c.queueSlot === 0 &&
        (c.state === 'queued' ||
          (c.state === 'entering' && Math.abs(c.x - layout.bayPositions[0].x) < 12))
    );
    if (!frontCar) return;

    for (let bayIdx = 0; bayIdx < maxBays; bayIdx++) {
      const bayOccupied = this.vehicles.some(
        (v) =>
          v.owner === owner &&
          v.bayIndex === bayIdx &&
          (v.state === 'moving_to_bay' || v.state === 'washing')
      );
      if (bayOccupied) continue;

      const worker = this.findAvailableWorker(workers, bayIdx);
      if (!worker) continue;

      const bayCenter = layout.bayPositions[bayIdx];
      frontCar.state = 'moving_to_bay';
      frontCar.queueSlot = -1;
      frontCar.bayIndex = bayIdx;
      frontCar.assignedWorkerId = worker.id;

      const entryApron: Vec3 = { x: bayCenter.x, y: 0, z: layout.bayApronZ };
      frontCar.waypoints = buildSmoothPath(
        [
          { x: frontCar.x, y: 0, z: frontCar.z },
          { x: frontCar.x, y: 0, z: layout.bayApronZ },
          entryApron,
          bayCenter,
        ],
        1.8
      );
      frontCar.waypointIndex = 1;

      const rt = this.workerRuntimes.get(worker.id);
      if (rt) {
        const greetPt = getBayGreetingPoint(owner, bayIdx);
        rt.activeBay = bayIdx;
        rt.activeVehicleId = frontCar.id;
        rt.targetX = greetPt.x;
        rt.targetZ = greetPt.z;
        rt.action = 'walking';
        rt.patrolStep = 0;
        rt.patrolTimer = 0;
      }
      break;
    }
  }

  private findAvailableWorker(workers: WorkerProfile[], bayIdx: number): WorkerProfile | null {
    for (const w of workers) {
      if (w.assignedBay !== bayIdx) continue;
      const rt = this.workerRuntimes.get(w.id);
      if (rt && !rt.activeVehicleId) return w;
    }
    for (const w of workers) {
      if (w.assignedBay !== -1) continue;
      const rt = this.workerRuntimes.get(w.id);
      if (rt && !rt.activeVehicleId) return w;
    }
    return null;
  }

  private stepVehicles(dt: number): void {
    if (!this.callbacks) return;
    const upgrades = this.callbacks.getUpgrades();
    const comp = this.callbacks.getCompetitor();
    const toRemove: string[] = [];

    for (const car of this.vehicles) {
      if (car.sparkleTimer > 0) {
        car.sparkleTimer = Math.max(0, car.sparkleTimer - dt);
      }

      if (car.state === 'washing') {
        this.stepVehicleWash(car, dt, upgrades, comp);
        continue;
      }

      if (car.state === 'queued') {
        car.speed = Math.max(0, car.speed - 14 * dt);
        car.braking = true;
        car.steerAngle *= 0.85;
        const layout = getSiteLayout(car.owner);
        car.rotationY = lerpAngle(car.rotationY, layout.queueCarRotationY, dt * 6);

        const patienceRate =
          car.owner === 'player'
            ? 0.0115 / (1 + (upgrades.vipLounge - 1) * 0.24)
            : 0.0125;
        car.patience = Math.max(0, car.patience - patienceRate * dt);
        if (car.patience <= 0) {
          if (car.owner === 'player') {
            this.callbacks.onPlayerCarLost(car.isVip ? -0.16 : -0.1);
            this.addPopup(car.x, 2.4, car.z, 'Уехал (очередь)', '#FF3B5C');
          } else {
            this.callbacks.onCompetitorUpdate({
              reputation: Math.max(2.6, +(comp.reputation - 0.025).toFixed(3)),
            });
          }
          this.sendCarToExit(car, true);
        }
        continue;
      }

      const target = car.waypoints[car.waypointIndex];
      if (!target) {
        this.handlePathFinished(car, toRemove);
        continue;
      }

      const dist = distanceXZ(car.x, car.z, target.x, target.z);
      const isFinalWp = car.waypointIndex >= car.waypoints.length - 1;

      let desiredSpeed =
        car.state === 'approaching' || car.state === 'leaving'
          ? 10.8
          : car.state === 'moving_to_bay' || car.state === 'entering'
            ? 5.2
            : 6.8;

      if (isFinalWp && (car.state === 'entering' || car.state === 'moving_to_bay')) {
        desiredSpeed = Math.min(desiredSpeed, Math.max(1.2, dist * 1.4));
      }

      const blockedAhead = this.isBlockedAhead(car);
      if (blockedAhead) {
        desiredSpeed = 0;
      }

      const accel = desiredSpeed > car.speed ? 7.5 : 14.0;
      car.braking = desiredSpeed < car.speed - 0.35 || desiredSpeed < 0.2;
      if (car.speed < desiredSpeed) {
        car.speed = Math.min(desiredSpeed, car.speed + accel * dt);
      } else {
        car.speed = Math.max(desiredSpeed, car.speed - accel * dt);
      }

      const desiredYaw = Math.atan2(target.x - car.x, target.z - car.z);
      const yawDiff = normalizeAngle(desiredYaw - car.rotationY);
      car.steerAngle = Math.max(-0.55, Math.min(0.55, yawDiff * 1.6));

      if (car.speed > 0.08) {
        const turnRate = Math.min(1, dt * (3.6 + car.speed * 0.45));
        car.rotationY = lerpAngle(car.rotationY, desiredYaw, turnRate);

        const moveDist = Math.min(dist, car.speed * dt);
        const dirX = (target.x - car.x) / Math.max(0.0001, dist);
        const dirZ = (target.z - car.z) / Math.max(0.0001, dist);
        car.x += dirX * moveDist;
        car.z += dirZ * moveDist;

        const wheelR = VEHICLE_SPECS[car.category].dimensions.wheelRadius;
        car.wheelSpin += moveDist / wheelR;
      }

      const reachThreshold = isFinalWp ? 0.32 : 0.72;
      if (dist <= reachThreshold) {
        car.waypointIndex += 1;
        if (car.waypointIndex >= car.waypoints.length) {
          this.handlePathFinished(car, toRemove);
        }
      }
    }

    if (toRemove.length > 0) {
      const removeSet = new Set(toRemove);
      this.vehicles = this.vehicles.filter((v) => !removeSet.has(v.id));
      this.callbacks.onEntityListChanged();
    }
  }

  private isBlockedAhead(car: VehicleEntity): boolean {
    if (car.state === 'washing') return false;
    const fx = Math.sin(car.rotationY);
    const fz = Math.cos(car.rotationY);

    for (const other of this.vehicles) {
      if (other.id === car.id) continue;
      if (other.state === 'washing') continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d > 5.4 || d < 0.01) continue;

      const dot = (dx / d) * fx + (dz / d) * fz;
      if (dot > 0.72) {
        const headingDot =
          Math.sin(car.rotationY) * Math.sin(other.rotationY) +
          Math.cos(car.rotationY) * Math.cos(other.rotationY);
        if (headingDot > 0.25) {
          return true;
        }
      }
    }
    return false;
  }

  private handlePathFinished(car: VehicleEntity, toRemove: string[]): void {
    const layout = getSiteLayout(car.owner);

    if (car.state === 'approaching') {
      const maxQ =
        car.owner === 'player'
          ? getMaxQueueCapacity(this.callbacks!.getUpgrades().queueLot)
          : 5;
      const occupiedSlots = new Set(
        this.vehicles
          .filter(
            (v) =>
              v.owner === car.owner &&
              v.id !== car.id &&
              (v.state === 'entering' || v.state === 'queued')
          )
          .map((v) => v.queueSlot)
      );

      let freeSlot = -1;
      for (let i = 0; i < Math.min(maxQ, layout.queueSlots.length); i++) {
        if (!occupiedSlots.has(i)) {
          freeSlot = i;
          break;
        }
      }

      if (freeSlot === -1) {
        this.sendCarToExit(car, true);
        return;
      }

      car.state = 'entering';
      car.queueSlot = freeSlot;
      const slotPos = layout.queueSlots[freeSlot];
      car.waypoints = buildSmoothPath([{ x: car.x, y: 0, z: car.z }, slotPos], 1.5);
      car.waypointIndex = 1;
      return;
    }

    if (car.state === 'entering') {
      car.state = 'queued';
      car.speed = 0;
      car.braking = true;
      return;
    }

    if (car.state === 'moving_to_bay') {
      const bayCenter = layout.bayPositions[car.bayIndex] ?? layout.bayPositions[0];
      car.x = bayCenter.x;
      car.z = bayCenter.z;
      car.rotationY = layout.bayCarRotationY;
      car.speed = 0;
      car.braking = true;
      car.steerAngle = 0;
      car.state = 'washing';
      car.washStage = 'greeting';
      car.washProgress = 0;
      return;
    }

    if (car.state === 'exiting') {
      car.state = 'leaving';
      car.waypoints = [layout.despawnPoint];
      car.waypointIndex = 0;
      return;
    }

    if (car.state === 'leaving') {
      toRemove.push(car.id);
    }
  }

  private stepVehicleWash(
    car: VehicleEntity,
    dt: number,
    upgrades: UpgradeLevels,
    comp: CompetitorState
  ): void {
    if (!this.callbacks) return;
    const layout = getSiteLayout(car.owner);
    const eco = this.callbacks.getEconomy();
    const activeEvent = this.callbacks.getActiveEvent();

    car.rotationY = lerpAngle(car.rotationY, layout.bayCarRotationY, dt * 8);
    car.speed = 0;
    car.braking = true;

    if (!car.assignedWorkerId || !this.workerRuntimes.has(car.assignedWorkerId)) {
      const workers =
        car.owner === 'player' ? this.callbacks.getPlayerWorkers() : this.competitorWorkers;
      const replacement = this.findAvailableWorker(workers, car.bayIndex);
      if (replacement) {
        car.assignedWorkerId = replacement.id;
        const rt = this.workerRuntimes.get(replacement.id);
        if (rt) {
          rt.activeBay = car.bayIndex;
          rt.activeVehicleId = car.id;
        }
      } else {
        return;
      }
    }

    const workerProfile = this.getWorkerProfileById(car.assignedWorkerId);
    const workerSpeed = workerProfile ? workerProfile.speed * workerProfile.morale : 1.0;
    const equipSpeed =
      car.owner === 'player'
        ? getEquipmentSpeedMultiplier(upgrades) * (eco.happyHourRemaining > 0 ? 1.25 : 1.0)
        : comp.speedMultiplier;

    const totalRate = (workerSpeed * equipSpeed) / Math.max(7.5, car.washDuration);
    car.washProgress = Math.min(1, car.washProgress + totalRate * dt);

    let stage: WashStage = 'greeting';
    if (car.washProgress < 0.07) {
      stage = 'greeting';
    } else if (car.washProgress < 0.34) {
      stage = 'rinse';
      const local = (car.washProgress - 0.07) / 0.27;
      car.dirtLevel = Math.max(0.7, 1.0 - local * 0.3);
      car.foamLevel = 0;
      if (car.owner === 'player') soundEngine.playWashStageSound('rinse');
    } else if (car.washProgress < 0.62) {
      stage = 'foam';
      const local = (car.washProgress - 0.34) / 0.28;
      car.foamLevel = Math.min(1.0, local * 1.18);
      car.dirtLevel = Math.max(0.52, 0.7 - local * 0.18);
      if (car.owner === 'player') soundEngine.playWashStageSound('foam');
    } else if (car.washProgress < 0.86) {
      stage = 'scrub';
      const local = (car.washProgress - 0.62) / 0.24;
      car.dirtLevel = Math.max(0.05, 0.52 * (1 - local));
      car.foamLevel = Math.max(0.1, 1.0 - local * 0.9);
      if (car.owner === 'player') soundEngine.playWashStageSound('scrub');
    } else {
      stage = 'dry';
      const local = (car.washProgress - 0.86) / 0.14;
      car.dirtLevel = Math.max(0, 0.05 * (1 - local));
      car.foamLevel = Math.max(0, 0.1 * (1 - local));
      if (car.owner === 'player') soundEngine.playWashStageSound('dry');
    }
    car.washStage = stage;

    if (car.washProgress >= 1) {
      car.washStage = 'done';
      car.dirtLevel = 0;
      car.foamLevel = 0;
      car.sparkleTimer = car.isVip ? 4.5 : 3.4;

      const workerQuality = workerProfile ? workerProfile.quality : 1.0;

      if (car.owner === 'player') {
        const foamTip = 1 + (upgrades.foamSystem - 1) * 0.06;
        const waxBonus = (upgrades.dryerWax - 1) * WAX_BONUS_PER_LEVEL;
        const loungeTip = (upgrades.vipLounge - 1) * LOUNGE_TIP_PER_LEVEL;
        const comboBonus = 1 + Math.min(0.2, Math.floor((eco.combo + 1) / 2) * 0.02);
        const eventTip = activeEvent ? CITY_EVENTS[activeEvent.id].tipMultiplier : 1.0;
        const eventRep = activeEvent ? CITY_EVENTS[activeEvent.id].repMultiplier : 1.0;

        const rawPayment =
          (car.expectedPrice * (0.9 + workerQuality * 0.12) * foamTip + waxBonus + loungeTip) *
          comboBonus *
          eventTip;
        const payment = Math.round(rawPayment / 10) * 10;

        const repDiminish =
          eco.reputation > 4.65
            ? 0.22
            : eco.reputation > 4.25
              ? 0.45
              : eco.reputation > 3.85
                ? 0.72
                : 1.0;
        const baseRep =
          (car.isVip ? 0.048 : 0.015) + (upgrades.foamSystem + upgrades.vipLounge - 2) * 0.0025;
        const repGain = +(baseRep * eventRep * repDiminish).toFixed(3);
        const utilityForWash = Math.round(WASH_UTILITY_COST * getUtilityDiscount(upgrades.ecoSolar));

        this.minutePlayerRev += payment;
        this.minutePlayerUtility += utilityForWash;

        this.callbacks.onPlayerWashComplete(payment, repGain, car.assignedWorkerId, car.isVip);

        if (car.isVip) {
          soundEngine.playFanfare();
          this.pendingBursts.push({
            x: car.x,
            y: 1.4,
            z: car.z,
            createdAt: performance.now(),
            isVip: true,
          });
          this.addPopup(car.x, 2.85, car.z, `⭐ VIP ${formatRub(payment, { signed: true })}`, '#FACC15');
        } else {
          soundEngine.playCash();
          this.addPopup(car.x, 2.7, car.z, formatRub(payment, { signed: true }), '#22C55E');
        }
      } else {
        const payment = Math.round((car.expectedPrice * (0.96 + comp.quality * 0.07)) / 10) * 10;
        this.minuteCompRev += payment;
        this.callbacks.onCompetitorWashComplete(payment);
        this.addPopup(car.x, 2.6, car.z, formatRub(payment, { signed: true }), '#FF9F43');
      }

      if (car.assignedWorkerId) {
        const rt = this.workerRuntimes.get(car.assignedWorkerId);
        if (rt) {
          rt.activeVehicleId = null;
          rt.activeBay = -1;
          rt.action = 'celebrating';
          rt.patrolTimer = 1.1;
          rt.sprayTarget = null;
        }
      }

      car.assignedWorkerId = null;
      this.sendCarToExit(car, false);
    }
  }

  private sendCarToExit(car: VehicleEntity, abandonedFromQueue: boolean): void {
    const layout = getSiteLayout(car.owner);
    const bayIdx = car.bayIndex;
    car.bayIndex = -1;
    car.queueSlot = -1;
    car.state = 'exiting';

    if (abandonedFromQueue) {
      car.waypoints = buildSmoothPath(
        [
          { x: car.x, y: 0, z: car.z },
          { x: layout.roadExitPoint.x, y: 0, z: car.owner === 'player' ? 10.4 : -10.4 },
          layout.roadExitPoint,
        ],
        2.0
      );
    } else {
      const bayPos = layout.bayPositions[Math.max(0, bayIdx)] ?? layout.bayPositions[0];
      const rearZ = layout.exitApronPoint.z;
      car.waypoints = buildSmoothPath(
        [
          { x: car.x, y: 0, z: car.z },
          { x: bayPos.x, y: 0, z: rearZ },
          layout.exitApronPoint,
          { x: layout.roadExitPoint.x, y: 0, z: car.owner === 'player' ? 11.5 : -11.5 },
          layout.roadExitPoint,
        ],
        2.2
      );
    }
    car.waypointIndex = 1;
  }

  private stepWorkers(dt: number): void {
    if (!this.callbacks) return;
    const playerWorkers = this.callbacks.getPlayerWorkers();
    const allProfiles = [...playerWorkers, ...this.competitorWorkers];

    allProfiles.forEach((profile, index) => {
      const rt = this.workerRuntimes.get(profile.id);
      if (!rt) return;

      rt.animPhase += dt * (4.2 + profile.speed * 1.4);

      if (rt.action === 'celebrating') {
        rt.patrolTimer -= dt;
        if (rt.patrolTimer <= 0) {
          rt.action = 'idle';
        }
        return;
      }

      const activeCar = rt.activeVehicleId
        ? this.vehicles.find((v) => v.id === rt.activeVehicleId)
        : undefined;

      if (!activeCar || activeCar.state === 'exiting' || activeCar.state === 'leaving') {
        rt.activeVehicleId = null;
        rt.activeBay = -1;
        rt.sprayTarget = null;
        const layout = getSiteLayout(rt.owner);
        const slotIdx =
          profile.assignedBay >= 0
            ? profile.assignedBay % layout.workerRestPositions.length
            : index % layout.workerRestPositions.length;
        const rest = layout.workerRestPositions[slotIdx] ?? layout.workerRestPositions[0];
        const d = distanceXZ(rt.x, rt.z, rest.x, rest.z);
        if (d > 0.28) {
          rt.action = 'walking';
          this.moveWorkerToward(rt, rest.x, rest.z, 3.2 * profile.speed, dt);
        } else {
          rt.action = 'idle';
          const idleYaw = rt.owner === 'player' ? Math.PI : 0;
          rt.rotationY = lerpAngle(rt.rotationY, idleYaw, dt * 4);
        }
        return;
      }

      if (activeCar.state === 'moving_to_bay') {
        const greetPt = getBayGreetingPoint(rt.owner, activeCar.bayIndex);
        const d = distanceXZ(rt.x, rt.z, greetPt.x, greetPt.z);
        if (d > 0.3) {
          rt.action = 'walking';
          this.moveWorkerToward(rt, greetPt.x, greetPt.z, 3.6 * profile.speed, dt);
        } else {
          rt.action = 'greeting';
          const lookYaw = Math.atan2(activeCar.x - rt.x, activeCar.z - rt.z);
          rt.rotationY = lerpAngle(rt.rotationY, lookYaw, dt * 6);
        }
        rt.sprayTarget = null;
        return;
      }

      if (activeCar.state === 'washing') {
        const patrol = getBayPatrolPoints(rt.owner, activeCar.bayIndex);
        if (activeCar.washStage === 'greeting') {
          const greetPt = patrol[0];
          const d = distanceXZ(rt.x, rt.z, greetPt.x, greetPt.z);
          if (d > 0.28) {
            rt.action = 'walking';
            this.moveWorkerToward(rt, greetPt.x, greetPt.z, 3.5 * profile.speed, dt);
          } else {
            rt.action = 'greeting';
            const lookYaw = Math.atan2(activeCar.x - rt.x, activeCar.z - rt.z);
            rt.rotationY = lerpAngle(rt.rotationY, lookYaw, dt * 7);
          }
          rt.sprayTarget = null;
          return;
        }

        const wp = patrol[rt.patrolStep % patrol.length];
        const d = distanceXZ(rt.x, rt.z, wp.x, wp.z);

        const stageAction =
          activeCar.washStage === 'rinse'
            ? 'rinsing'
            : activeCar.washStage === 'foam'
              ? 'foaming'
              : activeCar.washStage === 'scrub'
                ? 'scrubbing'
                : 'drying';

        if (d > 0.32) {
          rt.action = 'walking';
          this.moveWorkerToward(rt, wp.x, wp.z, 2.8 * profile.speed, dt);
          rt.sprayTarget =
            stageAction === 'rinsing' || stageAction === 'foaming'
              ? { x: activeCar.x, y: 0.95, z: activeCar.z }
              : null;
        } else {
          rt.action = stageAction;
          const lookYaw = Math.atan2(activeCar.x - rt.x, activeCar.z - rt.z);
          rt.rotationY = lerpAngle(rt.rotationY, lookYaw, dt * 8);

          const sweep = Math.sin(rt.animPhase * 1.4) * 0.65;
          const perpX = Math.cos(lookYaw) * sweep;
          const perpZ = -Math.sin(lookYaw) * sweep;
          rt.sprayTarget = {
            x: activeCar.x + perpX * 0.55,
            y: 0.72 + Math.sin(rt.animPhase * 0.9) * 0.34,
            z: activeCar.z + perpZ * 0.55,
          };

          rt.patrolTimer += dt;
          if (rt.patrolTimer >= 1.15 / Math.max(0.8, profile.speed)) {
            rt.patrolTimer = 0;
            rt.patrolStep = (rt.patrolStep + 1) % patrol.length;
          }
        }
      }
    });
  }

  private moveWorkerToward(
    rt: WorkerRuntime,
    tx: number,
    tz: number,
    speed: number,
    dt: number
  ): void {
    const dx = tx - rt.x;
    const dz = tz - rt.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.001) return;
    const step = Math.min(d, speed * dt);
    rt.x += (dx / d) * step;
    rt.z += (dz / d) * step;
    const yaw = Math.atan2(dx, dz);
    rt.rotationY = lerpAngle(rt.rotationY, yaw, dt * 10);
  }

  private stepEconomyBilling(dt: number): void {
    if (!this.callbacks) return;
    this.minuteAccumulator += dt;
    const CYCLE_SECONDS = 15;
    if (this.minuteAccumulator < CYCLE_SECONDS) return;

    const fractionOfMinute = this.minuteAccumulator / 60;
    this.minuteAccumulator = 0;

    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const workers = this.callbacks.getPlayerWorkers();

    const salaryPerMin = workers.reduce((sum, w) => sum + w.salaryPerMin, 0);
    const adCostPerMin = AD_CAMPAIGNS[eco.adCampaign].costPerMin;
    const baseBayUtilityPerMin =
      upgrades.bays * BAY_UTILITY_PER_MIN * getUtilityDiscount(upgrades.ecoSolar);

    const salaryCharge = Math.round(salaryPerMin * fractionOfMinute);
    const adCharge = Math.round(adCostPerMin * fractionOfMinute);
    const utilityCharge = Math.round(
      baseBayUtilityPerMin * fractionOfMinute + this.minutePlayerUtility
    );

    const scaledPlayerRevPerMin = Math.round(this.minutePlayerRev / fractionOfMinute);
    const scaledCompRevPerMin = Math.round(this.minuteCompRev / fractionOfMinute);

    this.minutePlayerRev = 0;
    this.minuteCompRev = 0;
    this.minutePlayerUtility = 0;

    this.callbacks.onEconomyMinuteTick(
      utilityCharge,
      salaryCharge,
      adCharge,
      scaledPlayerRevPerMin,
      scaledCompRevPerMin
    );
  }
}

export const gameSimulation = new GameSimulation();
