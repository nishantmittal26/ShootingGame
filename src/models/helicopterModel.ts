import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { materials } from './materials';

const cabinGeometry = new SphereGeometry(1, 12, 9);
const glassGeometry = new SphereGeometry(0.72, 10, 8);
const boomGeometry = new BoxGeometry(0.34, 0.34, 3.1);
const tailFinGeometry = new BoxGeometry(0.14, 1.15, 0.7);
const mastGeometry = new CylinderGeometry(0.13, 0.13, 0.7, 6);
const bladeGeometry = new BoxGeometry(7.4, 0.07, 0.34);
const tailBladeGeometry = new BoxGeometry(0.07, 1.9, 0.2);
const skidGeometry = new BoxGeometry(0.12, 0.12, 2.6);
const strutGeometry = new BoxGeometry(0.1, 0.62, 0.1);
const podGeometry = new BoxGeometry(0.3, 0.3, 1.1);

export interface HelicopterModel {
  group: Group;
  mainRotor: Group;
  tailRotor: Group;
}

/**
 * Gunship helicopter. The rotor groups are returned so the entity can spin them; a
 * stationary rotor reads as a destroyed aircraft and kills the sense of threat.
 */
export function createHelicopterModel(): HelicopterModel {
  const group = new Group();

  const cabin = new Mesh(cabinGeometry, materials.helicopter.body);
  cabin.scale.set(1.15, 1.05, 1.6);
  cabin.position.z = -0.5;
  group.add(cabin);

  const glass = new Mesh(glassGeometry, materials.helicopter.glass);
  glass.scale.set(1.05, 0.9, 1.15);
  glass.position.set(0, 0.2, -1.55);
  group.add(glass);

  const boom = new Mesh(boomGeometry, materials.helicopter.trim);
  boom.position.set(0, 0.25, 2.05);
  group.add(boom);

  const tailFin = new Mesh(tailFinGeometry, materials.helicopter.trim);
  tailFin.position.set(0, 0.85, 3.35);
  group.add(tailFin);

  const mast = new Mesh(mastGeometry, materials.helicopter.trim);
  mast.position.set(0, 1.35, -0.4);
  group.add(mast);

  const mainRotor = new Group();
  mainRotor.position.set(0, 1.72, -0.4);
  for (let i = 0; i < 2; i += 1) {
    const blade = new Mesh(bladeGeometry, materials.helicopter.rotor);
    blade.rotation.y = (i * Math.PI) / 2;
    mainRotor.add(blade);
  }
  group.add(mainRotor);

  const tailRotor = new Group();
  tailRotor.position.set(0.28, 0.62, 3.4);
  for (let i = 0; i < 2; i += 1) {
    const blade = new Mesh(tailBladeGeometry, materials.helicopter.rotor);
    blade.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  group.add(tailRotor);

  for (const side of [-1, 1]) {
    const skid = new Mesh(skidGeometry, materials.helicopter.trim);
    skid.position.set(side * 0.85, -1.15, -0.3);
    group.add(skid);

    for (const z of [-1.1, 0.5]) {
      const strut = new Mesh(strutGeometry, materials.helicopter.trim);
      strut.position.set(side * 0.85, -0.82, z);
      group.add(strut);
    }

    const pod = new Mesh(podGeometry, materials.helicopter.trim);
    pod.position.set(side * 1.25, -0.15, -0.4);
    group.add(pod);
  }

  return { group, mainRotor, tailRotor };
}
