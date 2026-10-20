import { Group, Vector3, type Scene } from 'three';
import { tuning } from '../config/tuning';
import { clamp, damp, randRange, randSign } from '../core/mathUtils';
import type { Poolable } from '../core/Pool';
import { createEnemyPlaneModel } from '../models/enemyPlaneModel';
import { createHelicopterModel } from '../models/helicopterModel';
import type { Damageable, EnemyFireApi, EnemyKind } from '../types';
import type { Player } from './Player';

const scratchAim = new Vector3();
const scratchMuzzle = new Vector3();

/**
 * A hostile aircraft. One class covers both kinds because they differ only in tuning and
 * in two behavioural details (whether they close on the player, and whether they have
 * rotors to spin), which is not enough divergence to justify separate types.
 *
 * Kind is fixed at construction so the model is built once and the instance can be pooled.
 */
export class Enemy implements Damageable, Poolable {
  active = false;
  alive = false;
  health = 0;
  readonly radius: number;
  readonly object = new Group();
  readonly position = new Vector3();
  /** World-space velocity, used to make explosion debris inherit the enemy's motion. */
  readonly velocity = new Vector3();

  private readonly rotors: { main: Group; tail: Group } | null;
  private readonly config: (typeof tuning.enemies)['plane' | 'helicopter'];

  private laneX = 0;
  private laneY = 0;
  /** Offsets from the player that this enemy aims to pass by, laterally and vertically. */
  private laneOffset = 0;
  private laneOffsetY = 0;
  private age = 0;
  private phase = 0;
  private speedScale = 1;
  private fireCooldown = 0;
  private burstRemaining = 0;
  private burstTimer = 0;
  private bank = 0;
  private hitFlash = 0;

  constructor(
    readonly kind: EnemyKind,
    scene: Scene,
  ) {
    this.config = tuning.enemies[kind];
    this.radius = this.config.radius;

    if (kind === 'helicopter') {
      const model = createHelicopterModel();
      this.rotors = { main: model.mainRotor, tail: model.tailRotor };
      // Enemies fly toward the player, so they are turned to face the camera. Rotating an
      // inner node keeps the outer object free for bank and pitch.
      model.group.rotation.y = Math.PI;
      this.object.add(model.group);
    } else {
      const model = createEnemyPlaneModel();
      model.rotation.y = Math.PI;
      this.rotors = null;
      this.object.add(model);
    }

    this.object.visible = false;
    scene.add(this.object);
  }

  get scoreValue(): number {
    return this.config.score;
  }

  get dropChance(): number {
    return this.config.dropChance;
  }

  spawn(x: number, y: number, z: number, speedScale: number): void {
    this.alive = true;
    this.health = this.config.health;
    this.laneX = x;
    this.laneY = y;
    // Approach on whichever side the enemy spawned, so it converges on a lane beside the
    // player rather than crossing through them to reach the other side.
    const pass = this.config.lanePassOffset;
    const rise = this.config.laneAltitudeOffset;
    this.laneOffset = Math.sign(x || 1) * randRange(pass.min, pass.max);
    this.laneOffsetY = randSign() * randRange(rise.min, rise.max);
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.speedScale = speedScale;
    this.age = 0;
    // A per-instance phase keeps a formation from weaving in lockstep, which would read as
    // one object rather than several pilots.
    this.phase = Math.random() * Math.PI * 2;
    this.fireCooldown = randRange(0.35, this.config.fireInterval);
    this.burstRemaining = 0;
    this.burstTimer = 0;
    this.bank = 0;
    this.hitFlash = 0;
    this.object.visible = true;
    this.object.position.copy(this.position);
    this.object.scale.setScalar(1);
  }

  update(dt: number, player: Player, weapons: EnemyFireApi): void {
    this.age += dt;

    const previousX = this.position.x;
    const previousY = this.position.y;

    // Everything drifts backward at the world scroll rate; own airspeed is added on top,
    // so a hovering helicopter simply passes at scroll speed.
    const forwardSpeed = tuning.world.scrollSpeed + this.config.approachSpeed * this.speedScale;
    this.position.z += forwardSpeed * dt;

    // Clamp the target lane into the corridor. Without this, a player hugging one edge of
    // the envelope pushes half the wave's lanes out of reach and pulls the other half onto
    // their own position.
    const targetX = clamp(
      player.position.x + this.laneOffset,
      -tuning.player.boundsX - 4,
      tuning.player.boundsX + 4,
    );
    const targetY = clamp(
      player.position.y + this.laneOffsetY,
      tuning.player.minY,
      tuning.player.maxY,
    );

    this.laneX = damp(this.laneX, targetX, this.config.trackStrength, dt);
    this.laneY = damp(this.laneY, targetY, this.config.trackStrength * 0.6, dt);

    const weave = this.age * this.config.weaveSpeed + this.phase;
    this.position.x = this.laneX + Math.sin(weave) * this.config.weaveAmplitudeX;
    this.position.y = clamp(
      this.laneY + Math.cos(weave * 0.8) * this.config.weaveAmplitudeY,
      tuning.player.minY - 1,
      tuning.player.maxY + 6,
    );

    this.velocity.set(
      (this.position.x - previousX) / dt,
      (this.position.y - previousY) / dt,
      forwardSpeed,
    );

    this.object.position.copy(this.position);
    this.applyAttitude(dt, previousX);
    this.spinRotors(dt);
    this.updateHitFlash(dt);
    this.updateFiring(dt, player, weapons);
  }

  private applyAttitude(dt: number, previousX: number): void {
    const lateral = clamp((this.position.x - previousX) / (dt * 40), -1, 1);
    this.bank = damp(this.bank, lateral, 6, dt);
    this.object.rotation.z = -this.bank * this.config.bankAngle;
  }

  private spinRotors(dt: number): void {
    if (!this.rotors) {
      return;
    }
    const speed = tuning.enemies.helicopter.rotorSpeed;
    this.rotors.main.rotation.y += speed * dt;
    this.rotors.tail.rotation.x += speed * 1.6 * dt;
  }

  private updateHitFlash(dt: number): void {
    if (this.hitFlash <= 0) {
      return;
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
    // Shared materials mean emissive flashing would light up every enemy at once, so hits
    // are confirmed with a scale pop instead.
    this.object.scale.setScalar(1 + this.hitFlash * 0.16);
  }

  private updateFiring(dt: number, player: Player, weapons: EnemyFireApi): void {
    // Hold fire once past the player: shooting from behind is unreadable and unfair.
    const ahead = this.position.z < player.position.z - 14;
    const inRange = this.position.z > player.position.z - this.config.fireRange;

    if (this.burstRemaining > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.shoot(player, weapons);
        this.burstRemaining -= 1;
        this.burstTimer = this.config.burstGap;
      }
      return;
    }

    this.fireCooldown -= dt;
    if (this.fireCooldown > 0 || !ahead || !inRange) {
      return;
    }

    this.burstRemaining = this.config.burstCount;
    this.burstTimer = 0;
    this.fireCooldown = this.config.fireInterval * randRange(0.85, 1.25);
  }

  /**
   * Fires one shot at where the player will be, not where they are.
   *
   * Aim is deliberately jittered: a perfect lead on a player who is holding a direction
   * would be unavoidable, whereas a near-miss teaches the player to keep moving.
   */
  private shoot(player: Player, weapons: EnemyFireApi): void {
    const distance = this.position.distanceTo(player.position);
    const travelTime = distance / this.config.bulletSpeed;
    const jitter = this.config.aimJitter;

    scratchAim.set(
      player.position.x + player.velocity.x * travelTime + randRange(-jitter, jitter),
      player.position.y + player.velocity.y * travelTime + randRange(-jitter, jitter),
      player.position.z,
    );

    scratchMuzzle.set(this.position.x, this.position.y, this.position.z + this.radius);

    weapons.spawnEnemyShot(
      scratchMuzzle,
      scratchAim,
      this.config.bulletSpeed,
      this.config.bulletDamage,
      this.config.bulletLife,
    );
  }

  applyDamage(amount: number): void {
    if (!this.alive) {
      return;
    }
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  /** True once the enemy has travelled past the camera and can no longer be fought. */
  get isPastCamera(): boolean {
    return this.position.z > tuning.world.cullPlane;
  }

  despawn(): void {
    this.alive = false;
    this.object.visible = false;
  }
}
