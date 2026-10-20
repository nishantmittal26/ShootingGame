import {
  BoxGeometry,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import type { PowerUpKind } from '../types';

export const POWER_UP_COLORS: Record<PowerUpKind, number> = {
  weapon: 0xffa63c,
  rapidFire: 0xffe14a,
  missiles: 0xff6bd6,
  shield: 0x5ff0ff,
  repair: 0x64ff9c,
};

export const POWER_UP_LABELS: Record<PowerUpKind, string> = {
  weapon: 'Cannon Upgrade',
  rapidFire: 'Rapid Fire',
  missiles: 'Missiles',
  shield: 'Shield',
  repair: 'Hull Repair',
};

/** A distinct silhouette per kind, so powers are identifiable before the colour registers. */
const coreGeometries: Record<PowerUpKind, BufferGeometry> = {
  weapon: new OctahedronGeometry(1.05),
  rapidFire: new TetrahedronGeometry(1.25),
  missiles: new ConeGeometry(0.95, 2.1, 6),
  shield: new IcosahedronGeometry(1),
  repair: new BoxGeometry(1.5, 1.5, 1.5),
};

const haloGeometry = new TorusGeometry(1.75, 0.14, 6, 20);

function buildMaterials(): Record<PowerUpKind, { core: MeshStandardMaterial; halo: MeshStandardMaterial }> {
  const entries = Object.entries(POWER_UP_COLORS) as [PowerUpKind, number][];
  const result = {} as Record<PowerUpKind, { core: MeshStandardMaterial; halo: MeshStandardMaterial }>;

  for (const [kind, color] of entries) {
    result[kind] = {
      core: new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.2,
        flatShading: true,
      }),
      halo: new MeshStandardMaterial({
        color: 0xffffff,
        emissive: color,
        emissiveIntensity: 1.6,
        roughness: 0.4,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
      }),
    };
  }

  return result;
}

const kindMaterials = buildMaterials();

export interface PowerUpModel {
  group: Group;
  setKind(kind: PowerUpKind): void;
}

/**
 * Pickups are pooled, so one model holds every kind's core mesh and reveals the right one
 * on acquire rather than rebuilding geometry per drop.
 */
export function createPowerUpModel(): PowerUpModel {
  const group = new Group();
  const cores = {} as Record<PowerUpKind, Mesh>;

  for (const key of Object.keys(coreGeometries) as PowerUpKind[]) {
    const mesh = new Mesh(coreGeometries[key], kindMaterials[key].core);
    mesh.visible = false;
    cores[key] = mesh;
    group.add(mesh);
  }

  const halo = new Mesh(haloGeometry, kindMaterials.weapon.halo);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  function setKind(kind: PowerUpKind): void {
    for (const key of Object.keys(cores) as PowerUpKind[]) {
      cores[key].visible = key === kind;
    }
    halo.material = kindMaterials[kind].halo;
  }

  setKind('weapon');

  return { group, setKind };
}
