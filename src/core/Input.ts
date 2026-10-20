const MOVE_LEFT = ['KeyA', 'ArrowLeft'];
const MOVE_RIGHT = ['KeyD', 'ArrowRight'];
const MOVE_UP = ['KeyW', 'ArrowUp'];
const MOVE_DOWN = ['KeyS', 'ArrowDown'];
const FIRE = ['Space'];
const MISSILE = ['ShiftLeft', 'ShiftRight'];

/** Keys the browser would otherwise use to scroll the page. */
const SWALLOWED = new Set([
  ...MOVE_LEFT,
  ...MOVE_RIGHT,
  ...MOVE_UP,
  ...MOVE_DOWN,
  ...FIRE,
  'Enter',
]);

/**
 * Keyboard and mouse state.
 *
 * Held state is sampled by gameplay every simulation step. Edge-triggered actions (pause,
 * restart, mute) are queued on keydown and drained once per frame by `endFrame`, so a
 * frame that runs several simulation steps cannot fire the same edge action twice.
 */
export class Input {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private pointerDown = false;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (SWALLOWED.has(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) {
      return;
    }
    this.held.add(event.code);
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  /** Dropping focus mid-input would otherwise leave the plane stuck banking. */
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pointerDown = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.pointerDown = true;
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.pointerDown = false;
    }
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private anyHeld(codes: readonly string[]): boolean {
    for (const code of codes) {
      if (this.held.has(code)) {
        return true;
      }
    }
    return false;
  }

  /** -1 for left, +1 for right, 0 for neutral or both. */
  get axisX(): number {
    return (this.anyHeld(MOVE_RIGHT) ? 1 : 0) - (this.anyHeld(MOVE_LEFT) ? 1 : 0);
  }

  /** +1 for climb, -1 for dive. */
  get axisY(): number {
    return (this.anyHeld(MOVE_UP) ? 1 : 0) - (this.anyHeld(MOVE_DOWN) ? 1 : 0);
  }

  get firing(): boolean {
    return this.anyHeld(FIRE) || this.pointerDown;
  }

  get launchingMissile(): boolean {
    return this.anyHeld(MISSILE);
  }

  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  justPressedAny(codes: readonly string[]): boolean {
    for (const code of codes) {
      if (this.pressed.has(code)) {
        return true;
      }
    }
    return false;
  }

  /** Clears one-shot edges. Called once per animation frame. */
  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
  }
}
