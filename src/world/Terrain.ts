import {
  BufferAttribute,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Scene,
} from 'three';
import { tuning } from '../config/tuning';
import { randRange, randSign } from '../core/mathUtils';

const ridgeGeometry = new ConeGeometry(1, 1, 5);

const groundMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  metalness: 0,
  flatShading: true,
});

const ridgeMaterial = new MeshStandardMaterial({
  color: 0x53614a,
  roughness: 0.9,
  metalness: 0,
  flatShading: true,
});

interface Tile {
  readonly group: Group;
  readonly ridges: Mesh[];
}

/**
 * Per-quad colour variation, so the flat ground reads as patchwork fields streaming past.
 *
 * The plane is kept perfectly flat rather than displaced, which means neighbouring tiles
 * can never show a seam no matter how their colours differ.
 */
function createTileGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(
    tuning.world.terrain.tileWidth,
    tuning.world.terrain.tileDepth,
    18,
    9,
  ).rotateX(-Math.PI / 2);

  const nonIndexed = geometry.toNonIndexed();
  geometry.dispose();

  const vertexCount = nonIndexed.getAttribute('position').count;
  const colours = new Float32Array(vertexCount * 3);

  // Two triangles form one quad; colouring six vertices at a time keeps quads flat-shaded
  // as single patches instead of gradients.
  for (let vertex = 0; vertex < vertexCount; vertex += 6) {
    const shade = randRange(0.72, 1.08);
    const patchy = Math.random();
    const r = (patchy < 0.16 ? 0.42 : 0.24) * shade;
    const g = (patchy < 0.16 ? 0.44 : 0.4) * shade;
    const b = (patchy < 0.16 ? 0.26 : 0.21) * shade;

    for (let offset = 0; offset < 6 && vertex + offset < vertexCount; offset += 1) {
      const index = (vertex + offset) * 3;
      colours[index] = r;
      colours[index + 1] = g;
      colours[index + 2] = b;
    }
  }

  nonIndexed.setAttribute('color', new BufferAttribute(colours, 3));
  return nonIndexed;
}

/**
 * The ground, built from a ring of tiles that are moved back to the far end once they pass
 * behind the camera. A fixed set of tiles cycling forever costs nothing to extend, so the
 * route can be any length.
 */
export class Terrain {
  private readonly tiles: Tile[] = [];
  private readonly span: number;

  constructor(scene: Scene) {
    const { tileCount, tileDepth, ridgesPerTile } = tuning.world.terrain;
    this.span = tileCount * tileDepth;

    for (let i = 0; i < tileCount; i += 1) {
      const group = new Group();
      group.position.set(0, tuning.world.groundY, tuning.world.cullPlane - i * tileDepth);

      const ground = new Mesh(createTileGeometry(), groundMaterial);
      group.add(ground);

      const ridges: Mesh[] = [];
      for (let r = 0; r < ridgesPerTile; r += 1) {
        const ridge = new Mesh(ridgeGeometry, ridgeMaterial);
        ridges.push(ridge);
        group.add(ridge);
      }

      scene.add(group);
      const tile: Tile = { group, ridges };
      this.scatterRidges(tile);
      this.tiles.push(tile);
    }
  }

  /**
   * Places ridge props on a tile, keeping a clear central lane. Terrain crossing the
   * corridor the player fights in would mask incoming enemies and read as unfair.
   */
  private scatterRidges(tile: Tile): void {
    const { tileDepth, ridgeSpreadX, ridgeClearLane } = tuning.world.terrain;

    for (const ridge of tile.ridges) {
      const height = randRange(6, 30);
      const radius = randRange(6, 20);
      ridge.scale.set(radius, height, radius);
      ridge.position.set(
        randSign() * randRange(ridgeClearLane, ridgeSpreadX),
        height * 0.5 - 1,
        randRange(-tileDepth * 0.5, tileDepth * 0.5),
      );
      ridge.rotation.y = Math.random() * Math.PI * 2;
    }
  }

  update(scrollDistance: number): void {
    const { tileDepth } = tuning.world.terrain;
    const recycleAt = tuning.world.cullPlane + tileDepth * 0.5;

    for (const tile of this.tiles) {
      tile.group.position.z += scrollDistance;
      if (tile.group.position.z > recycleAt) {
        tile.group.position.z -= this.span;
        this.scatterRidges(tile);
      }
    }
  }

  reset(): void {
    const { tileCount, tileDepth } = tuning.world.terrain;
    for (let i = 0; i < tileCount; i += 1) {
      const tile = this.tiles[i] as Tile;
      tile.group.position.z = tuning.world.cullPlane - i * tileDepth;
      this.scatterRidges(tile);
    }
  }
}
