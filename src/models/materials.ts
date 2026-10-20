import { MeshStandardMaterial } from 'three';

/**
 * Shared materials. Aircraft are spawned and despawned constantly, so every instance
 * reusing these keeps the material count flat and lets three.js batch state changes.
 */
function panel(color: number, roughness = 0.62, metalness = 0.22): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function glow(color: number, intensity = 1.1): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0,
    flatShading: true,
  });
}

export const materials = {
  player: {
    body: panel(0x4a86d8),
    wing: panel(0x2f5f9e),
    accent: panel(0xffa63c, 0.5, 0.1),
    canopy: new MeshStandardMaterial({
      color: 0xa8ecff,
      roughness: 0.12,
      metalness: 0.55,
      transparent: true,
      opacity: 0.72,
      flatShading: true,
    }),
    exhaust: glow(0x6fdcff, 1.6),
  },
  enemyPlane: {
    body: panel(0xb33a44),
    wing: panel(0x7c2029),
    accent: panel(0x2b1418, 0.8, 0.05),
    exhaust: glow(0xff7a4a, 1.3),
  },
  helicopter: {
    body: panel(0x59653f),
    trim: panel(0x39411f),
    glass: new MeshStandardMaterial({
      color: 0x1d2a2e,
      roughness: 0.2,
      metalness: 0.6,
      flatShading: true,
    }),
    rotor: panel(0x22262b, 0.7, 0.3),
  },
  boss: {
    hull: panel(0x3c4450, 0.55, 0.45),
    plate: panel(0x272d36, 0.7, 0.3),
    accent: panel(0xb3323f, 0.5, 0.2),
    turret: panel(0x555f6d, 0.5, 0.5),
    core: glow(0xff5a44, 1.5),
    exhaust: glow(0xffa24a, 1.4),
  },
  gate: {
    pylon: panel(0xd8dde6, 0.6, 0.2),
    stripe: panel(0x1b1f26, 0.7, 0.1),
    beamOpen: glow(0x64ff9c, 1.5),
    beamClosed: glow(0xff4d5a, 1.4),
  },
} as const;
