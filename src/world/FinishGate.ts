import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import { tuning } from '../config/tuning';
import { materials } from '../models/materials';

const PYLON_X = 34;
const PYLON_HEIGHT = 46;
const CURTAIN_WIDTH = PYLON_X * 2;

const pylonGeometry = new BoxGeometry(3.4, PYLON_HEIGHT, 3.4);
const beamGeometry = new BoxGeometry(CURTAIN_WIDTH + 3.4, 3, 3.4);
const stripeGeometry = new BoxGeometry(3.6, 3, 3.6);
const curtainGeometry = new PlaneGeometry(CURTAIN_WIDTH, PYLON_HEIGHT);
const lampGeometry = new BoxGeometry(1.4, 1.4, 1.4);

/**
 * The finish line.
 *
 * It deploys as a closed red barrier the moment the boss appears, so the player can see
 * exactly what they are fighting for and that it is shut. It only turns green and begins
 * closing the distance once the boss is destroyed, which is what makes the boss a gate
 * rather than an optional obstacle.
 */
export class FinishGate {
  private readonly group = new Group();
  private readonly curtain: Mesh;
  private readonly curtainMaterial: MeshStandardMaterial;
  private readonly lamps: Mesh[] = [];

  private deployed = false;
  private opened = false;
  private pulse = 0;

  constructor(scene: Scene) {
    for (const side of [-1, 1]) {
      const pylon = new Mesh(pylonGeometry, materials.gate.pylon);
      pylon.position.set(side * PYLON_X, PYLON_HEIGHT / 2, 0);
      this.group.add(pylon);

      // Hazard banding, which reads as a barrier even before the colour registers.
      for (let i = 0; i < 7; i += 1) {
        const stripe = new Mesh(stripeGeometry, materials.gate.stripe);
        stripe.position.set(side * PYLON_X, 4 + i * 6.5, 0);
        this.group.add(stripe);
      }

      const lamp = new Mesh(lampGeometry, materials.gate.beamClosed);
      lamp.position.set(side * PYLON_X, PYLON_HEIGHT + 1.6, 0);
      this.group.add(lamp);
      this.lamps.push(lamp);
    }

    const beam = new Mesh(beamGeometry, materials.gate.pylon);
    beam.position.set(0, PYLON_HEIGHT + 0.4, 0);
    this.group.add(beam);

    this.curtainMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff4d5a,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.curtain = new Mesh(curtainGeometry, this.curtainMaterial);
    this.curtain.position.set(0, PYLON_HEIGHT / 2, 0);
    this.group.add(this.curtain);

    this.group.visible = false;
    scene.add(this.group);
  }

  get isDeployed(): boolean {
    return this.deployed;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Shows the barrier, shut, at the far end of the corridor. */
  deploy(): void {
    this.deployed = true;
    this.opened = false;
    this.group.visible = true;
    this.group.position.set(0, tuning.world.groundY, tuning.boss.holdZ - 260);
    this.setColour(0xff4d5a);
  }

  /** Unseals the gate; from here it closes on the player at the run's scroll speed. */
  open(): void {
    if (!this.deployed) {
      this.deploy();
    }
    this.opened = true;
    this.setColour(0x64ff9c);
  }

  private setColour(hex: number): void {
    this.curtainMaterial.emissive.setHex(hex);
    for (const lamp of this.lamps) {
      lamp.material = this.opened ? materials.gate.beamOpen : materials.gate.beamClosed;
    }
  }

  update(dt: number, scrollDistance: number): void {
    if (!this.deployed) {
      return;
    }

    // While shut it matches the player's speed, holding station behind the boss. Once open
    // it stops matching and the world carries it back toward the player.
    if (this.opened) {
      this.group.position.z += scrollDistance;
    }

    this.pulse += dt * (this.opened ? 5 : 2.4);
    const wave = 0.5 + Math.sin(this.pulse) * 0.5;
    this.curtainMaterial.opacity = this.opened ? 0.12 + wave * 0.12 : 0.26 + wave * 0.22;
    this.curtain.scale.y = 1;
  }

  /** True once the gate has passed the player, which ends the run in victory. */
  get hasCrossedPlayer(): boolean {
    return this.deployed && this.opened && this.group.position.z > 8;
  }

  reset(): void {
    this.deployed = false;
    this.opened = false;
    this.pulse = 0;
    this.group.visible = false;
    this.group.position.z = tuning.boss.holdZ - 260;
    this.setColour(0xff4d5a);
  }
}
