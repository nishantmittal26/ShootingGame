import { Vector3, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { trackLength } from '../config/levelOne';
import { tuning } from '../config/tuning';
import { Boss, type Turret } from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { POWER_UP_COLORS, POWER_UP_LABELS } from '../models/powerUpModel';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem, type CombatEvents } from '../systems/CollisionSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import type { Damageable, PowerUpKind, RunState } from '../types';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { Clouds } from '../world/Clouds';
import { FinishGate } from '../world/FinishGate';
import { Sky } from '../world/Sky';
import { Terrain } from '../world/Terrain';
import { advancesSimulation, reduceState, showsHud, type GameStateKind } from './GameState';
import { Input } from './Input';
import { damp, randRange } from './mathUtils';

const PAUSE_KEYS = ['KeyP', 'Escape'] as const;

export interface GameOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
}

export class Game implements CombatEvents {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;

  private readonly input: Input;
  private readonly audio = new AudioSystem();
  private readonly effects: EffectsSystem;
  private readonly weapons: WeaponSystem;
  private readonly spawns: SpawnSystem;
  private readonly powerUps: PowerUpSystem;
  private readonly collisions: CollisionSystem;
  private readonly player: Player;
  private readonly boss: Boss;

  private readonly sky: Sky;
  private readonly terrain: Terrain;
  private readonly clouds: Clouds;
  private readonly gate: FinishGate;
  private readonly hud = new Hud();
  private readonly screens = new Screens();

  private state: GameStateKind = 'menu';
  private accumulator = 0;
  private lastFrameTime = 0;

  private readonly run: RunState = {
    distanceTravelled: 0,
    trackLength,
    score: 0,
    kills: 0,
    nextWaveIndex: 0,
    bossSpawned: false,
    bossDefeated: false,
    finishCrossed: false,
    elapsed: 0,
  };

  /** Rebuilt each step rather than allocated, and used for missile target selection. */
  private readonly targets: Damageable[] = [];
  private readonly cameraBase = new Vector3();
  private readonly cameraLook = new Vector3();

  constructor(options: GameOptions) {
    this.renderer = options.renderer;
    this.scene = options.scene;
    this.camera = options.camera;

    this.input = new Input(options.canvas);
    this.effects = new EffectsSystem(this.scene);
    this.weapons = new WeaponSystem(this.scene, this.effects, this.audio);
    this.spawns = new SpawnSystem(this.scene);
    this.powerUps = new PowerUpSystem(
      this.scene,
      this.effects,
      this.audio,
      (kind, applied) => this.onPowerUpCollected(kind, applied),
    );
    this.collisions = new CollisionSystem(this.effects, this.audio, this);
    this.player = new Player(this.scene);
    this.boss = new Boss(this.scene, this.effects, this.audio);

    this.sky = new Sky(this.scene);
    this.terrain = new Terrain(this.scene);
    this.clouds = new Clouds(this.scene);
    this.gate = new FinishGate(this.scene);

    this.resetRun();
    this.screens.show(this.state);
    this.hud.setVisible(showsHud(this.state));
  }

  start(): void {
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private frame(timeMs: number): void {
    const now = timeMs / 1000;
    const rawDelta = this.lastFrameTime === 0 ? 0 : now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Clamping here is what keeps a backgrounded tab from trying to catch up thousands of
    // simulation steps in one frame when it regains focus.
    const frameTime = Math.min(rawDelta, tuning.sim.maxFrameTime);

    this.handleGlobalInput();

    if (advancesSimulation(this.state)) {
      this.accumulator += frameTime;
      while (this.accumulator >= tuning.sim.step) {
        this.step(tuning.sim.step);
        this.accumulator -= tuning.sim.step;
        // A step can end the run; stop draining so the remainder is not simulated past it.
        if (!advancesSimulation(this.state)) {
          this.accumulator = 0;
          break;
        }
      }
    } else {
      this.accumulator = 0;
    }

    this.updatePresentation(frameTime);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  /** One fixed simulation step. Everything gameplay-affecting happens here. */
  private step(dt: number): void {
    this.collectTargets();

    this.player.update(dt, this.input, this.weapons, this.targets);
    this.spawns.update(dt, this.run.distanceTravelled, this.player, this.weapons);

    this.maybeSpawnBoss();
    if (this.boss.active && this.boss.alive) {
      this.boss.update(dt, this.player, this.weapons);
    }

    this.weapons.update(dt);
    this.collisions.resolve(this.player, this.spawns.enemies, this.bossOrNull, this.weapons);
    this.powerUps.update(dt, this.player);

    this.advanceWorld(dt);
    this.effects.update(dt);

    this.run.elapsed += dt;
    this.run.nextWaveIndex = this.spawns.wavesRemaining;

    this.checkOutcomes();
  }

  private get bossOrNull(): Boss | null {
    return this.boss.active ? this.boss : null;
  }

  private collectTargets(): void {
    this.targets.length = 0;
    const enemies = this.spawns.enemies;
    for (let i = 0; i < enemies.length; i += 1) {
      this.targets.push(enemies[i] as Enemy);
    }
    if (this.boss.active && this.boss.alive) {
      this.targets.push(this.boss);
    }
  }

  private maybeSpawnBoss(): void {
    if (this.run.bossSpawned || this.run.distanceTravelled < this.run.trackLength) {
      return;
    }
    this.run.bossSpawned = true;
    this.boss.spawn();
    // The barrier appears shut the moment the boss does, so the player can see what the
    // fight is for before it starts.
    this.gate.deploy();
  }

  private advanceWorld(dt: number): void {
    const scrollDistance = tuning.world.scrollSpeed * dt;

    this.terrain.update(scrollDistance);
    this.clouds.update(scrollDistance);
    this.gate.update(dt, scrollDistance);

    // Progress stops accumulating once the boss appears, so the bar rests at 100% for the
    // duration of the fight instead of running past the end of the route.
    if (!this.run.bossSpawned) {
      this.run.distanceTravelled = Math.min(
        this.run.trackLength,
        this.run.distanceTravelled + scrollDistance,
      );
    }
  }

  private checkOutcomes(): void {
    if (!this.player.alive) {
      this.transition('die');
      return;
    }

    if (this.gate.hasCrossedPlayer && !this.run.finishCrossed) {
      this.run.finishCrossed = true;
      this.run.score +=
        tuning.scoring.finishBonus + Math.round(this.player.health * tuning.scoring.survivalBonus);
      this.transition('win');
    }
  }

  private updatePresentation(frameTime: number): void {
    this.updateCamera(frameTime);
    this.weapons.sync();
    this.hud.update(this.player, this.run, this.bossOrNull, this.effects.vignetteIntensity);
    this.hud.updateToast(frameTime);
  }

  /**
   * Chase camera.
   *
   * The base position is damped toward a target that only partially matches the player's
   * offset, so the plane drifts toward the edge of frame under hard manoeuvres. Shake is
   * added on top of the damped base rather than into it, otherwise each frame would smooth
   * toward the previous frame's shake and the effect would smear instead of snapping back.
   */
  private updateCamera(dt: number): void {
    const config = tuning.camera;
    const position = this.player.position;

    const targetX = position.x * config.followX;
    const targetY = position.y * config.followY + config.offsetY;
    const targetZ = position.z + config.offsetZ;

    this.cameraBase.x = damp(this.cameraBase.x, targetX, config.smoothing, dt);
    this.cameraBase.y = damp(this.cameraBase.y, targetY, config.smoothing, dt);
    this.cameraBase.z = damp(this.cameraBase.z, targetZ, config.smoothing, dt);

    const shake = this.effects.shake;
    this.camera.position.set(
      this.cameraBase.x + randRange(-shake, shake),
      this.cameraBase.y + randRange(-shake, shake),
      this.cameraBase.z + randRange(-shake, shake) * 0.5,
    );

    this.cameraLook.set(
      position.x + this.player.velocity.x * config.lookLead,
      position.y + config.lookRise,
      position.z - config.lookAhead,
    );
    this.camera.lookAt(this.cameraLook);

    this.sky.followCamera(this.camera.position.x, this.camera.position.y, this.camera.position.z);
  }

  private handleGlobalInput(): void {
    if (this.input.justPressed('KeyM')) {
      this.audio.resume();
      this.audio.toggleMute();
    }

    if (this.input.justPressedAny(PAUSE_KEYS)) {
      this.transition(this.state === 'paused' ? 'resume' : 'pause');
    }

    if (this.input.justPressed('Enter')) {
      this.audio.resume();
      switch (this.state) {
        case 'menu':
          this.transition('start');
          break;
        case 'gameOver':
        case 'victory':
        case 'paused':
          this.resetRun();
          this.transition('restart');
          break;
        case 'playing':
          break;
        default: {
          const exhaustive: never = this.state;
          throw new Error(`Unhandled state: ${String(exhaustive)}`);
        }
      }
    }
  }

  private transition(event: Parameters<typeof reduceState>[1]): void {
    const next = reduceState(this.state, event);
    if (next === this.state) {
      return;
    }

    this.state = next;
    this.screens.show(next);
    this.hud.setVisible(showsHud(next));

    switch (next) {
      case 'gameOver':
        this.screens.fillDefeat(this.run);
        this.audio.defeat();
        break;
      case 'victory':
        this.screens.fillVictory(this.run);
        this.audio.victory();
        break;
      case 'menu':
      case 'playing':
      case 'paused':
        break;
      default: {
        const exhaustive: never = next;
        throw new Error(`Unhandled state: ${String(exhaustive)}`);
      }
    }
  }

  private resetRun(): void {
    this.run.distanceTravelled = 0;
    this.run.score = 0;
    this.run.kills = 0;
    this.run.nextWaveIndex = 0;
    this.run.bossSpawned = false;
    this.run.bossDefeated = false;
    this.run.finishCrossed = false;
    this.run.elapsed = 0;

    this.player.reset();
    this.spawns.reset();
    this.weapons.reset();
    this.powerUps.reset();
    this.effects.reset();
    this.boss.reset();
    this.gate.reset();
    this.terrain.reset();
    this.clouds.reset();
    this.hud.reset();
    this.targets.length = 0;

    this.accumulator = 0;
    this.cameraBase.set(
      0,
      tuning.player.startAltitude * tuning.camera.followY + tuning.camera.offsetY,
      tuning.camera.offsetZ,
    );
  }

  onEnemyKilled(enemy: Enemy): void {
    this.run.score += enemy.scoreValue;
    this.run.kills += 1;
    // Debris and drops inherit a little of the enemy's vertical motion so a kill reads as
    // wreckage rather than an object appearing from nothing.
    this.powerUps.rollDrop(enemy.position, enemy.dropChance, enemy.velocity.y * 0.35);
    this.spawns.recycle(enemy);
  }

  onTurretDestroyed(_turret: Turret): void {
    this.run.score += tuning.boss.turret.score;
  }

  onBossKilled(boss: Boss): void {
    this.run.score += tuning.boss.score;
    this.run.kills += 1;
    this.run.bossDefeated = true;
    boss.despawn();
    this.gate.open();
  }

  onPlayerDied(): void {
    this.effects.spawnBigExplosion(this.player.position);
    this.audio.bigExplosion();
    this.transition('die');
  }

  private onPowerUpCollected(kind: PowerUpKind, applied: boolean): void {
    if (applied) {
      this.hud.showToast(POWER_UP_LABELS[kind], POWER_UP_COLORS[kind]);
      return;
    }

    // A cannon upgrade at maximum tier would otherwise be a dead pickup.
    this.run.score += 400;
    this.hud.showToast('Cannon Maxed +400', POWER_UP_COLORS[kind]);
  }
}
