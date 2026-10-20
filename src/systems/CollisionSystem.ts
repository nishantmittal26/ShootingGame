import { Vector3 } from 'three';
import { tuning } from '../config/tuning';
import { segmentIntersectsSphere } from '../core/mathUtils';
import type { Boss, Turret } from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import type { HitResult, Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import type { AudioSystem } from './AudioSystem';
import type { EffectsSystem } from './EffectsSystem';
import type { WeaponSystem } from './WeaponSystem';

export interface CombatEvents {
  onEnemyKilled(enemy: Enemy): void;
  onTurretDestroyed(turret: Turret): void;
  onBossKilled(boss: Boss): void;
  onPlayerDied(): void;
}

const scratchImpact = new Vector3();

/**
 * Resolves all contact for the step: shots against aircraft, and aircraft against each
 * other.
 *
 * Bounding spheres are used throughout. They are a loose fit for an aircraft silhouette,
 * but a generous hitbox on enemies and a slightly tight one on the player is exactly the
 * asymmetry that makes a shooter feel fair, so the approximation is a feature here.
 */
export class CollisionSystem {
  constructor(
    private readonly effects: EffectsSystem,
    private readonly audio: AudioSystem,
    private readonly events: CombatEvents,
  ) {}

  resolve(
    player: Player,
    enemies: readonly Enemy[],
    boss: Boss | null,
    weapons: WeaponSystem,
  ): void {
    this.resolveProjectiles(player, enemies, boss, weapons);
    this.resolveRamming(player, enemies, boss);
  }

  private resolveProjectiles(
    player: Player,
    enemies: readonly Enemy[],
    boss: Boss | null,
    weapons: WeaponSystem,
  ): void {
    const projectiles = weapons.projectiles;

    for (let i = 0; i < projectiles.length; i += 1) {
      const projectile = projectiles[i] as Projectile;
      if (!projectile.active) {
        continue;
      }

      if (projectile.owner === 'player') {
        this.resolvePlayerShot(projectile, enemies, boss, weapons);
      } else {
        this.resolveEnemyShot(projectile, player, weapons);
      }
    }
  }

  private resolvePlayerShot(
    projectile: Projectile,
    enemies: readonly Enemy[],
    boss: Boss | null,
    weapons: WeaponSystem,
  ): void {
    // The swept segment spans the whole step, so its Z extent is the band worth testing.
    // Rejecting on it first removes almost every pair for the cost of two comparisons.
    const nearZ = Math.min(projectile.previousPosition.z, projectile.position.z);
    const farZ = Math.max(projectile.previousPosition.z, projectile.position.z);

    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i] as Enemy;
      if (!enemy.alive) {
        continue;
      }
      if (enemy.position.z + enemy.radius < nearZ || enemy.position.z - enemy.radius > farZ) {
        continue;
      }
      if (
        !segmentIntersectsSphere(
          projectile.previousPosition,
          projectile.position,
          enemy.position,
          enemy.radius,
        )
      ) {
        continue;
      }

      enemy.applyDamage(projectile.damage);
      scratchImpact.copy(projectile.position);
      weapons.release(projectile);

      if (enemy.alive) {
        this.effects.spawnImpact(scratchImpact, 0xffe0a0, enemy.velocity);
        this.audio.impact();
      } else {
        this.effects.spawnExplosion(enemy.position, 0xff9a3c, enemy.velocity);
        this.audio.explosion();
        this.events.onEnemyKilled(enemy);
      }
      return;
    }

    if (!boss || !boss.alive) {
      return;
    }

    // Turrets protrude toward the player, so anything reaching the hull has passed them.
    for (const turret of boss.turrets) {
      if (!turret.alive) {
        continue;
      }
      if (
        !segmentIntersectsSphere(
          projectile.previousPosition,
          projectile.position,
          turret.position,
          turret.radius,
        )
      ) {
        continue;
      }

      turret.applyDamage(projectile.damage);
      scratchImpact.copy(projectile.position);
      weapons.release(projectile);

      if (turret.alive) {
        this.effects.spawnImpact(scratchImpact, 0xffd0a0);
        this.audio.impact();
      } else {
        this.effects.spawnExplosion(turret.position, 0xffb03c);
        this.audio.explosion();
        this.events.onTurretDestroyed(turret);
      }
      return;
    }

    for (const collider of boss.colliders) {
      if (
        !segmentIntersectsSphere(
          projectile.previousPosition,
          projectile.position,
          collider.position,
          collider.radius,
        )
      ) {
        continue;
      }

      boss.applyDamage(projectile.damage);
      scratchImpact.copy(projectile.position);
      weapons.release(projectile);
      this.effects.spawnImpact(scratchImpact, 0xffc27a);
      this.audio.impact();

      if (!boss.alive) {
        this.effects.spawnBigExplosion(boss.position);
        this.audio.bigExplosion();
        this.events.onBossKilled(boss);
      }
      return;
    }
  }

  private resolveEnemyShot(
    projectile: Projectile,
    player: Player,
    weapons: WeaponSystem,
  ): void {
    if (
      !segmentIntersectsSphere(
        projectile.previousPosition,
        projectile.position,
        player.position,
        player.radius,
      )
    ) {
      return;
    }

    scratchImpact.copy(projectile.position);
    const result = player.takeHit(projectile.damage);
    // Absorb the shot regardless of outcome. Letting it continue through an invulnerable
    // player would land again the moment the grace period ended.
    weapons.release(projectile);
    this.reportPlayerHit(result, scratchImpact);

    if (!player.alive) {
      this.events.onPlayerDied();
    }
  }

  private reportPlayerHit(result: HitResult, at: Vector3): void {
    switch (result) {
      case 'ignored':
        this.effects.spawnImpact(at, 0x9fd8ff);
        break;
      case 'shielded':
        this.effects.spawnImpact(at, 0x5ff0ff);
        this.effects.addShake(0.2);
        this.audio.shieldAbsorb();
        break;
      case 'damaged':
        this.effects.spawnImpact(at, 0xff6a5a);
        this.effects.addShake(tuning.effects.shake.playerHit);
        this.effects.addVignette(0.85);
        this.audio.playerHit();
        break;
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled hit result: ${String(exhaustive)}`);
      }
    }
  }

  private resolveRamming(player: Player, enemies: readonly Enemy[], boss: Boss | null): void {
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i] as Enemy;
      if (!enemy.alive) {
        continue;
      }

      const reach = enemy.radius + player.radius;
      if (enemy.position.distanceToSquared(player.position) > reach * reach) {
        continue;
      }

      const result = player.takeHit(tuning.player.ramDamageTaken);
      if (result === 'ignored') {
        continue;
      }

      scratchImpact.copy(enemy.position);
      this.reportPlayerHit(result, scratchImpact);

      enemy.applyDamage(tuning.player.ramDamage);
      if (!enemy.alive) {
        this.effects.spawnExplosion(enemy.position, 0xff8a3c, enemy.velocity);
        this.audio.explosion();
        this.events.onEnemyKilled(enemy);
      }

      if (!player.alive) {
        this.events.onPlayerDied();
        return;
      }
    }

    if (!boss || !boss.alive) {
      return;
    }

    for (const collider of boss.colliders) {
      const reach = collider.radius + player.radius;
      if (collider.position.distanceToSquared(player.position) > reach * reach) {
        continue;
      }

      // Flying into a capital ship should be punishing, not a trade.
      const result = player.takeHit(tuning.player.ramDamageTaken * 1.6);
      if (result === 'ignored') {
        return;
      }

      scratchImpact.copy(player.position);
      this.reportPlayerHit(result, scratchImpact);
      boss.applyDamage(tuning.player.ramDamage);

      if (!boss.alive) {
        this.effects.spawnBigExplosion(boss.position);
        this.audio.bigExplosion();
        this.events.onBossKilled(boss);
      }
      if (!player.alive) {
        this.events.onPlayerDied();
      }
      return;
    }
  }
}
