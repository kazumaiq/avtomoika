import type { OwnerSide, Vec3 } from '../types/game';

/**
 * World coordinate system:
 * X axis: along the urban avenue (-60 west to +60 east)
 * Z axis: across the street
 *   Z = -5 .. +5   : Two-lane main avenue (Eastbound at Z=+2.3, Westbound at Z=-2.3)
 *   Z = +5 .. +7.5 : South sidewalk (Player side)
 *   Z = +7.5 .. +32: Player car wash "AUTOMOIKA"
 *   Z = -7.5 .. -5 : North sidewalk (Competitor side)
 *   Z = -30 .. -7.5: Competitor car wash "TURBO SHINE"
 */

export const ROAD_Z = {
  southLane: 2.3, // Eastbound (+X) or Westbound (-X) -> Let's drive East-to-West (-X) on north lane (Z=-2.3) and West-to-East (+X) on south lane (Z=+2.3)
  northLane: -2.3,
  southCurb: 5.0,
  northCurb: -5.0,
} as const;

export interface WashSiteLayout {
  owner: OwnerSide;
  /** X positions of the wash bays */
  bayPositions: Vec3[];
  /** Direction car faces while inside bay (radians around Y) */
  bayCarRotationY: number;
  /** Queue slot world coordinates (index 0 = front of queue closest to bays) */
  queueSlots: Vec3[];
  /** Car yaw while parked in queue */
  queueCarRotationY: number;
  /** Entry point on road where car turns into driveway */
  roadEntryPoint: Vec3;
  /** Driveway entry point inside lot */
  lotEntryPoint: Vec3;
  /** Apron lane in front of bays for smooth turning */
  bayApronZ: number;
  /** Exit apron Z behind/beside bays */
  exitApronPoint: Vec3;
  /** Driveway exit onto road */
  roadExitPoint: Vec3;
  /** Final offscreen despawn point on road */
  despawnPoint: Vec3;
  /** Spawn point on road */
  spawnPoint: Vec3;
  /** Worker rest/idle stand positions near each bay */
  workerRestPositions: Vec3[];
}

export const PLAYER_LAYOUT: WashSiteLayout = {
  owner: 'player',
  // 4 Wash Bays aligned along X at Z = 18.5
  bayPositions: [
    { x: -7.5, y: 0, z: 18.5 },
    { x: -1.5, y: 0, z: 18.5 },
    { x: 4.5, y: 0, z: 18.5 },
    { x: 10.5, y: 0, z: 18.5 },
  ],
  // Cars enter from front apron (Z=12.2) heading south (+Z), so yaw = 0 faces +Z
  bayCarRotationY: 0,
  // Queue along the front lot lane (Z = 10.6), cars enter from East (+X) heading West (-X)
  queueSlots: [
    { x: -5.0, y: 0, z: 10.4 },
    { x: 0.2, y: 0, z: 10.4 },
    { x: 5.4, y: 0, z: 10.4 },
    { x: 10.6, y: 0, z: 10.4 },
    { x: 15.8, y: 0, z: 10.4 },
    { x: 17.5, y: 0, z: 15.2 },
    { x: 17.5, y: 0, z: 20.2 },
    { x: 17.5, y: 0, z: 25.2 },
  ],
  queueCarRotationY: -Math.PI / 2,
  spawnPoint: { x: -56, y: 0, z: ROAD_Z.southLane },
  roadEntryPoint: { x: 18.5, y: 0, z: ROAD_Z.southLane },
  lotEntryPoint: { x: 18.5, y: 0, z: 10.4 },
  bayApronZ: 12.8,
  exitApronPoint: { x: -16.8, y: 0, z: 24.5 },
  roadExitPoint: { x: -16.8, y: 0, z: ROAD_Z.southLane },
  despawnPoint: { x: 58, y: 0, z: ROAD_Z.southLane },
  workerRestPositions: [
    { x: -10.0, y: 0, z: 15.0 },
    { x: -4.0, y: 0, z: 15.0 },
    { x: 2.0, y: 0, z: 15.0 },
    { x: 8.0, y: 0, z: 15.0 },
  ],
};

export const COMPETITOR_LAYOUT: WashSiteLayout = {
  owner: 'competitor',
  // 3 Wash Bays aligned along X at Z = -18.5 (mirroring across street)
  bayPositions: [
    { x: -6.0, y: 0, z: -18.5 },
    { x: 0.5, y: 0, z: -18.5 },
    { x: 7.0, y: 0, z: -18.5 },
  ],
  // Cars enter from front apron (Z=-12.2) heading north (-Z), yaw = Math.PI
  bayCarRotationY: Math.PI,
  // Queue along front lot lane (Z = -10.4), entering from West (-X) heading East (+X)
  queueSlots: [
    { x: 5.0, y: 0, z: -10.4 },
    { x: -0.2, y: 0, z: -10.4 },
    { x: -5.4, y: 0, z: -10.4 },
    { x: -10.6, y: 0, z: -10.4 },
    { x: -15.8, y: 0, z: -10.4 },
    { x: -17.2, y: 0, z: -15.2 },
  ],
  queueCarRotationY: Math.PI / 2,
  spawnPoint: { x: 56, y: 0, z: ROAD_Z.northLane },
  roadEntryPoint: { x: -17.5, y: 0, z: ROAD_Z.northLane },
  lotEntryPoint: { x: -17.5, y: 0, z: -10.4 },
  bayApronZ: -12.8,
  exitApronPoint: { x: 16.5, y: 0, z: -24.0 },
  roadExitPoint: { x: 16.5, y: 0, z: ROAD_Z.northLane },
  despawnPoint: { x: -58, y: 0, z: ROAD_Z.northLane },
  workerRestPositions: [
    { x: -8.5, y: 0, z: -15.0 },
    { x: -2.0, y: 0, z: -15.0 },
    { x: 4.5, y: 0, z: -15.0 },
  ],
};

export function getSiteLayout(owner: OwnerSide): WashSiteLayout {
  return owner === 'player' ? PLAYER_LAYOUT : COMPETITOR_LAYOUT;
}

/**
 * Generates an ordered loop of 8 patrol points around a car parked in a wash bay
 * so workers physically walk around all four sides, front bumper, and rear trunk!
 */
export function getBayPatrolPoints(owner: OwnerSide, bayIndex: number): Vec3[] {
  const layout = getSiteLayout(owner);
  const bay = layout.bayPositions[bayIndex] ?? layout.bayPositions[0];
  const sideOffset = 1.88;
  const longOffset = 2.65;
  const dir = owner === 'player' ? 1 : -1;

  return [
    { x: bay.x - sideOffset, y: 0, z: bay.z - 1.3 * dir },
    { x: bay.x - sideOffset, y: 0, z: bay.z + 1.3 * dir },
    { x: bay.x - 0.9, y: 0, z: bay.z + longOffset * dir },
    { x: bay.x + 0.9, y: 0, z: bay.z + longOffset * dir },
    { x: bay.x + sideOffset, y: 0, z: bay.z + 1.3 * dir },
    { x: bay.x + sideOffset, y: 0, z: bay.z - 1.3 * dir },
    { x: bay.x + 0.9, y: 0, z: bay.z - longOffset * dir },
    { x: bay.x - 0.9, y: 0, z: bay.z - longOffset * dir },
  ];
}

export function getBayGreetingPoint(owner: OwnerSide, bayIndex: number): Vec3 {
  const layout = getSiteLayout(owner);
  const bay = layout.bayPositions[bayIndex] ?? layout.bayPositions[0];
  const dir = owner === 'player' ? -1 : 1;
  return {
    x: bay.x - 1.95,
    y: 0,
    z: bay.z + 3.8 * dir,
  };
}
