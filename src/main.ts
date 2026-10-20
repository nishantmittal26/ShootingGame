import {
  ACESFilmicToneMapping,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { tuning } from './config/tuning';
import { Game } from './core/Game';

function showFatalError(message: string): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hidden');
    loading.innerHTML = `<div id="unsupported">${message}</div>`;
  }
}

function boot(): void {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    showFatalError('Could not find the game canvas.');
    return;
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    showFatalError(
      'This game needs WebGL2, which your browser or graphics driver did not provide. Try a recent version of Chrome, Edge, or Firefox with hardware acceleration enabled.',
    );
    return;
  }

  // Capping pixel ratio matters more than it looks: on a high-DPI laptop the uncapped
  // value can quadruple the pixels shaded for no visible gain at this art style.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tuning.sim.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  // Fog colour matches the sky's horizon, which is what lets distant aircraft fade in
  // rather than pop into existence at the draw distance.
  scene.fog = new FogExp2(tuning.world.fogColor, tuning.world.fogDensity);

  const camera = new PerspectiveCamera(
    tuning.camera.fov,
    window.innerWidth / window.innerHeight,
    tuning.camera.near,
    tuning.camera.far,
  );

  const hemisphere = new HemisphereLight(0xdff0ff, 0x4a5a3a, 1.5);
  scene.add(hemisphere);

  const sun = new DirectionalLight(0xfff3e0, 2.1);
  sun.position.set(-70, 110, 60);
  scene.add(sun);

  // A dim fill from the opposite side keeps the underside of aircraft from going black,
  // which matters because the player mostly sees enemies lit from behind.
  const fill = new DirectionalLight(0x9fc4ff, 0.55);
  fill.position.set(60, -30, -40);
  scene.add(fill);

  const game = new Game({ renderer, scene, camera, canvas });

  window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight);
  });

  game.start();
}

boot();
