import { Vector3, type Scene } from 'three';
import { tuning } from '../config/tuning';
import { pickWeighted } from '../core/mathUtils';
import { Pool } from '../core/Pool';
import { PowerUp } from '../entities/PowerUp';
import type { Player } from '../entities/Player';
import { POWER_UP_COLORS } from '../models/powerUpModel';
import type { PowerUpKind } from '../types';
import type { AudioSystem } from './AudioSystem';
import type { EffectsSystem } from './EffectsSystem';

const scratchPosition = new Vector3();

/**
 * Called when the player collects a power. `applied` is false when the power had no effect,
 * which currently only happens for a cannon upgrade at maximum tier; the caller converts
 * that into a score bonus so the drop is never wasted.
 */
export type PowerUpCollected = (kind: PowerUpKind, applied: boolean) => void;

export class PowerUpSystem {
  private readonly pool: Pool<PowerUp>;

  constructor(
    scene: Scene,
    private readonly effects: EffectsSystem,
    private readonly audio: AudioSystem,
    private readonly onCollected: PowerUpCollected,
  ) {
    this.pool = new Pool(tuning.effects.powerUpPool, () => new PowerUp(scene));
  }

  /** Rolls a drop at a kill location. Tougher enemies pass a higher chance. */
  rollDrop(position: Vector3, chance: number, verticalDrift: number): void {
    if (Math.random() > chance) {
      return;
    }

    const powerUp = this.pool.acquire();
    if (!powerUp) {
      return;
    }

    const kind = pickWeighted(tuning.powerUps.weights);
    scratchPosition.copy(position);
    powerUp.spawn(kind, scratchPosition, verticalDrift);
  }

  update(dt: number, player: Player): void {
    const items = this.pool.items;

    for (let i = 0; i < items.length; i += 1) {
      const powerUp = items[i] as PowerUp;
      if (!powerUp.active) {
        continue;
      }

      powerUp.update(dt, player.position);

      if (powerUp.isTouching(player.position, player.radius)) {
        this.collect(powerUp, player);
        continue;
      }

      if (powerUp.isExpired) {
        powerUp.despawn();
        this.pool.release(powerUp);
      }
    }
  }

  private collect(powerUp: PowerUp, player: Player): void {
    const applied = this.apply(powerUp.kind, player);

    this.effects.spawnPickupBurst(powerUp.position, POWER_UP_COLORS[powerUp.kind]);
    this.audio.pickup();
    this.onCollected(powerUp.kind, applied);

    powerUp.despawn();
    this.pool.release(powerUp);
  }

  /**
   * Applies a power's effect. Timed powers refresh their duration rather than stacking, so
   * the remaining time shown on the HUD always means the same thing.
   */
  private apply(kind: PowerUpKind, player: Player): boolean {
    const effects = tuning.powerUps.effects;

    switch (kind) {
      case 'repair':
        player.heal(effects.repairAmount);
        return true;
      case 'shield':
        player.addShield(effects.shieldCharges);
        return true;
      case 'missiles':
        player.addMissiles(effects.missileAmmo);
        return true;
      case 'rapidFire':
        player.grantRapidFire(effects.rapidFireDuration);
        return true;
      case 'weapon':
        return player.upgradeWeapon();
      default: {
        const exhaustive: never = kind;
        throw new Error(`Unhandled power-up kind: ${String(exhaustive)}`);
      }
    }
  }

  reset(): void {
    for (const powerUp of this.pool.items) {
      powerUp.despawn();
    }
    this.pool.releaseAll();
  }
}
