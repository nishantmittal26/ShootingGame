import { Group, Mesh, MeshStandardMaterial, SphereGeometry, type Scene } from 'three';
import { tuning } from '../config/tuning';
import { randRange } from '../core/mathUtils';

const puffGeometry = new SphereGeometry(1, 7, 5);

const cloudMaterial = new MeshStandardMaterial({
  color: 0xf4f9ff,
  roughness: 1,
  metalness: 0,
  transparent: true,
  opacity: 0.82,
  flatShading: true,
  depthWrite: false,
});

/**
 * Cloud props at mixed altitudes and depths.
 *
 * These exist for parallax: ground detail alone gives a weak sense of speed because it is
 * far below the flight path, whereas clouds passing at the player's own altitude sell it.
 */
export class Clouds {
  private readonly clouds: Group[] = [];

  constructor(scene: Scene) {
    for (let i = 0; i < tuning.world.clouds.count; i += 1) {
      const cloud = new Group();

      // A few overlapping spheres of varied size read as a soft mass rather than a ball.
      const puffCount = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p += 1) {
        const puff = new Mesh(puffGeometry, cloudMaterial);
        puff.position.set(randRange(-1, 1), randRange(-0.35, 0.35), randRange(-0.8, 0.8));
        puff.scale.setScalar(randRange(0.55, 1.05));
        cloud.add(puff);
      }

      this.place(cloud, true);
      scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private place(cloud: Group, spreadOverDepth: boolean): void {
    const config = tuning.world.clouds;
    cloud.position.x = randRange(-config.spreadX, config.spreadX);
    cloud.position.y = randRange(config.minY, config.maxY);
    cloud.position.z = spreadOverDepth
      ? randRange(-config.depth, tuning.world.cullPlane)
      : -config.depth;
    cloud.scale.setScalar(randRange(config.minScale, config.maxScale));
    cloud.rotation.y = Math.random() * Math.PI * 2;
  }

  update(scrollDistance: number): void {
    for (const cloud of this.clouds) {
      cloud.position.z += scrollDistance;
      if (cloud.position.z > tuning.world.cullPlane + 60) {
        this.place(cloud, false);
      }
    }
  }

  reset(): void {
    for (const cloud of this.clouds) {
      this.place(cloud, true);
    }
  }
}
