export type GameStateKind = 'menu' | 'playing' | 'paused' | 'gameOver' | 'victory';

export type GameEvent = 'start' | 'pause' | 'resume' | 'die' | 'win' | 'restart';

/**
 * Resolves a state transition, returning the current state unchanged when the event does
 * not apply (pausing from the title screen, dying twice in the same step, and so on).
 *
 * The `never` default means adding a new event to the union fails compilation here until
 * it is handled, rather than silently falling through to "ignore".
 */
export function reduceState(current: GameStateKind, event: GameEvent): GameStateKind {
  switch (event) {
    case 'start':
      return current === 'menu' ? 'playing' : current;
    case 'pause':
      return current === 'playing' ? 'paused' : current;
    case 'resume':
      return current === 'paused' ? 'playing' : current;
    case 'die':
      return current === 'playing' ? 'gameOver' : current;
    case 'win':
      return current === 'playing' ? 'victory' : current;
    case 'restart':
      return 'playing';
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** Whether gameplay should advance. Only true while actually flying. */
export function advancesSimulation(kind: GameStateKind): boolean {
  switch (kind) {
    case 'playing':
      return true;
    case 'menu':
    case 'paused':
    case 'gameOver':
    case 'victory':
      return false;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** Whether the run's HUD should be shown. Kept up during pause so stats stay readable. */
export function showsHud(kind: GameStateKind): boolean {
  switch (kind) {
    case 'playing':
    case 'paused':
      return true;
    case 'menu':
    case 'gameOver':
    case 'victory':
      return false;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/** The overlay screen element for a state, or null while flying. */
export function screenIdFor(kind: GameStateKind): string | null {
  switch (kind) {
    case 'menu':
      return 'screen-title';
    case 'paused':
      return 'screen-pause';
    case 'gameOver':
      return 'screen-gameover';
    case 'victory':
      return 'screen-victory';
    case 'playing':
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
