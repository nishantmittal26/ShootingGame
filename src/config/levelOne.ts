import type { EnemyKind, Formation, WaveSpec } from '../types';

/**
 * Route length in world units. At the world scroll speed this is roughly three and a half
 * minutes of flying, with the boss fight on top.
 */
export const trackLength = 14000;

function wave(
  atDistance: number,
  kind: EnemyKind,
  count: number,
  formation: Formation,
  options: { spread?: number; altitude?: number; speed?: number } = {},
): WaveSpec {
  return {
    atDistance,
    kind,
    count,
    formation,
    spread: options.spread ?? 11,
    altitude: options.altitude ?? 12,
    speed: options.speed ?? 1,
  };
}

/**
 * The encounter table, sorted by route distance.
 *
 * The curve has four movements. The opening gives single small plane groups with wide gaps
 * so the player can learn to lead a target. The build introduces helicopters, which hover
 * and must be dealt with rather than outrun. The middle mixes both and tightens the gaps.
 * The final third deliberately overlaps waves so pressure never fully releases before the
 * boss.
 *
 * Difficulty is raised by three levers rather than one: group size, closing speed, and how
 * much the spawn intervals overlap.
 */
export const levelOneWaves: readonly WaveSpec[] = [
  wave(600, 'plane', 2, 'line', { spread: 14 }),
  wave(1100, 'plane', 3, 'vee', { altitude: 13 }),
  wave(1700, 'plane', 3, 'line', { spread: 16, altitude: 10 }),
  wave(2300, 'helicopter', 1, 'single'),
  wave(2800, 'plane', 4, 'vee', { altitude: 14 }),

  wave(3400, 'plane', 3, 'stagger', { altitude: 11, speed: 1.05 }),
  wave(3900, 'helicopter', 2, 'line', { spread: 18, altitude: 13 }),
  wave(4400, 'plane', 4, 'line', { spread: 13, altitude: 16, speed: 1.05 }),
  wave(4900, 'plane', 3, 'column', { altitude: 10 }),
  wave(5300, 'helicopter', 2, 'stagger', { spread: 16, altitude: 15 }),
  wave(5800, 'plane', 5, 'vee', { altitude: 13, speed: 1.1 }),

  wave(6300, 'plane', 4, 'stagger', { altitude: 9, speed: 1.1 }),
  wave(6700, 'helicopter', 3, 'line', { spread: 20, altitude: 14 }),
  wave(7100, 'plane', 4, 'vee', { altitude: 17, speed: 1.1 }),
  wave(7400, 'plane', 3, 'column', { altitude: 12, speed: 1.15 }),
  wave(7900, 'helicopter', 2, 'vee', { spread: 14, altitude: 11 }),
  wave(8300, 'plane', 5, 'line', { spread: 15, altitude: 15, speed: 1.15 }),
  wave(8700, 'plane', 4, 'stagger', { altitude: 20, speed: 1.15 }),
  wave(9100, 'helicopter', 3, 'stagger', { spread: 18, altitude: 13 }),

  wave(9500, 'plane', 5, 'vee', { altitude: 12, speed: 1.2 }),
  wave(9700, 'helicopter', 2, 'line', { spread: 22, altitude: 18 }),
  wave(10100, 'plane', 4, 'line', { spread: 12, altitude: 9, speed: 1.2 }),
  wave(10300, 'plane', 4, 'column', { altitude: 16, speed: 1.2 }),
  wave(10700, 'helicopter', 3, 'vee', { spread: 16, altitude: 12 }),
  wave(10900, 'plane', 5, 'stagger', { altitude: 19, speed: 1.25 }),
  wave(11300, 'plane', 6, 'line', { spread: 14, altitude: 13, speed: 1.25 }),
  wave(11500, 'helicopter', 2, 'stagger', { spread: 20, altitude: 16 }),
  wave(11900, 'plane', 5, 'vee', { altitude: 10, speed: 1.3 }),
  wave(12100, 'plane', 4, 'stagger', { altitude: 21, speed: 1.3 }),
  wave(12500, 'helicopter', 4, 'line', { spread: 20, altitude: 14 }),
  wave(12700, 'plane', 6, 'vee', { altitude: 15, speed: 1.3 }),
  wave(13100, 'plane', 5, 'stagger', { altitude: 11, speed: 1.35 }),
  wave(13300, 'helicopter', 3, 'vee', { spread: 17, altitude: 18 }),
  wave(13700, 'plane', 6, 'line', { spread: 16, altitude: 13, speed: 1.35 }),
];
