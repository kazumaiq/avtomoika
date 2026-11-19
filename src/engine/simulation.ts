import { soundEngine } from '../audio/soundEngine';
import { createCompetitorWorkers } from '../config/staff';
import {
  AD_CAMPAIGNS,
  getEquipmentSpeedMultiplier,
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
  CompetitorState,
  EconomyMetrics,
  FloatingPopup,
  OwnerSide,
  UpgradeLevels,
  Vec3,
  VehicleEntity,
  WashStage,
  WorkerProfile,
  WorkerRuntime,
} from '../types/game';
import { buildSmoothPath, distanceXZ, lerpAngle, normalizeAngle } from './pathing';

export interface SimulationCallbacks {
  getEconomy: () => EconomyMetrics;
  getUpgrades: () => UpgradeLevels;
  getPlayerWorkers: () => WorkerProfile[];
  getCompetitor: () => CompetitorState;
  getDay: () => number;
  getTimeOfDay: () => number;
  getTimeMode: () => string;
  getShowPopups: () => boolean;
  onPlayerWashComplete: (payment: number, repDelta: number, workerId: string | null) => void;
  onPlayerCarLost: (repDelta: number) => void;
  onCompetitorWashComplete: (payment: number) => void;
  onEconomyMinuteTick: (
    playerUtilityCost: number,
    playerSalaryCost: number,
    playerAdCost: number,
    playerMinuteRev: number,
    compMinuteRev: number
  ) => void;
  onTimeAdvance: (newTimeOfDay: number, dayDelta: number, minuteDelta: number) => void;
  onCompetitorUpdate: (patch: Partial<CompetitorState>) => void;
  onEntityListChanged: () => void;
}

class GameSimulation {
  public vehicles: VehicleEntity[] = [];
  public workerRuntimes: Map<string, WorkerRuntime> = new Map();
  public competitorWorkers: WorkerProfile[] = createCompetitorWorkers(2);
  public popups: FloatingPopup[] = [];

  private callbacks: SimulationCallbacks | null = null;
  private spawnTimer = 1.2;
  private minuteAccumulator = 0;
  private minutePlayerRev = 0;
  private minuteCompRev = 0;
  private minutePlayerUtility = 0;
  private entityCounter = 1;
  private initialized = false;

  public bind(callbacks: SimulationCallbacks): void {
    this.callbacks = callbacks;
    this.syncWorkerRuntimes();
    if (!this.initialized) {
      this.initialized = true;
      this.seedInitialLiveTraffic();
    }
  }

  public reset(): void {
    this.vehicles = [];
    this.workerRuntimes.clear();
    this.popups = [];
    this.competitorWorkers = createCompetitorWorkers(2);
    this.spawnTimer = 1.0;
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
    // Start with cars already arriving at lot entrance on both AUTOMOIKA and TURBO SHINE
    this.spawnCustomerVehicle('player', 0.85);
    this.spawnCustomerVehicle('competitor', 0.85);
    this.spawnCustomerVehicle('player', 0.25);
    this.callbacks.onEntityListChanged();
  }

  public syncWorkerRuntimes(): void {
    if (!this.callbacks) return;
    const playerWorkers = this.callbacks.getPlayerWorkers();
    const comp = this.callbacks.getCompetitor();

    // Ensure competitor worker count matches competitor bays
    if (this.competitorWorkers.length !== comp.bays) {
      this.competitorWorkers = createCompetitorWorkers(comp.bays);
    }

    const allProfiles = [...playerWorkers, ...this.competitorWorkers];
    const validIds = new Set(allProfiles.map((w) => w.id));

    // Remove deleted workers
    for (const [id, rt] of this.workerRuntimes.entries()) {
      if (!validIds.has(id)) {
        // Release any vehicle assigned to fired worker
        for (const v of this.vehicles) {
          if (v.assignedWorkerId === id) {
            v.assignedWorkerId = null;
          }
        }
        this.workerRuntimes.delete(id);
        void rt;
      }
    }

    // Add missing worker runtimes
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
    return Math.min(0.92, Math.max(0.08, pScore / total));
  }

  private computeAttractionScore(
    owner: OwnerSide,
    eco: EconomyMetrics,
    upgrades: UpgradeLevels,
    comp: CompetitorState
  ): number {
    const queueLen = this.getQueueCount(owner);
    if (owner === 'player') {
      const quality = getPlayerQualityScore(upgrades);
      const priceFactor = Math.max(0.25, 2.35 - (eco.washPrice - 15) * 0.032);
      const repFactor = 0.7 + eco.reputation * 0.45;
      const qualityFactor = 0.7 + quality * 0.35;
      const adBoost = AD_CAMPAIGNS[eco.adCampaign].demandBoost;
      const queuePenalty = Math.max(0.25, 1 - queueLen * (0.11 - (upgrades.vipLounge - 1) * 0.018));
      return Math.max(0.2, (priceFactor + repFactor + qualityFactor + adBoost) * queuePenalty);
    } else {
      const effectivePrice = comp.promoActive ? comp.price * 0.82 : comp.price;
      const priceFactor = Math.max(0.25, 2.35 - (effectivePrice - 15) * 0.032);
      const repFactor = 0.7 + comp.reputation * 0.45;
      const qualityFactor = 0.7 + comp.quality * 0.35;
      const queuePenalty = Math.max(0.25, 1 - queueLen * 0.12);
      return Math.max(0.2, (priceFactor + repFactor + qualityFactor) * queuePenalty);
    }
  }

  public addPopup(x: number, y: number, z: number, text: string, color: string): void {
    if (!this.callbacks || !this.callbacks.getShowPopups()) return;
    this.popups.push({
      id: `pop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      z,
      text,
      color,
      createdAt: performance.now(),
      duration: 1850,
    });
    if (this.popups.length > 18) {
      this.popups.shift();
    }
  }

  public step(rawDt: number, speedMultiplier: number): void {
    if (!this.callbacks || speedMultiplier <= 0) return;
    const dt = Math.min(rawDt, 0.05) * speedMultiplier;
    if (dt <= 0) return;

    this.syncWorkerRuntimes();

    // 1. Advance time of day & in-game clock
    const timeMode = this.callbacks.getTimeMode();
    // Full day cycle = 240 real seconds at 1x speed
    const timeAdvance = timeMode === 'cycle' ? dt / 240 : 0;
    let nextTime = this.callbacks.getTimeOfDay() + timeAdvance;
    let dayDelta = 0;
    if (nextTime >= 1) {
      nextTime -= 1;
      dayDelta = 1;
    }
    const minuteDelta = dt / 60;
    this.callbacks.onTimeAdvance(nextTime, dayDelta, minuteDelta);

    // 2. Competitor autonomous evolution & promotions
    this.stepCompetitorAI(dt);

    // 3. Vehicle spawning based on total city demand + advertising
    this.stepSpawner(dt);

    // 4. Queue advancement & bay dispatching
    this.stepSiteDispatch('player');
    this.stepSiteDispatch('competitor');

    // 5. Vehicle movement, washing progression & cleanup
    this.stepVehicles(dt);

    // 6. Worker AI & animations
    this.stepWorkers(dt);

    // 7. Economy minute tick (every 12 real seconds = 1 financial tick scaled to per-minute,
    //    or smooth 15-second billing cycles so player sees expenses clearly!)
    this.stepEconomyBilling(dt);

    // 8. Prune expired floating popups
    const nowMs = performance.now();
    if (this.popups.length > 0) {
      this.popups = this.popups.filter((p) => nowMs - p.createdAt < p.duration);
    }
  }

  private stepCompetitorAI(dt: number): void {
    if (!this.callbacks) return;
    const comp = this.callbacks.getCompetitor();
    const day = this.callbacks.getDay();

    // Competitor occasionally runs a flash discount promo for 35 seconds
    let promoActive = comp.promoActive;
    let promoTimer = comp.promoTimer - dt;
    if (promoTimer <= 0) {
      if (promoActive) {
        promoActive = false;
        promoTimer = 70 + Math.random() * 55;
      } else if (Math.random() < 0.45) {
        promoActive = true;
        promoTimer = 32;
      } else {
        promoTimer = 50;
      }
      this.callbacks.onCompetitorUpdate({ promoActive, promoTimer });
    } else {
      comp.promoTimer = promoTimer;
    }

    // Competitor gradually upgrades on Day 3+ if player is growing
    if (day >= 3 && comp.lastUpgradeDay < day) {
      const nextBays = day >= 5 ? 3 : comp.bays;
      const nextQuality = Math.min(4.2, +(comp.quality + 0.15).toFixed(2));
      const nextSpeed = Math.min(1.55, +(comp.speedMultiplier + 0.05).toFixed(2));
      this.callbacks.onCompetitorUpdate({
        bays: nextBays,
        quality: nextQuality,
        speedMultiplier: nextSpeed,
        lastUpgradeDay: day,
      });
    }
  }

  private stepSpawner(dt: number): void {
    if (!this.callbacks) return;
    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const comp = this.callbacks.getCompetitor();

    const adSpec = AD_CAMPAIGNS[eco.adCampaign];
    const baseInterval = 4.2 / adSpec.trafficMultiplier;
    const bayBonus = Math.max(0.65, 1 - (upgrades.bays - 1) * 0.11);
    const targetInterval = Math.max(1.8, baseInterval * bayBonus);

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = targetInterval * (0.75 + Math.random() * 0.5);

    // Cap total active customer cars to keep scene crisp and performant
    if (this.vehicles.length >= 16) return;

    const playerShare = this.getPlayerAttractionShare();
    let chosenSide: OwnerSide = Math.random() < playerShare ? 'player' : 'competitor';

    const playerMaxQ = getMaxQueueCapacity(upgrades.queueLot);
    const playerQ = this.getQueueCount('player');
    const compQ = this.getQueueCount('competitor');

    // If chosen side's queue is full, consider rival or bail out
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

    // Avoid spawning overlapping a car still near spawn point
    const layout = getSiteLayout(chosenSide);
    const tooClose = this.vehicles.some(
      (v) =>
        v.owner === chosenSide &&
        distanceXZ(v.x, v.z, layout.spawnPoint.x, layout.spawnPoint.z) < 7.5
    );
    if (tooClose) return;

    this.spawnCustomerVehicle(chosenSide, 0);
    if (chosenSide === 'player') {
      soundEngine.playCarArrival();
    }
    this.callbacks.onEntityListChanged();
    void comp;
  }

  private spawnCustomerVehicle(owner: OwnerSide, startProgress: number): void {
    if (!this.callbacks) return;
    const eco = this.callbacks.getEconomy();
    const comp = this.callbacks.getCompetitor();
    const layout = getSiteLayout(owner);

    const rep = owner === 'player' ? eco.reputation : comp.reputation;
    const picked = pickVehicleForReputation(rep);
    const spec = VEHICLE_SPECS[picked.category];

    const rawApproach: Vec3[] = [
      layout.spawnPoint,
      layout.roadEntryPoint,
      layout.lotEntryPoint,
    ];
    const smoothApproach = buildSmoothPath(rawApproach, 2.8);

    // Optional jump ahead for initial world seeding
    const startIdx = Math.min(
      smoothApproach.length - 2,
      Math.floor(startProgress * (smoothApproach.length - 1))
    );
    const startPt = smoothApproach[startIdx];
    const nextPt = smoothApproach[startIdx + 1] ?? layout.lotEntryPoint;
    const initialYaw = Math.atan2(nextPt.x - startPt.x, nextPt.z - startPt.z);

    const basePrice = owner === 'player' ? eco.washPrice : (comp.promoActive ? comp.price * 0.82 : comp.price);
    const expectedPrice = Math.round(basePrice * spec.priceMultiplier);

    this.entityCounter += 1;
    const car: VehicleEntity = {
      id: `car-${owner[0]}-${this.entityCounter}`,
      owner,
      category: picked.category,
      modelName: picked.modelName,
      appearance: picked.appearance,
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
      dirtLevel: 0.82 + Math.random() * 0.18,
      foamLevel: 0,
      washProgress: 0,
      patience: 1.0,
      queueSlot: -1,
      bayIndex: -1,
      assignedWorkerId: null,
      waypoints: smoothApproach,
      waypointIndex: startIdx + 1,
      expectedPrice,
      washDuration: spec.baseWashSeconds,
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

    // 1. Compact queue slots so cars move forward cleanly when slot ahead opens
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
        car.waypoints = buildSmoothPath(
          [{ x: car.x, y: 0, z: car.z }, slotPos],
          1.4
        );
        car.waypointIndex = 1;
        if (car.state === 'queued') {
          car.state = 'entering';
        }
      }
    });

    // 2. Dispatch front queued car into any free bay that has an available worker
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

      // Find an idle worker eligible for this bay
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

      // Direct worker to greet car at bay entrance
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
    // Priority 1: worker explicitly assigned to this bay
    for (const w of workers) {
      if (w.assignedBay !== bayIdx) continue;
      const rt = this.workerRuntimes.get(w.id);
      if (rt && !rt.activeVehicleId) return w;
    }
    // Priority 2: auto-assigned worker (-1)
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

        // Patience drain while waiting in queue
        const patienceRate =
          car.owner === 'player'
            ? 0.011 / (1 + (upgrades.vipLounge - 1) * 0.28)
            : 0.013;
        car.patience = Math.max(0, car.patience - patienceRate * dt);
        if (car.patience <= 0) {
          // Customer got tired of waiting and drives away!
          if (car.owner === 'player') {
            this.callbacks.onPlayerCarLost(-0.08);
            this.addPopup(car.x, 2.4, car.z, 'Уехал (очередь)', '#FF3B5C');
          }
          this.sendCarToExit(car, true);
        }
        continue;
      }

      // Movement along waypoints
      const target = car.waypoints[car.waypointIndex];
      if (!target) {
        this.handlePathFinished(car, toRemove);
        continue;
      }

      const dist = distanceXZ(car.x, car.z, target.x, target.z);
      const isFinalWp = car.waypointIndex >= car.waypoints.length - 1;

      // Determine cruising speed based on state
      let desiredSpeed =
        car.state === 'approaching' || car.state === 'leaving'
          ? 10.5
          : car.state === 'moving_to_bay' || car.state === 'entering'
            ? 5.0
            : 6.5;

      // Smoothly slow down near final stop (queue slot or wash bay)
      if (isFinalWp && (car.state === 'entering' || car.state === 'moving_to_bay')) {
        desiredSpeed = Math.min(desiredSpeed, Math.max(1.2, dist * 1.4));
      }

      // Check car ahead in same lane to avoid bumper clipping
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
      // Only brake if other car is directly in front cone
      if (dot > 0.72) {
        // Avoid deadlock between two cars facing opposite directions
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
      // Join queue
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
    car.rotationY = lerpAngle(car.rotationY, layout.bayCarRotationY, dt * 8);
    car.speed = 0;
    car.braking = true;

    // Ensure a worker is actively attached (in case player fired one mid-wash)
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
        // Wait until a worker becomes free
        return;
      }
    }

    const workerProfile = this.getWorkerProfileById(car.assignedWorkerId);
    const workerSpeed = workerProfile ? workerProfile.speed * workerProfile.morale : 1.0;
    const equipSpeed =
      car.owner === 'player'
        ? getEquipmentSpeedMultiplier(upgrades)
        : comp.speedMultiplier;

    const totalRate = (workerSpeed * equipSpeed) / Math.max(8, car.washDuration);
    car.washProgress = Math.min(1, car.washProgress + totalRate * dt);

    // Determine detailed wash stage & update realistic dirt/foam curves
    let stage: WashStage = 'greeting';
    if (car.washProgress < 0.07) {
      stage = 'greeting';
    } else if (car.washProgress < 0.34) {
      stage = 'rinse';
      const local = (car.washProgress - 0.07) / 0.27;
      car.dirtLevel = Math.max(0.72, 1.0 - local * 0.28);
      car.foamLevel = 0;
      if (car.owner === 'player') soundEngine.playWashStageSound('rinse');
    } else if (car.washProgress < 0.62) {
      stage = 'foam';
      const local = (car.washProgress - 0.34) / 0.28;
      car.foamLevel = Math.min(1.0, local * 1.15);
      car.dirtLevel = Math.max(0.55, 0.72 - local * 0.17);
      if (car.owner === 'player') soundEngine.playWashStageSound('foam');
    } else if (car.washProgress < 0.86) {
      stage = 'scrub';
      const local = (car.washProgress - 0.62) / 0.24;
      car.dirtLevel = Math.max(0.06, 0.55 * (1 - local));
      car.foamLevel = Math.max(0.12, 1.0 - local * 0.88);
      if (car.owner === 'player') soundEngine.playWashStageSound('scrub');
    } else {
      stage = 'dry';
      const local = (car.washProgress - 0.86) / 0.14;
      car.dirtLevel = Math.max(0, 0.06 * (1 - local));
      car.foamLevel = Math.max(0, 0.12 * (1 - local));
      if (car.owner === 'player') soundEngine.playWashStageSound('dry');
    }
    car.washStage = stage;

    // Wash finished!
    if (car.washProgress >= 1) {
      car.washStage = 'done';
      car.dirtLevel = 0;
      car.foamLevel = 0;
      car.sparkleTimer = 3.2;

      const workerQuality = workerProfile ? workerProfile.quality : 1.0;

      if (car.owner === 'player') {
        const foamTip = 1 + (upgrades.foamSystem - 1) * 0.14;
        const waxBonus = (upgrades.dryerWax - 1) * 4;
        const loungeTip = (upgrades.vipLounge - 1) * 2.5;
        const payment = Math.round(
          car.expectedPrice * (0.85 + workerQuality * 0.18) * foamTip + waxBonus + loungeTip
        );
        const repGain = +(0.025 + (upgrades.foamSystem + upgrades.vipLounge - 2) * 0.006).toFixed(3);
        const utilityForWash = Math.round(3.5 * getUtilityDiscount(upgrades.ecoSolar));

        this.minutePlayerRev += payment;
        this.minutePlayerUtility += utilityForWash;

        this.callbacks.onPlayerWashComplete(payment, repGain, car.assignedWorkerId);
        soundEngine.playCash();
        this.addPopup(car.x, 2.7, car.z, `+$${payment}`, '#22C55E');
      } else {
        const payment = Math.round(car.expectedPrice * (0.95 + comp.quality * 0.05));
        this.minuteCompRev += payment;
        this.callbacks.onCompetitorWashComplete(payment);
        this.addPopup(car.x, 2.6, car.z, `+$${payment}`, '#FF9F43');
      }

      // Free the worker with brief celebrate state
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

      // Brief celebration after finishing a car
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
        // Walk back to rest stand near assigned or default bay
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

      // Car is driving into bay: stand at greeting point and wave
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

      // Car is parked inside bay — patrol smoothly around all 4 sides!
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
          // Walk around car toward next side panel
          rt.action = 'walking';
          this.moveWorkerToward(rt, wp.x, wp.z, 2.8 * profile.speed, dt);
          // Keep spraying slightly while strafing during rinse/foam!
          rt.sprayTarget =
            stageAction === 'rinsing' || stageAction === 'foaming'
              ? { x: activeCar.x, y: 0.95, z: activeCar.z }
              : null;
        } else {
          // Work actively on this panel for ~1.1s then move to next side!
          rt.action = stageAction;
          const lookYaw = Math.atan2(activeCar.x - rt.x, activeCar.z - rt.z);
          rt.rotationY = lerpAngle(rt.rotationY, lookYaw, dt * 8);

          // Aim water/foam stream smoothly sweeping across car panels
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
    // Settle financial cycle every 15 seconds (scaled cleanly to per-minute rates!)
    const CYCLE_SECONDS = 15;
    if (this.minuteAccumulator < CYCLE_SECONDS) return;

    const fractionOfMinute = this.minuteAccumulator / 60;
    this.minuteAccumulator = 0;

    const eco = this.callbacks.getEconomy();
    const upgrades = this.callbacks.getUpgrades();
    const workers = this.callbacks.getPlayerWorkers();

    const salaryPerMin = workers.reduce((sum, w) => sum + w.salaryPerMin, 0);
    const adCostPerMin = AD_CAMPAIGNS[eco.adCampaign].costPerMin;
    const baseBayUtilityPerMin = upgrades.bays * 9 * getUtilityDiscount(upgrades.ecoSolar);

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
