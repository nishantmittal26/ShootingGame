import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { materials } from './materials';

/**
 * Geometry is authored pointing down -Z, which is "forward" in this game's frame, so
 * cylinders and cones are rotated once at construction instead of per instance.
 */
const fuselageGeometry = new CylinderGeometry(0.52, 0.42, 4.4, 10).rotateX(-Math.PI / 2);
const noseGeometry = new ConeGeometry(0.52, 1.7, 10).rotateX(-Math.PI / 2);
const wingGeometry = new BoxGeometry(3.9, 0.16, 1.5);
const tailWingGeometry = new BoxGeometry(2.5, 0.14, 0.8);
const finGeometry = new BoxGeometry(0.14, 1.25, 1.0);
const canopyGeometry = new SphereGeometry(0.46, 12, 8);
const exhaustGeometry = new CylinderGeometry(0.3, 0.36, 0.5, 8).rotateX(-Math.PI / 2);
const stripeGeometry = new BoxGeometry(0.2, 0.06, 3.2);

/** The player's fighter: swept wings, bubble canopy, twin glowing exhausts. */
export function createPlayerModel(): Group {
  const group = new Group();

  const fuselage = new Mesh(fuselageGeometry, materials.player.body);
  group.add(fuselage);

  const nose = new Mesh(noseGeometry, materials.player.body);
  nose.position.z = -3.05;
  group.add(nose);

  // Rotating each wing about Y sweeps its tip backward, which reads as speed from behind.
  for (const side of [-1, 1]) {
    const wing = new Mesh(wingGeometry, materials.player.wing);
    wing.position.set(side * 2.1, -0.08, 0.35);
    wing.rotation.y = side * 0.34;
    wing.rotation.z = side * -0.06;
    group.add(wing);

    const wingTip = new Mesh(finGeometry, materials.player.accent);
    wingTip.scale.set(1, 0.55, 0.6);
    wingTip.position.set(side * 3.85, 0.16, 0.95);
    group.add(wingTip);

    const tailWing = new Mesh(tailWingGeometry, materials.player.wing);
    tailWing.position.set(side * 1.1, 0.05, 2.05);
    tailWing.rotation.y = side * 0.42;
    group.add(tailWing);

    const exhaust = new Mesh(exhaustGeometry, materials.player.exhaust);
    exhaust.position.set(side * 0.34, -0.04, 2.35);
    group.add(exhaust);

    const stripe = new Mesh(stripeGeometry, materials.player.accent);
    stripe.position.set(side * 0.4, 0.5, -0.2);
    group.add(stripe);
  }

  const fin = new Mesh(finGeometry, materials.player.wing);
  fin.position.set(0, 0.68, 1.9);
  group.add(fin);

  const canopy = new Mesh(canopyGeometry, materials.player.canopy);
  canopy.scale.set(1, 0.82, 1.9);
  canopy.position.set(0, 0.42, -0.85);
  group.add(canopy);

  return group;
}

/**
 * Local offsets of the cannon muzzles, used so tracers leave the wings rather than the
 * centre of the model.
 */
export const PLAYER_MUZZLES = [
  { x: -2.4, y: -0.05, z: -0.9 },
  { x: 2.4, y: -0.05, z: -0.9 },
] as const;
