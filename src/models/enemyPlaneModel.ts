import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh } from 'three';
import { materials } from './materials';

const fuselageGeometry = new CylinderGeometry(0.6, 0.46, 4, 8).rotateX(-Math.PI / 2);
const noseGeometry = new ConeGeometry(0.6, 1.5, 8).rotateX(-Math.PI / 2);
const wingGeometry = new BoxGeometry(4.4, 0.2, 1.7);
const finGeometry = new BoxGeometry(0.16, 1.1, 1.1);
const cockpitGeometry = new BoxGeometry(0.7, 0.4, 1.4);
const exhaustGeometry = new CylinderGeometry(0.34, 0.42, 0.5, 8).rotateX(-Math.PI / 2);

/**
 * Hostile interceptor. Forward-swept wings and a red scheme so it is never mistaken for
 * the player's plane at a glance, which matters when both are on screen at speed.
 */
export function createEnemyPlaneModel(): Group {
  const group = new Group();

  const fuselage = new Mesh(fuselageGeometry, materials.enemyPlane.body);
  group.add(fuselage);

  const nose = new Mesh(noseGeometry, materials.enemyPlane.accent);
  nose.position.z = -2.7;
  group.add(nose);

  for (const side of [-1, 1]) {
    const wing = new Mesh(wingGeometry, materials.enemyPlane.wing);
    wing.position.set(side * 2.4, 0, -0.1);
    // Negative sweep: the tip leads the root, reading as aggressive rather than sleek.
    wing.rotation.y = side * -0.26;
    wing.rotation.z = side * 0.1;
    group.add(wing);

    const tipFin = new Mesh(finGeometry, materials.enemyPlane.accent);
    tipFin.scale.set(1, 0.7, 0.7);
    tipFin.position.set(side * 4.35, 0.3, -0.45);
    group.add(tipFin);

    const tailFin = new Mesh(finGeometry, materials.enemyPlane.wing);
    tailFin.scale.set(1, 0.9, 0.9);
    tailFin.position.set(side * 0.55, 0.62, 1.7);
    tailFin.rotation.z = side * 0.34;
    group.add(tailFin);
  }

  const cockpit = new Mesh(cockpitGeometry, materials.enemyPlane.accent);
  cockpit.position.set(0, 0.42, -0.7);
  group.add(cockpit);

  const exhaust = new Mesh(exhaustGeometry, materials.enemyPlane.exhaust);
  exhaust.position.set(0, 0, 2.2);
  group.add(exhaust);

  return group;
}
