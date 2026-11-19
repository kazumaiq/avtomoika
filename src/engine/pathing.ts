import type { Vec3 } from '../types/game';

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return current + diff * Math.min(1, Math.max(0, t));
}

export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.hypot(dx, dz);
}

/**
 * Computes smooth intermediate corner rounding between raw polyline waypoints
 * so cars turn naturally along curves instead of snapping 90-degree corners.
 */
export function buildSmoothPath(points: Vec3[], cornerRadius = 2.1): Vec3[] {
  if (points.length <= 2) return points.map((p) => ({ ...p }));

  const out: Vec3[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = prev.x - curr.x;
    const v1z = prev.z - curr.z;
    const len1 = Math.hypot(v1x, v1z);

    const v2x = next.x - curr.x;
    const v2z = next.z - curr.z;
    const len2 = Math.hypot(v2x, v2z);

    if (len1 < 0.2 || len2 < 0.2) {
      out.push({ ...curr });
      continue;
    }

    const r = Math.min(cornerRadius, len1 * 0.42, len2 * 0.42);
    const pStart = {
      x: curr.x + (v1x / len1) * r,
      y: curr.y,
      z: curr.z + (v1z / len1) * r,
    };
    const pEnd = {
      x: curr.x + (v2x / len2) * r,
      y: curr.y,
      z: curr.z + (v2z / len2) * r,
    };

    // Quadratic bezier arc through corner
    const segments = 4;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const omt = 1 - t;
      out.push({
        x: omt * omt * pStart.x + 2 * omt * t * curr.x + t * t * pEnd.x,
        y: curr.y,
        z: omt * omt * pStart.z + 2 * omt * t * curr.z + t * t * pEnd.z,
      });
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}
