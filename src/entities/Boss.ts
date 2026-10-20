import { MeshStandardMaterial, Vector3, type Group, type Mesh, type Scene } from 'three';
import { tuning } from '../config/tuning';
import { clamp, randRange } from '../core/mathUtils';
import { createBossModel, createTurretModel } from '../models/bossModel';
import type { BossPhase, Damageable, EnemyFireApi } from '../types';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { AudioSystem } from '../systems/AudioSystem';
import type { Player } from './Player';

const scratchAim = new Vector3();
const scratchMuzzle = new Vector3();

/** A destructible hardpoint. Killing one permanently removes part of the boss's output. */
export class Turret implements Damageable {
  readonly position = new Vector3();
  readonly radius: number = tuning.boss.turret.radius;
  health: number = tuning.boss.turret.health;
  alive = true;
  fireCooldown = 0;

  constructor(
    readonly object: Group,
    readonly localOffset: Vector3,
  ) {}

  applyDamage(amount: number): void {
    if (!this.alive) {
      return;
    }
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.object.visible = false;
    }
  }

  reset(): void {
    this.health = tuning.boss.turret.health;
    this.alive = true;
    this.fireCooldown = randRange(0.4, tuning.boss.turret.fireInterval);
    this.object.visible = true;
  }
}

/** A hull collision sphere. The gunship is far too wide for one sphere to approximate. */
export interface BossCollider {
  readonly position: Vector3;
  readonly radius: number;
  readonly localOffset: Vector3;
}

export class Boss implements Damageable {
  readonly object: Group;
  readonly position = new Vector3();
  readonly radius: number = tuning.boss.radius;
  readonly maxHealth: number = tuning.boss.health;

  health = 0;
  alive = false;
  active = false;
  phase: BossPhase = 'spread';

  readonly turrets: Turret[] = [];
  readonly colliders: BossCollider[] = [];

  private readonly core: Mesh;
  private readonly coreMaterial: MeshStandardMaterial;
  private age = 0;
  private patternTimer = 0;
  private salvoRemaining = 0;
  private salvoTimer = 0;
  private sweepPhase = 0;
  private hitFlash = 0;

  constructor(
    scene: Scene,
    private readonly effects: EffectsSystem,
    private readonly audio: AudioSystem,
  ) {
    const model = createBossModel();
    this.object = model.group;
    this.core = model.core;

    // There is only one boss, but cloning keeps the shared material table immutable so a
    // future second gunship cannot inherit this one's damage glow.
    this.coreMaterial = (this.core.material as MeshStandardMaterial).clone();
    this.core.material = this.coreMaterial;

    for (const anchor of model.turretAnchors) {
      const turretObject = createTurretModel();
      turretObject.position.copy(anchor);
      this.object.add(turretObject);
      this.turrets.push(new Turret(turretObject, anchor.clone()));
    }

    for (const [x, y, z, radius] of [
      [0, 0, 1, 9],
      [-9.5, -0.4, 0.5, 5.2],
      [9.5, -0.4, 0.5, 5.2],
      [-16, -0.2, -0.5, 4.2],
      [16, -0.2, -0.5, 4.2],
    ] as const) {
      this.colliders.push({
        position: new Vector3(),
        radius,
        localOffset: new Vector3(x, y, z),
      });
    }

    this.object.visible = false;
    scene.add(this.object);
  }

  get healthFraction(): number {
    return this.health / this.maxHealth;
  }

  get livingTurrets(): number {
    let count = 0;
    for (const turret of this.turrets) {
      if (turret.alive) {
        count += 1;
      }
    }
    return count;
  }

  spawn(): void {
    this.active = true;
    this.alive = true;
    this.health = this.maxHealth;
    this.phase = 'spread';
    this.age = 0;
    this.patternTimer = 2;
    this.salvoRemaining = 0;
    this.salvoTimer = 0;
    this.sweepPhase = 0;
    this.hitFlash = 0;
    this.position.set(0, tuning.boss.altitude, tuning.boss.spawnZ);
    this.object.position.copy(this.position);
    this.object.visible = true;

    for (const turret of this.turrets) {
      turret.reset();
    }
    this.syncAttachments();
    this.audio.alarm();
  }

  update(dt: number, player: Player, weapons: EnemyFireApi): void {
    this.age += dt;

    // Close to the hold point, then match the player's speed and sweep laterally. Holding
    // position is what turns the fight into a duel rather than a single pass.
    if (this.position.z < tuning.boss.holdZ) {
      this.position.z = Math.min(
        tuning.boss.holdZ,
        this.position.z + tuning.boss.approachSpeed * dt,
      );
    }

    this.position.x = Math.sin(this.age * tuning.boss.driftSpeed) * tuning.boss.driftAmplitude;
    this.position.y = tuning.boss.altitude + Math.sin(this.age * 0.7) * 1.6;
    this.object.position.copy(this.position);
    this.object.rotation.z = Math.sin(this.age * tuning.boss.driftSpeed) * -0.06;

    this.syncAttachments();
    this.updatePhase();
    this.updateHitFlash(dt);

    // No shooting during the approach, so the player gets a moment to read the threat.
    if (this.position.z >= tuning.boss.holdZ - 40) {
      this.updateAttack(dt, player, weapons);
      this.updateTurrets(dt, player, weapons);
    }
  }

  /** Rewrites world positions of turrets and hull spheres after the hull moves. */
  private syncAttachments(): void {
    for (const turret of this.turrets) {
      turret.position.set(
        this.position.x + turret.localOffset.x,
        this.position.y + turret.localOffset.y,
        this.position.z + turret.localOffset.z,
      );
    }
    for (const collider of this.colliders) {
      collider.position.set(
        this.position.x + collider.localOffset.x,
        this.position.y + collider.localOffset.y,
        this.position.z + collider.localOffset.z,
      );
    }
  }

  private updatePhase(): void {
    const fraction = this.healthFraction;
    const thresholds = tuning.boss.phaseThresholds;
    const next: BossPhase =
      fraction > thresholds.missiles
        ? 'spread'
        : fraction > thresholds.strafe
          ? 'missiles'
          : 'strafe';

    if (next === this.phase) {
      return;
    }

    this.phase = next;
    // Announce the change so the player knows to expect a different pattern before it
    // arrives, rather than being surprised by it.
    this.patternTimer = 0.9;
    this.salvoRemaining = 0;
    this.effects.addShake(0.5);
    this.audio.alarm();
  }

  private updateAttack(dt: number, player: Player, weapons: EnemyFireApi): void {
    this.patternTimer -= dt;

    switch (this.phase) {
      case 'spread': {
        if (this.patternTimer <= 0) {
          this.fireSpread(player, weapons);
          this.patternTimer = tuning.boss.spread.interval;
        }
        break;
      }
      case 'missiles': {
        if (this.salvoRemaining > 0) {
          this.salvoTimer -= dt;
          if (this.salvoTimer <= 0) {
            this.fireMissile(player, weapons);
            this.salvoRemaining -= 1;
            this.salvoTimer = tuning.boss.missiles.salvoGap;
          }
        } else if (this.patternTimer <= 0) {
          this.salvoRemaining = tuning.boss.missiles.salvo;
          this.salvoTimer = 0;
          this.patternTimer = tuning.boss.missiles.interval;
        }
        break;
      }
      case 'strafe': {
        this.sweepPhase += dt * tuning.boss.strafe.sweepSpeed;
        if (this.patternTimer <= 0) {
          this.fireStrafe(player, weapons);
          this.patternTimer = tuning.boss.strafe.interval;
        }
        break;
      }
      default: {
        const exhaustive: never = this.phase;
        throw new Error(`Unhandled boss phase: ${String(exhaustive)}`);
      }
    }
  }

  /** A fan of shots across the corridor: dodgeable, but only if the player commits early. */
  private fireSpread(player: Player, weapons: EnemyFireApi): void {
    const config = tuning.boss.spread;
    // Widened from the literal type so the single-bullet guard below stays meaningful if
    // the count is ever retuned.
    const bullets: number = config.bullets;
    scratchMuzzle.set(this.position.x, this.position.y, this.position.z + 7);

    for (let i = 0; i < bullets; i += 1) {
      const t = bullets === 1 ? 0 : i / (bullets - 1) - 0.5;
      const angle = t * config.arc;
      const reach = Math.abs(this.position.z - player.position.z);

      scratchAim.set(
        player.position.x + Math.tan(angle) * reach,
        player.position.y + Math.sin(angle) * 12,
        player.position.z,
      );

      weapons.spawnEnemyShot(
        scratchMuzzle,
        scratchAim,
        config.bulletSpeed,
        config.bulletDamage,
        6,
      );
    }
  }

  private fireMissile(player: Player, weapons: EnemyFireApi): void {
    const config = tuning.boss.missiles;
    scratchMuzzle.set(
      this.position.x + randRange(-8, 8),
      this.position.y - 2,
      this.position.z + 6,
    );
    scratchAim.copy(player.position);

    weapons.spawnEnemyShot(
      scratchMuzzle,
      scratchAim,
      config.bulletSpeed,
      config.bulletDamage,
      7,
      player,
    );
  }

  /** A wall of fire sweeping side to side, forcing constant lateral movement. */
  private fireStrafe(player: Player, weapons: EnemyFireApi): void {
    const config = tuning.boss.strafe;
    const sweepX = Math.sin(this.sweepPhase) * config.sweepWidth;

    scratchMuzzle.set(this.position.x + sweepX * 0.4, this.position.y - 1, this.position.z + 7);
    scratchAim.set(
      clamp(player.position.x + sweepX, -tuning.player.boundsX - 6, tuning.player.boundsX + 6),
      player.position.y + randRange(-3, 3),
      player.position.z,
    );

    weapons.spawnEnemyShot(
      scratchMuzzle,
      scratchAim,
      config.bulletSpeed,
      config.bulletDamage,
      6,
    );
  }

  private updateTurrets(dt: number, player: Player, weapons: EnemyFireApi): void {
    const config = tuning.boss.turret;

    for (const turret of this.turrets) {
      if (!turret.alive) {
        continue;
      }

      turret.fireCooldown -= dt;
      if (turret.fireCooldown > 0) {
        continue;
      }
      turret.fireCooldown = config.fireInterval * randRange(0.8, 1.3);

      const travelTime = turret.position.distanceTo(player.position) / config.bulletSpeed;
      scratchAim.set(
        player.position.x +
          player.velocity.x * travelTime +
          randRange(-config.aimJitter, config.aimJitter),
        player.position.y +
          player.velocity.y * travelTime +
          randRange(-config.aimJitter, config.aimJitter),
        player.position.z,
      );
      scratchMuzzle.set(turret.position.x, turret.position.y + 0.9, turret.position.z + 2);

      weapons.spawnEnemyShot(
        scratchMuzzle,
        scratchAim,
        config.bulletSpeed,
        config.bulletDamage,
        6,
      );
    }
  }

  private updateHitFlash(dt: number): void {
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    }
    // The core burns brighter as the hull fails, giving a readable damage cue at a glance
    // that does not depend on watching the health bar.
    const damage = 1 - this.healthFraction;
    this.coreMaterial.emissiveIntensity = 1.2 + damage * 2.6 + this.hitFlash * 2;
  }

  applyDamage(amount: number): void {
    if (!this.alive) {
      return;
    }
    this.health -= amount;
    this.hitFlash = 1;
    this.effects.addShake(tuning.effects.shake.bossHit);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  despawn(): void {
    this.active = false;
    this.alive = false;
    this.object.visible = false;
  }

  reset(): void {
    this.despawn();
    this.health = 0;
    this.phase = 'spread';
    for (const turret of this.turrets) {
      turret.reset();
    }
  }
}
