import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type Scene,
} from 'three';
import { tuning } from '../config/tuning';

const vertexShader = /* glsl */ `
  varying vec3 vWorldDirection;

  void main() {
    vWorldDirection = normalize(mat3(modelMatrix) * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying vec3 vWorldDirection;

  void main() {
    // Bias the blend toward the horizon so the gradient reads as haze rather than a
    // linear wash from zenith to ground.
    float height = clamp(vWorldDirection.y * 1.6 + 0.12, 0.0, 1.0);
    vec3 sky = mix(horizonColor, topColor, pow(height, 0.72));
    gl_FragColor = vec4(sky, 1.0);
  }
`;

const geometry = new SphereGeometry(1, 24, 16);

/**
 * Gradient sky dome.
 *
 * Rendered on the inside of a sphere that rides with the camera, so it never clips and
 * never needs to be large enough to contain the world. Its horizon colour matches the
 * scene fog, which is what makes distant terrain appear to dissolve into the sky rather
 * than fade to an unrelated grey.
 */
export class Sky {
  private readonly mesh: Mesh;

  constructor(scene: Scene) {
    const material = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color(tuning.world.skyTop) },
        horizonColor: { value: new Color(tuning.world.skyHorizon) },
      },
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new Mesh(geometry, material);
    this.mesh.scale.setScalar(tuning.camera.far * 0.5);
    this.mesh.frustumCulled = false;
    // Drawn before everything else, with depth writes off, so it acts as a background.
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  /** Keeps the dome centred on the viewer so the gradient stays fixed relative to them. */
  followCamera(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }
}
