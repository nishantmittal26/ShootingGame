import { Vector3 } from 'three';

/** Scratch vectors reused by the helpers below, so collision math never allocates. */
const segmentDelta = new Vector3();
const centreToStart = new Vector3();

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Frame-rate independent exponential approach toward `target`.
 *
 * A naive `current += (target - current) * rate` converges at a speed that depends on how
 * often it is called, which would make camera and control feel change with frame rate.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/**
 * Whether the segment from `start` to `end` touches the sphere at `centre`.
 *
 * Projectiles can travel further in one simulation step than a target is wide, so testing
 * only the projectile's current position would let shots pass through enemies. This tests
 * the whole path swept during the step instead.
 */
export function segmentIntersectsSphere(
  start: Vector3,
  end: Vector3,
  centre: Vector3,
  radius: number,
): boolean {
  segmentDelta.subVectors(end, start);
  centreToStart.subVectors(start, centre);

  const radiusSq = radius * radius;
  const startDistSq = centreToStart.lengthSq();
  if (startDistSq <= radiusSq) {
    return true;
  }

  const a = segmentDelta.lengthSq();
  if (a < 1e-8) {
    return false;
  }

  const b = 2 * centreToStart.dot(segmentDelta);
  const c = startDistSq - radiusSq;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return false;
  }

  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1;
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

/** Picks a key from a weight map, with probability proportional to each weight. */
export function pickWeighted<K extends string>(weights: Record<K, number>): K {
  const keys = Object.keys(weights) as K[];
  let total = 0;
  for (const key of keys) {
    total += weights[key];
  }

  let roll = Math.random() * total;
  for (const key of keys) {
    roll -= weights[key];
    if (roll <= 0) {
      return key;
    }
  }

  return keys[keys.length - 1] as K;
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
