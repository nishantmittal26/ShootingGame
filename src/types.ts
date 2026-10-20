import type { Object3D, Vector3 } from 'three';

export type EnemyKind = 'plane' | 'helicopter';

export type PowerUpKind = 'weapon' | 'rapidFire' | 'missiles' | 'shield' | 'repair';

export type ProjectileOwner = 'player' | 'enemy';

export type Formation = 'single' | 'line' | 'vee' | 'stagger' | 'column';

export type BossPhase = 'spread' | 'missiles' | 'strafe';

export type WeaponTier = 1 | 2 | 3;

/** One scripted enemy group, triggered when the run passes `atDistance`. */
export interface WaveSpec {
  atDistance: number;
  kind: EnemyKind;
  count: number;
  formation: Formation;
  /** Lateral spacing between formation members, in world units. */
  spread: number;
  /** Centre altitude of the formation. */
  altitude: number;
  /** Multiplier on the kind's base closing speed. */
  speed: number;
}

/** Mutable state for a single attempt at the route. */
export interface RunState {
  distanceTravelled: number;
  trackLength: number;
  score: number;
  kills: number;
  nextWaveIndex: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  finishCrossed: boolean;
  elapsed: number;
}

/**
 * Anything a projectile can hit. Position is read directly rather than through the
 * scene node so collision never depends on matrix updates having run.
 */
export interface Damageable {
  readonly position: Vector3;
  readonly radius: number;
  health: number;
  alive: boolean;
  applyDamage(amount: number): void;
}

export interface SceneBound {
  readonly object: Object3D;
}

/**
 * The slice of the weapon system that hostiles need.
 *
 * Enemies depend on this narrow interface rather than on the weapon system itself, which
 * keeps the dependency pointing one way: the weapon system never has to know what an
 * enemy is.
 */
export interface EnemyFireApi {
  spawnEnemyShot(
    origin: Vector3,
    aimPoint: Vector3,
    speed: number,
    damage: number,
    life: number,
    homingTarget?: Damageable | null,
  ): void;
}
