import {
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Group,
  type Scene,
} from 'three';
import { tuning } from '../config/tuning';
import type { Input } from '../core/Input';
import { clamp, damp } from '../core/mathUtils';
import { createPlayerModel } from '../models/playerModel';
import type { Damageable, WeaponTier } from '../types';
import type { WeaponSystem } from '../systems/WeaponSystem';

export type HitResult = 'ignored' | 'shielded' | 'damaged';

const shieldGeometry = new SphereGeometry(3.6, 16, 12);

export class Player implements Damageable {
  readonly object: Group;
  readonly position = new Vector3();
  /** Velocity within the flight envelope. The player never moves along Z. */
  readonly velocity = new Vector2();
  readonly radius: number = tuning.player.radius;

  health: number = tuning.player.maxHealth;
  shield = 0;
  weaponTier: WeaponTier = 1;
  missiles = 0;
  rapidFireRemaining = 0;
  alive = true;

  private fireCooldown = 0;
  private missileCooldown = 0;
  private invulnerableFor = 0;
  private bank = 0;
  private pitch = 0;
  private shieldPulse = 0;

  private readonly shieldBubble: Mesh;
  private readonly shieldMaterial: MeshStandardMaterial;

  constructor(scene: Scene) {
    this.object = createPlayerModel();

    this.shieldMaterial = new MeshStandardMaterial({
      color: 0x9ff6ff,
      emissive: 0x2fd4ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.3,
    });
    this.shieldBubble = new Mesh(shieldGeometry, this.shieldMaterial);
    this.shieldBubble.visible = false;
    this.object.add(this.shieldBubble);

    scene.add(this.object);
    this.reset();
  }

  get isInvulnerable(): boolean {
    return this.invulnerableFor > 0;
  }

  /** Current fire interval, shortened while the rapid fire power is active. */
  get fireInterval(): number {
    const base = tuning.weapons.cannon.interval;
    return this.rapidFireRemaining > 0
      ? base * tuning.powerUps.effects.rapidFireScale
      : base;
  }

  update(dt: number, input: Input, weapons: WeaponSystem, targets: readonly Damageable[]): void {
    this.applyMovement(dt, input);
    this.applyAttitude(dt);
    this.updateTimers(dt);
    this.updateFiring(dt, input, weapons, targets);
    this.updateShieldVisual(dt);

    this.object.position.copy(this.position);
  }

  private applyMovement(dt: number, input: Input): void {
    const config = tuning.player;
    const axisX = input.axisX;
    const axisY = input.axisY;

    // Accelerate while a direction is held, and damp back to rest when it is released, so
    // the plane has weight without feeling sluggish to start.
    if (axisX !== 0) {
      this.velocity.x = clamp(
        this.velocity.x + axisX * config.acceleration * dt,
        -config.maxSpeedX,
        config.maxSpeedX,
      );
    } else {
      this.velocity.x = damp(this.velocity.x, 0, config.damping, dt);
    }

    if (axisY !== 0) {
      this.velocity.y = clamp(
        this.velocity.y + axisY * config.acceleration * dt,
        -config.maxSpeedY,
        config.maxSpeedY,
      );
    } else {
      this.velocity.y = damp(this.velocity.y, 0, config.damping, dt);
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Zeroing velocity at the envelope edge stops the plane from banking hard into a wall
    // it cannot cross, and removes the lag before it responds to reversed input.
    if (this.position.x < -config.boundsX) {
      this.position.x = -config.boundsX;
      this.velocity.x = 0;
    } else if (this.position.x > config.boundsX) {
      this.position.x = config.boundsX;
      this.velocity.x = 0;
    }

    if (this.position.y < config.minY) {
      this.position.y = config.minY;
      this.velocity.y = 0;
    } else if (this.position.y > config.maxY) {
      this.position.y = config.maxY;
      this.velocity.y = 0;
    }
  }

  private applyAttitude(dt: number): void {
    const config = tuning.player;
    const lateral = this.velocity.x / config.maxSpeedX;
    const vertical = this.velocity.y / config.maxSpeedY;

    this.bank = damp(this.bank, lateral, config.modelLerp, dt);
    this.pitch = damp(this.pitch, vertical, config.modelLerp, dt);

    this.object.rotation.z = -this.bank * config.bankAngle;
    this.object.rotation.y = -this.bank * config.yawAngle;
    this.object.rotation.x = this.pitch * config.pitchAngle;
  }

  private updateTimers(dt: number): void {
    if (this.rapidFireRemaining > 0) {
      this.rapidFireRemaining = Math.max(0, this.rapidFireRemaining - dt);
    }
    if (this.invulnerableFor > 0) {
      this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
    }
  }

  private updateFiring(
    dt: number,
    input: Input,
    weapons: WeaponSystem,
    targets: readonly Damageable[],
  ): void {
    this.fireCooldown -= dt;
    if (input.firing && this.fireCooldown <= 0) {
      weapons.firePlayerCannon(this.position, this.weaponTier);
      this.fireCooldown = this.fireInterval;
    }

    this.missileCooldown -= dt;
    if (input.launchingMissile && this.missileCooldown <= 0 && this.missiles > 0) {
      if (weapons.firePlayerMissile(this.position, targets)) {
        this.missiles -= 1;
        this.missileCooldown = tuning.weapons.missile.interval;
      }
    }
  }

  private updateShieldVisual(dt: number): void {
    const active = this.shield > 0;
    this.shieldBubble.visible = active;
    if (!active) {
      return;
    }

    this.shieldPulse += dt * 3.2;
    const pulse = 0.5 + Math.sin(this.shieldPulse) * 0.5;
    this.shieldMaterial.opacity = 0.13 + pulse * 0.16;
    // More charges read as a denser bubble, so the player can see how protected they are
    // without looking away from the fight.
    this.shieldBubble.scale.setScalar(0.9 + Math.min(this.shield, 5) * 0.035);
  }

  /**
   * Resolves an incoming hit. Shield charges are consumed before health, and a short grace
   * period after any hit stops a single burst from chaining into an instant kill.
   */
  takeHit(amount: number): HitResult {
    if (this.invulnerableFor > 0 || !this.alive) {
      return 'ignored';
    }

    this.invulnerableFor = tuning.player.invulnerableAfterHit;

    if (this.shield > 0) {
      this.shield -= 1;
      return 'shielded';
    }

    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return 'damaged';
  }

  applyDamage(amount: number): void {
    this.takeHit(amount);
  }

  heal(amount: number): void {
    this.health = Math.min(tuning.player.maxHealth, this.health + amount);
  }

  addShield(charges: number): void {
    this.shield = Math.min(tuning.player.maxShield, this.shield + charges);
  }

  addMissiles(count: number): void {
    this.missiles = Math.min(tuning.weapons.missile.maxAmmo, this.missiles + count);
  }

  /** Raises the cannon tier, returning false when already at maximum. */
  upgradeWeapon(): boolean {
    if (this.weaponTier >= 3) {
      return false;
    }
    this.weaponTier = (this.weaponTier + 1) as WeaponTier;
    return true;
  }

  grantRapidFire(duration: number): void {
    // Refresh rather than stack, so the HUD timer always means the same thing.
    this.rapidFireRemaining = Math.max(this.rapidFireRemaining, duration);
  }

  reset(): void {
    this.health = tuning.player.maxHealth;
    this.shield = 0;
    this.weaponTier = 1;
    this.missiles = 0;
    this.rapidFireRemaining = 0;
    this.alive = true;
    this.fireCooldown = 0;
    this.missileCooldown = 0;
    this.invulnerableFor = 0;
    this.bank = 0;
    this.pitch = 0;
    this.velocity.set(0, 0);
    this.position.set(0, tuning.player.startAltitude, 0);
    this.object.position.copy(this.position);
    this.object.rotation.set(0, 0, 0);
    this.shieldBubble.visible = false;
  }
}
