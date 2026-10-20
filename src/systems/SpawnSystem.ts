import type { Scene } from 'three';
import { levelOneWaves } from '../config/levelOne';
import { tuning } from '../config/tuning';
import { clamp, randRange } from '../core/mathUtils';
import { Pool } from '../core/Pool';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { EnemyFireApi, EnemyKind, WaveSpec } from '../types';

/**
 * Triggers scripted waves as the run advances, and owns the lifetime of every enemy.
 *
 * Waves are read through a single cursor into a table sorted by distance, so triggering is
 * a constant-time comparison per step no matter how long the table gets.
 */
export class SpawnSystem {
  private readonly pools: Record<EnemyKind, Pool<Enemy>>;
  private readonly active: Enemy[] = [];
  private cursor = 0;

  constructor(scene: Scene) {
    this.pools = {
      plane: new Pool(tuning.enemies.plane.poolSize, () => new Enemy('plane', scene)),
      helicopter: new Pool(
        tuning.enemies.helicopter.poolSize,
        () => new Enemy('helicopter', scene),
      ),
    };
  }

  /** Live enemies, rebuilt in place each step so reading it never allocates. */
  get enemies(): readonly Enemy[] {
    return this.active;
  }

  get wavesRemaining(): number {
    return levelOneWaves.length - this.cursor;
  }

  update(dt: number, distanceTravelled: number, player: Player, weapons: EnemyFireApi): void {
    this.triggerWaves(distanceTravelled);

    this.active.length = 0;

    for (const kind of ['plane', 'helicopter'] as const) {
      const pool = this.pools[kind];
      for (let i = 0; i < pool.items.length; i += 1) {
        const enemy = pool.items[i] as Enemy;
        if (!enemy.active) {
          continue;
        }

        if (!enemy.alive || enemy.isPastCamera) {
          this.recycle(enemy);
          continue;
        }

        enemy.update(dt, player, weapons);
        this.active.push(enemy);
      }
    }
  }

  private triggerWaves(distanceTravelled: number): void {
    while (this.cursor < levelOneWaves.length) {
      const next = levelOneWaves[this.cursor] as WaveSpec;
      if (next.atDistance > distanceTravelled) {
        break;
      }
      this.spawnWave(next);
      this.cursor += 1;
    }
  }

  private spawnWave(spec: WaveSpec): void {
    // Keep the whole formation inside the corridor the player can actually reach, so no
    // member spawns somewhere it can never be engaged.
    const halfWidth = ((spec.count - 1) * spec.spread) / 2;
    const limit = Math.max(0, tuning.player.boundsX - halfWidth * 0.35);
    const centreX = clamp(randRange(-limit, limit), -limit, limit);

    for (let index = 0; index < spec.count; index += 1) {
      const enemy = this.pools[spec.kind].acquire();
      if (!enemy) {
        return;
      }

      const slot = index - (spec.count - 1) / 2;
      let x = centreX;
      let y = spec.altitude;
      let z = tuning.enemies.spawnZ + randRange(-12, 12);

      switch (spec.formation) {
        case 'single':
          break;
        case 'line':
          x += slot * spec.spread;
          break;
        case 'vee':
          // Outer members trail the leader, forming a V that points at the player.
          x += slot * spec.spread;
          z -= Math.abs(slot) * spec.spread * 1.5;
          break;
        case 'stagger':
          x += slot * spec.spread;
          y += index % 2 === 0 ? -4 : 4;
          z -= index * spec.spread * 0.9;
          break;
        case 'column':
          z -= index * 38;
          break;
        default: {
          const exhaustive: never = spec.formation;
          throw new Error(`Unhandled formation: ${String(exhaustive)}`);
        }
      }

      enemy.spawn(x, clamp(y, tuning.player.minY, tuning.player.maxY + 4), z, spec.speed);
    }
  }

  /** Returns an enemy to its pool. Called on death and when it passes the camera. */
  recycle(enemy: Enemy): void {
    enemy.despawn();
    this.pools[enemy.kind].release(enemy);
  }

  reset(): void {
    this.cursor = 0;
    this.active.length = 0;
    for (const kind of ['plane', 'helicopter'] as const) {
      const pool = this.pools[kind];
      for (const enemy of pool.items) {
        enemy.despawn();
      }
      pool.releaseAll();
    }
  }
}
