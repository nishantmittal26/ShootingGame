import { formatTime } from '../core/mathUtils';
import { screenIdFor, type GameStateKind } from '../core/GameState';
import type { RunState } from '../types';

const SCREEN_IDS = ['screen-title', 'screen-pause', 'screen-gameover', 'screen-victory'] as const;

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing screen element: #${id}`);
  }
  return element;
}

/** Title, pause, game over, and victory overlays, driven entirely by the game state. */
export class Screens {
  private readonly screens = new Map<string, HTMLElement>();
  private readonly overScore = requireElement('over-score');
  private readonly overKills = requireElement('over-kills');
  private readonly overProgress = requireElement('over-progress');
  private readonly winScore = requireElement('win-score');
  private readonly winKills = requireElement('win-kills');
  private readonly winTime = requireElement('win-time');

  private current: string | null = null;

  constructor() {
    for (const id of SCREEN_IDS) {
      this.screens.set(id, requireElement(id));
    }
    requireElement('loading').classList.add('hidden');
  }

  /** Shows the one overlay that matches the state, hiding whichever was up before. */
  show(state: GameStateKind): void {
    const next = screenIdFor(state);
    if (next === this.current) {
      return;
    }

    if (this.current) {
      this.screens.get(this.current)?.classList.remove('visible');
    }
    if (next) {
      this.screens.get(next)?.classList.add('visible');
    }
    this.current = next;
  }

  fillDefeat(run: RunState): void {
    this.overScore.textContent = run.score.toLocaleString();
    this.overKills.textContent = run.kills.toString();
    const percent = Math.round((run.distanceTravelled / run.trackLength) * 100);
    this.overProgress.textContent = `${Math.min(100, percent)}%`;
  }

  fillVictory(run: RunState): void {
    this.winScore.textContent = run.score.toLocaleString();
    this.winKills.textContent = run.kills.toString();
    this.winTime.textContent = formatTime(run.elapsed);
  }
}
