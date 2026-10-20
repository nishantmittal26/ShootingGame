import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Sphere,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three';
import type { Damageable, ProjectileOwner } from '../types';
import type { Poolable } from '../core/Pool';

export type ProjectileVisual = 'tracer' | 'bolt' | 'missile';

export class Projectile implements Poolable {
  active = false;
  owner: ProjectileOwner = 'player';
  visual: ProjectileVisual = 'tracer';
  readonly position = new Vector3();
  /** Where this projectile was at the start of the step, for the swept collision test. */
  readonly previousPosition = new Vector3();
  readonly velocity = new Vector3();
  damage = 0;
  life = 0;
  homingTarget: Damageable | null = null;
  turnRate = 0;
}

/** Geometry points along -Z, matching the game's forward direction. */
const tracerGeometry = new CylinderGeometry(0.15, 0.15, 3.6, 6).rotateX(-Math.PI / 2);
const boltGeometry = new CylinderGeometry(0.3, 0.18, 1.9, 6).rotateX(-Math.PI / 2);
const missileGeometry = new ConeGeometry(0.32, 1.9, 6).rotateX(-Math.PI / 2);

const FORWARD = new Vector3(0, 0, -1);
const scratchMatrix = new Matrix4();
const scratchQuaternion = new Quaternion();
const scratchDirection = new Vector3();
const unitScale = new Vector3(1, 1, 1);

/**
 * Draws every projectile in three instanced meshes, one per visual kind.
 *
 * A mesh per projectile would put hundreds of nodes in the scene graph, all of which get
 * walked for matrix updates and culling every frame. Instancing collapses that to three
 * draw calls and no per-projectile scene nodes, at the cost of writing matrices manually.
 */
export class ProjectileRenderer {
  private readonly meshes: Record<ProjectileVisual, InstancedMesh>;

  constructor(scene: Scene, capacity: number) {
    this.meshes = {
      tracer: this.createLayer(scene, tracerGeometry, 0x9ff6ff, capacity),
      bolt: this.createLayer(scene, boltGeometry, 0xff7a3c, capacity),
      missile: this.createLayer(scene, missileGeometry, 0xff8ae0, capacity),
    };
  }

  private createLayer(
    scene: Scene,
    geometry: BufferGeometry,
    color: number,
    capacity: number,
  ): InstancedMesh {
    // Unlit so tracers stay bright regardless of scene lighting, but still fogged so
    // distant shots recede instead of glaring at the horizon.
    const material = new MeshBasicMaterial({ color, fog: true });
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.boundingSphere = new Sphere(new Vector3(), 1e5);
    scene.add(mesh);
    return mesh;
  }

  /** Writes matrices for the active projectiles and trims each layer's instance count. */
  sync(projectiles: readonly Projectile[]): void {
    let tracers = 0;
    let bolts = 0;
    let missiles = 0;

    for (let i = 0; i < projectiles.length; i += 1) {
      const projectile = projectiles[i] as Projectile;
      if (!projectile.active) {
        continue;
      }

      scratchDirection.copy(projectile.velocity);
      if (scratchDirection.lengthSq() < 1e-6) {
        scratchDirection.copy(FORWARD);
      } else {
        scratchDirection.normalize();
      }
      scratchQuaternion.setFromUnitVectors(FORWARD, scratchDirection);
      scratchMatrix.compose(projectile.position, scratchQuaternion, unitScale);

      switch (projectile.visual) {
        case 'tracer':
          this.meshes.tracer.setMatrixAt(tracers, scratchMatrix);
          tracers += 1;
          break;
        case 'bolt':
          this.meshes.bolt.setMatrixAt(bolts, scratchMatrix);
          bolts += 1;
          break;
        case 'missile':
          this.meshes.missile.setMatrixAt(missiles, scratchMatrix);
          missiles += 1;
          break;
        default: {
          const exhaustive: never = projectile.visual;
          throw new Error(`Unhandled projectile visual: ${String(exhaustive)}`);
        }
      }
    }

    this.meshes.tracer.count = tracers;
    this.meshes.bolt.count = bolts;
    this.meshes.missile.count = missiles;
    this.meshes.tracer.instanceMatrix.needsUpdate = true;
    this.meshes.bolt.instanceMatrix.needsUpdate = true;
    this.meshes.missile.instanceMatrix.needsUpdate = true;
  }
}
