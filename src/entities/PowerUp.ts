import { Vector3, type Group, type Scene } from 'three';
import { tuning } from '../config/tuning';
import type { Poolable } from '../core/Pool';
import { createPowerUpModel, type PowerUpModel } from '../models/powerUpModel';
import type { PowerUpKind } from '../types';

export class PowerUp implements Poolable {
  active = false;
  kind: PowerUpKind = 'weapon';
  readonly position = new Vector3();
  readonly radius: number = tuning.powerUps.radius;

  private readonly model: PowerUpModel;
  private readonly object: Group;
  private life = 0;
  private bobPhase = 0;
  /** Vertical drift inherited from the enemy that dropped it, damped away over time. */
  private drift = 0;

  constructor(scene: Scene) {
    this.model = createPowerUpModel();
    this.object = this.model.group;
    this.object.visible = false;
    scene.add(this.object);
  }

  spawn(kind: PowerUpKind, position: Vector3, drift: number): void {
    this.kind = kind;
    this.model.setKind(kind);
    this.position.copy(position);
    this.life = tuning.powerUps.life;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.drift = drift;
    this.object.visible = true;
    this.object.position.copy(this.position);
    this.object.scale.setScalar(1);
  }

  /**
   * Drifts back with the world, then homes on the player once close enough.
   *
   * The magnet exists because a pickup that must be flown into precisely punishes the
   * player for having just won a fight; getting near it should be enough.
   */
  update(dt: number, playerPosition: Vector3): void {
    const config = tuning.powerUps;

    this.life -= dt;
    this.position.z += tuning.world.scrollSpeed * dt;

    this.drift *= Math.exp(-2.4 * dt);
    this.position.y += this.drift * dt;

    const toPlayerX = playerPosition.x - this.position.x;
    const toPlayerY = playerPosition.y - this.position.y;
    const toPlayerZ = playerPosition.z - this.position.z;
    const distanceSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY + toPlayerZ * toPlayerZ;

    if (distanceSq < config.magnetRange * config.magnetRange && distanceSq > 1e-4) {
      const distance = Math.sqrt(distanceSq);
      const step = (config.magnetSpeed * dt) / distance;
      this.position.x += toPlayerX * step;
      this.position.y += toPlayerY * step;
      this.position.z += toPlayerZ * step;
    }

    this.bobPhase += dt * config.bobSpeed;
    this.object.position.set(
      this.position.x,
      this.position.y + Math.sin(this.bobPhase) * config.bobAmplitude,
      this.position.z,
    );
    this.object.rotation.y += config.spinSpeed * dt;
    this.object.rotation.x += config.spinSpeed * 0.4 * dt;

    // Shrink as it expires, so a pickup about to vanish looks like one.
    const fading = Math.min(1, this.life / 1.5);
    this.object.scale.setScalar(0.55 + fading * 0.45);
  }

  get isExpired(): boolean {
    return this.life <= 0 || this.position.z > tuning.world.cullPlane;
  }

  isTouching(playerPosition: Vector3, playerRadius: number): boolean {
    const reach = tuning.powerUps.pickupRadius + playerRadius;
    return this.position.distanceToSquared(playerPosition) <= reach * reach;
  }

  despawn(): void {
    this.object.visible = false;
  }
}
