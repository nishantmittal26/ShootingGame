import { Vector3, type Scene } from 'three';
import { tuning } from '../config/tuning';
import { Pool } from '../core/Pool';
import { Projectile, ProjectileRenderer, type ProjectileVisual } from '../entities/Projectile';
import { PLAYER_MUZZLES } from '../models/playerModel';
import type { Damageable, EnemyFireApi, ProjectileOwner, WeaponTier } from '../types';
import type { AudioSystem } from './AudioSystem';
import type { EffectsSystem } from './EffectsSystem';

const FORWARD = new Vector3(0, 0, -1);
const UP = new Vector3(0, 1, 0);
const scratchOrigin = new Vector3();
const scratchDirection = new Vector3();
const scratchDesired = new Vector3();
const scratchCurrent = new Vector3();

/** Beyond these bounds a projectile can no longer hit anything, so it is recycled. */
const LATERAL_LIMIT = 320;
const CEILING = 260;

export class WeaponSystem implements EnemyFireApi {
  private readonly pool: Pool<Projectile>;
  private readonly renderer: ProjectileRenderer;

  constructor(
    scene: Scene,
    private readonly effects: EffectsSystem,
    private readonly audio: AudioSystem,
  ) {
    const capacity = tuning.effects.projectilePool;
    this.pool = new Pool(capacity, () => new Projectile());
    this.renderer = new ProjectileRenderer(scene, capacity);
  }

  /** Exposed for the collision system to iterate; do not mutate the array itself. */
  get projectiles(): readonly Projectile[] {
    return this.pool.items;
  }

  private spawn(
    owner: ProjectileOwner,
    visual: ProjectileVisual,
    origin: Vector3,
    velocity: Vector3,
    damage: number,
    life: number,
    homingTarget: Damageable | null,
    turnRate: number,
  ): Projectile | null {
    const projectile = this.pool.acquire();
    if (!projectile) {
      return null;
    }

    projectile.owner = owner;
    projectile.visual = visual;
    projectile.position.copy(origin);
    projectile.previousPosition.copy(origin);
    projectile.velocity.copy(velocity);
    projectile.damage = damage;
    projectile.life = life;
    projectile.homingTarget = homingTarget;
    projectile.turnRate = turnRate;
    return projectile;
  }

  /**
   * Fires the cannon. The tier decides the pattern: a single centred shot, a pair from the
   * wing muzzles, then that pair plus an outward-angled pair for a spread that covers
   * enemies the player is not perfectly lined up on.
   */
  firePlayerCannon(playerPosition: Vector3, tier: WeaponTier): void {
    const cannon = tuning.weapons.cannon;

    if (tier === 1) {
      scratchOrigin.set(
        playerPosition.x,
        playerPosition.y,
        playerPosition.z + cannon.centreMuzzleZ,
      );
      this.spawnCannonShot(scratchOrigin, 0);
      this.effects.spawnMuzzleFlash(scratchOrigin);
    } else {
      for (const muzzle of PLAYER_MUZZLES) {
        scratchOrigin.set(
          playerPosition.x + muzzle.x,
          playerPosition.y + muzzle.y,
          playerPosition.z + muzzle.z,
        );
        this.spawnCannonShot(scratchOrigin, 0);
        this.effects.spawnMuzzleFlash(scratchOrigin);

        if (tier === 3) {
          this.spawnCannonShot(
            scratchOrigin,
            Math.sign(muzzle.x) * cannon.outerAngle,
          );
        }
      }
    }

    this.audio.cannon();
  }

  private spawnCannonShot(origin: Vector3, yaw: number): void {
    const cannon = tuning.weapons.cannon;
    scratchDirection.copy(FORWARD).applyAxisAngle(UP, yaw).multiplyScalar(cannon.speed);
    this.spawn('player', 'tracer', origin, scratchDirection, cannon.damage, cannon.life, null, 0);
  }

  /**
   * Launches a homing missile at the nearest valid target.
   *
   * Returns false when nothing is in range so the caller can avoid spending ammunition on
   * an empty sky.
   */
  firePlayerMissile(playerPosition: Vector3, targets: readonly Damageable[]): boolean {
    const missile = tuning.weapons.missile;
    const target = this.findNearestTarget(playerPosition, targets, missile.lockRange);
    if (!target) {
      return false;
    }

    scratchOrigin.set(playerPosition.x, playerPosition.y - 0.6, playerPosition.z - 1.2);
    scratchDirection.copy(FORWARD).multiplyScalar(missile.speed);
    const spawned = this.spawn(
      'player',
      'missile',
      scratchOrigin,
      scratchDirection,
      missile.damage,
      missile.life,
      target,
      missile.turnRate,
    );

    if (!spawned) {
      return false;
    }

    this.effects.spawnMuzzleFlash(scratchOrigin, 0xff8ae0);
    this.audio.missileLaunch();
    return true;
  }

  private findNearestTarget(
    from: Vector3,
    targets: readonly Damageable[],
    range: number,
  ): Damageable | null {
    let best: Damageable | null = null;
    let bestDistance = range * range;

    for (const target of targets) {
      if (!target.alive) {
        continue;
      }
      // Only lock forward: a missile that turns around to chase something already past the
      // player wastes ammunition and looks broken.
      if (target.position.z > from.z - 8) {
        continue;
      }
      const distance = target.position.distanceToSquared(from);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = target;
      }
    }

    return best;
  }

  spawnEnemyShot(
    origin: Vector3,
    aimPoint: Vector3,
    speed: number,
    damage: number,
    life: number,
    homingTarget: Damageable | null = null,
  ): void {
    scratchDirection.subVectors(aimPoint, origin);
    if (scratchDirection.lengthSq() < 1e-6) {
      scratchDirection.set(0, 0, 1);
    }
    scratchDirection.normalize().multiplyScalar(speed);

    const spawned = this.spawn(
      'enemy',
      homingTarget ? 'missile' : 'bolt',
      origin,
      scratchDirection,
      damage,
      life,
      homingTarget,
      homingTarget ? tuning.weapons.missile.turnRate * 0.45 : 0,
    );

    if (spawned) {
      this.audio.enemyShot();
    }
  }

  release(projectile: Projectile): void {
    this.pool.release(projectile);
  }

  update(dt: number): void {
    const items = this.pool.items;

    for (let i = 0; i < items.length; i += 1) {
      const projectile = items[i] as Projectile;
      if (!projectile.active) {
        continue;
      }

      projectile.life -= dt;
      if (projectile.life <= 0) {
        this.pool.release(projectile);
        continue;
      }

      if (projectile.homingTarget) {
        if (projectile.homingTarget.alive) {
          this.steerToward(projectile, dt);
        } else {
          // Losing a target leaves the missile flying straight rather than snapping to a
          // new one, which keeps the player's aim meaningful.
          projectile.homingTarget = null;
        }
      }

      projectile.previousPosition.copy(projectile.position);
      projectile.position.addScaledVector(projectile.velocity, dt);

      if (projectile.visual === 'missile') {
        this.effects.spawnTrail(
          projectile.position,
          projectile.owner === 'player' ? 0xff9ad8 : 0xffb27a,
        );
      }

      if (
        projectile.position.z > tuning.world.cullPlane ||
        Math.abs(projectile.position.x) > LATERAL_LIMIT ||
        projectile.position.y < tuning.world.groundY - 8 ||
        projectile.position.y > CEILING
      ) {
        this.pool.release(projectile);
      }
    }
  }

  private steerToward(projectile: Projectile, dt: number): void {
    const target = projectile.homingTarget;
    if (!target) {
      return;
    }

    const speed = projectile.velocity.length();
    if (speed < 1e-4) {
      return;
    }

    scratchDesired.subVectors(target.position, projectile.position);
    if (scratchDesired.lengthSq() < 1e-6) {
      return;
    }
    scratchDesired.normalize();
    scratchCurrent.copy(projectile.velocity).divideScalar(speed);

    // Cap the turn per step so a missile arcs onto its target instead of teleporting its
    // heading, which is what makes dodging one possible.
    const angle = scratchCurrent.angleTo(scratchDesired);
    const maxTurn = projectile.turnRate * dt;
    const t = angle < 1e-5 ? 1 : Math.min(1, maxTurn / angle);

    scratchCurrent.lerp(scratchDesired, t).normalize();
    projectile.velocity.copy(scratchCurrent).multiplyScalar(speed);
  }

  sync(): void {
    this.renderer.sync(this.pool.items);
  }

  reset(): void {
    this.pool.releaseAll();
    this.sync();
  }
}
