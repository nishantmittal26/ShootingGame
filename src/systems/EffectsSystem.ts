import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  Sphere,
  Vector3,
  type Scene,
} from 'three';
import { tuning } from '../config/tuning';
import { damp, randRange } from '../core/mathUtils';

interface Particle {
  active: boolean;
  readonly position: Vector3;
  readonly velocity: Vector3;
  life: number;
  maxLife: number;
  readonly colour: Color;
  /** Large particles render in the fireball layer, small ones in the spark layer. */
  big: boolean;
  drag: number;
  gravity: number;
}

const SPARK_SIZE = 1.3;
const FIREBALL_SIZE = 6;

/**
 * Particles, camera shake, and the damage vignette.
 *
 * All particles live in two `Points` objects rather than one mesh each, so a hundred-piece
 * explosion still costs two draw calls. Active particles are compacted to the front of the
 * buffers each frame and the draw range is trimmed to match, which avoids needing a
 * per-particle alpha attribute to hide the unused tail.
 */
export class EffectsSystem {
  private readonly particles: Particle[] = [];
  private cursor = 0;

  private readonly sparkPositions: Float32Array;
  private readonly sparkColours: Float32Array;
  private readonly fireballPositions: Float32Array;
  private readonly fireballColours: Float32Array;

  private readonly sparkGeometry = new BufferGeometry();
  private readonly fireballGeometry = new BufferGeometry();

  private shakeAmount = 0;
  private vignette = 0;

  constructor(scene: Scene) {
    const capacity = tuning.effects.particlePool;

    for (let i = 0; i < capacity; i += 1) {
      this.particles.push({
        active: false,
        position: new Vector3(),
        velocity: new Vector3(),
        life: 0,
        maxLife: 1,
        colour: new Color(),
        big: false,
        drag: 2,
        gravity: 0,
      });
    }

    this.sparkPositions = new Float32Array(capacity * 3);
    this.sparkColours = new Float32Array(capacity * 3);
    this.fireballPositions = new Float32Array(capacity * 3);
    this.fireballColours = new Float32Array(capacity * 3);

    const sparks = this.buildLayer(
      this.sparkGeometry,
      this.sparkPositions,
      this.sparkColours,
      SPARK_SIZE,
    );
    const fireballs = this.buildLayer(
      this.fireballGeometry,
      this.fireballPositions,
      this.fireballColours,
      FIREBALL_SIZE,
    );

    scene.add(sparks);
    scene.add(fireballs);
  }

  private buildLayer(
    geometry: BufferGeometry,
    positions: Float32Array,
    colours: Float32Array,
    size: number,
  ): Points {
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    geometry.setDrawRange(0, 0);
    // Particles move every frame and are always near the camera, so recomputing bounds
    // would be wasted work; a fixed huge sphere keeps them from being culled.
    geometry.boundingSphere = new Sphere(new Vector3(), 1e5);

    const material = new PointsMaterial({
      size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  /**
   * Grabs the next particle slot, round-robin. Overwriting the oldest particle when the
   * budget is exhausted keeps heavy moments visually dense instead of dropping new
   * explosions entirely.
   */
  private next(): Particle {
    const particle = this.particles[this.cursor] as Particle;
    this.cursor = (this.cursor + 1) % this.particles.length;
    return particle;
  }

  private emit(
    position: Vector3,
    speed: number,
    colour: number,
    life: number,
    big: boolean,
    inherited: Vector3 | null,
    gravity: number,
  ): void {
    const particle = this.next();
    particle.active = true;
    particle.position.copy(position);
    particle.velocity.set(
      randRange(-speed, speed),
      randRange(-speed, speed),
      randRange(-speed, speed),
    );
    if (inherited) {
      particle.velocity.add(inherited);
    }
    particle.life = life;
    particle.maxLife = life;
    particle.colour.setHex(colour);
    particle.big = big;
    particle.drag = big ? 1.4 : 2.6;
    particle.gravity = gravity;
  }

  spawnMuzzleFlash(position: Vector3, colour = 0xffd27a): void {
    for (let i = 0; i < tuning.effects.muzzleParticles; i += 1) {
      this.emit(position, 9, colour, 0.14, false, null, 0);
    }
  }

  spawnImpact(position: Vector3, colour = 0xffe0a0, inherited: Vector3 | null = null): void {
    for (let i = 0; i < tuning.effects.impactParticles; i += 1) {
      this.emit(position, 26, colour, tuning.effects.particleLife, false, inherited, 0);
    }
  }

  spawnExplosion(position: Vector3, colour = 0xff9a3c, inherited: Vector3 | null = null): void {
    const life = tuning.effects.explosionLife;
    for (let i = 0; i < tuning.effects.explosionParticles; i += 1) {
      this.emit(position, 34, colour, life * randRange(0.6, 1.1), false, inherited, -14);
    }
    for (let i = 0; i < 7; i += 1) {
      this.emit(position, 13, 0xffd06a, life * randRange(0.5, 0.9), true, inherited, -4);
    }
    this.addShake(tuning.effects.shake.enemyKill);
  }

  spawnBigExplosion(position: Vector3): void {
    const life = tuning.effects.explosionLife * 2.1;
    for (let i = 0; i < tuning.effects.bossExplosionParticles; i += 1) {
      this.emit(position, 60, 0xff7a2c, life * randRange(0.5, 1.2), false, null, -16);
    }
    for (let i = 0; i < 26; i += 1) {
      this.emit(position, 26, 0xffe08a, life * randRange(0.5, 1), true, null, -6);
    }
    this.addShake(tuning.effects.shake.bossDeath);
  }

  spawnTrail(position: Vector3, colour = 0xff9ad8): void {
    this.emit(position, 1.4, colour, 0.26, false, null, 0);
  }

  spawnPickupBurst(position: Vector3, colour: number): void {
    for (let i = 0; i < 14; i += 1) {
      this.emit(position, 17, colour, 0.42, false, null, 0);
    }
  }

  addShake(amount: number): void {
    this.shakeAmount = Math.min(tuning.camera.maxShake, this.shakeAmount + amount);
  }

  addVignette(amount: number): void {
    this.vignette = Math.min(1, this.vignette + amount);
  }

  get shake(): number {
    return this.shakeAmount;
  }

  get vignetteIntensity(): number {
    return this.vignette;
  }

  update(dt: number): void {
    let sparkCount = 0;
    let fireballCount = 0;

    for (const particle of this.particles) {
      if (!particle.active) {
        continue;
      }

      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }

      const decay = Math.exp(-particle.drag * dt);
      particle.velocity.multiplyScalar(decay);
      particle.velocity.y += particle.gravity * dt;
      particle.position.addScaledVector(particle.velocity, dt);

      // Additive blending renders black as transparent, so scaling brightness by remaining
      // life fades the particle out without needing a per-point alpha attribute.
      const fade = particle.life / particle.maxLife;
      const intensity = fade * fade;

      if (particle.big) {
        const offset = fireballCount * 3;
        this.fireballPositions[offset] = particle.position.x;
        this.fireballPositions[offset + 1] = particle.position.y;
        this.fireballPositions[offset + 2] = particle.position.z;
        this.fireballColours[offset] = particle.colour.r * intensity;
        this.fireballColours[offset + 1] = particle.colour.g * intensity;
        this.fireballColours[offset + 2] = particle.colour.b * intensity;
        fireballCount += 1;
      } else {
        const offset = sparkCount * 3;
        this.sparkPositions[offset] = particle.position.x;
        this.sparkPositions[offset + 1] = particle.position.y;
        this.sparkPositions[offset + 2] = particle.position.z;
        this.sparkColours[offset] = particle.colour.r * intensity;
        this.sparkColours[offset + 1] = particle.colour.g * intensity;
        this.sparkColours[offset + 2] = particle.colour.b * intensity;
        sparkCount += 1;
      }
    }

    this.sparkGeometry.setDrawRange(0, sparkCount);
    this.fireballGeometry.setDrawRange(0, fireballCount);
    this.sparkGeometry.getAttribute('position').needsUpdate = true;
    this.sparkGeometry.getAttribute('color').needsUpdate = true;
    this.fireballGeometry.getAttribute('position').needsUpdate = true;
    this.fireballGeometry.getAttribute('color').needsUpdate = true;

    this.shakeAmount = damp(this.shakeAmount, 0, tuning.camera.shakeDecay, dt);
    this.vignette = damp(this.vignette, 0, tuning.effects.vignetteFade, dt);
  }

  reset(): void {
    for (const particle of this.particles) {
      particle.active = false;
    }
    this.cursor = 0;
    this.shakeAmount = 0;
    this.vignette = 0;
    this.sparkGeometry.setDrawRange(0, 0);
    this.fireballGeometry.setDrawRange(0, 0);
  }
}
