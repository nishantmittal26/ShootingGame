import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { materials } from './materials';

const hullGeometry = new BoxGeometry(15, 3.2, 11);
const spineGeometry = new BoxGeometry(4.6, 1.9, 8);
// A four-sided cone makes a hard-edged wedge prow, pointed toward the player at +Z.
const prowGeometry = new ConeGeometry(3.4, 6, 4).rotateX(Math.PI / 2);
const sponsonGeometry = new BoxGeometry(6.4, 1.7, 7);
const wingGeometry = new BoxGeometry(9, 0.7, 4.2);
const finGeometry = new BoxGeometry(0.5, 3.4, 3);
const nacelleGeometry = new CylinderGeometry(1.1, 1.3, 3.4, 8).rotateX(Math.PI / 2);
const exhaustGeometry = new CylinderGeometry(0.95, 0.95, 0.5, 8).rotateX(Math.PI / 2);
const coreGeometry = new BoxGeometry(3, 1.1, 1.1);
const stripeGeometry = new BoxGeometry(15.2, 0.4, 1.2);

const turretBaseGeometry = new CylinderGeometry(1.05, 1.25, 0.8, 8);
const turretHeadGeometry = new BoxGeometry(1.5, 1, 1.5);
const turretBarrelGeometry = new CylinderGeometry(0.22, 0.22, 3, 6).rotateX(Math.PI / 2);

export interface BossModel {
  group: Group;
  /** Local mount points where destructible turrets attach. */
  turretAnchors: Vector3[];
  /** Emissive core, brightened as the boss takes damage. */
  core: Mesh;
}

/**
 * The gunship guarding the finish line.
 *
 * Authored facing +Z so the player sees its prow and turrets rather than its engines. It
 * drifts backward down the corridor while keeping its guns trained on the player.
 */
export function createBossModel(): BossModel {
  const group = new Group();

  const hull = new Mesh(hullGeometry, materials.boss.hull);
  group.add(hull);

  const spine = new Mesh(spineGeometry, materials.boss.plate);
  spine.position.set(0, 2, -0.5);
  group.add(spine);

  const prow = new Mesh(prowGeometry, materials.boss.plate);
  prow.position.set(0, -0.2, 7.4);
  group.add(prow);

  const core = new Mesh(coreGeometry, materials.boss.core);
  core.position.set(0, 0.4, 5.2);
  group.add(core);

  for (const y of [1.75, -1.75]) {
    const stripe = new Mesh(stripeGeometry, materials.boss.accent);
    stripe.position.set(0, y, 3.6);
    group.add(stripe);
  }

  for (const side of [-1, 1]) {
    const sponson = new Mesh(sponsonGeometry, materials.boss.hull);
    sponson.position.set(side * 9.5, -0.4, 0.5);
    group.add(sponson);

    const wing = new Mesh(wingGeometry, materials.boss.plate);
    wing.position.set(side * 15.5, -0.2, -0.5);
    wing.rotation.z = side * -0.09;
    group.add(wing);

    const fin = new Mesh(finGeometry, materials.boss.accent);
    fin.position.set(side * 19.2, 1.4, -0.5);
    group.add(fin);

    for (const offset of [-1.6, 1.6]) {
      const nacelle = new Mesh(nacelleGeometry, materials.boss.plate);
      nacelle.position.set(side * 9.5 + offset * 0.9, -1.6, -5);
      group.add(nacelle);

      const exhaust = new Mesh(exhaustGeometry, materials.boss.exhaust);
      exhaust.position.set(side * 9.5 + offset * 0.9, -1.6, -6.8);
      group.add(exhaust);
    }
  }

  const turretAnchors = [
    new Vector3(-6.4, 2.1, 3.2),
    new Vector3(6.4, 2.1, 3.2),
    new Vector3(-11.2, -1.6, 1.4),
    new Vector3(11.2, -1.6, 1.4),
  ];

  return { group, turretAnchors, core };
}

/** One destructible turret, built separately so it can be removed when destroyed. */
export function createTurretModel(): Group {
  const group = new Group();

  const base = new Mesh(turretBaseGeometry, materials.boss.plate);
  group.add(base);

  const head = new Mesh(turretHeadGeometry, materials.boss.turret);
  head.position.y = 0.85;
  group.add(head);

  for (const side of [-0.4, 0.4]) {
    const barrel = new Mesh(turretBarrelGeometry, materials.boss.turret);
    barrel.position.set(side, 0.85, 1.9);
    group.add(barrel);
  }

  return group;
}
