import { tuning } from '../config/tuning';
import type { Boss } from '../entities/Boss';
import type { Player } from '../entities/Player';
import { POWER_UP_COLORS, POWER_UP_LABELS } from '../models/powerUpModel';
import type { PowerUpKind, RunState } from '../types';

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing HUD element: #${id}`);
  }
  return element;
}

/**
 * The heads-up display.
 *
 * Rendered as DOM over the canvas rather than in the scene: text stays crisp at any
 * resolution without a font atlas, and the HUD is only touched when a value actually
 * changes, so it costs nothing on the frames where nothing happened.
 */
export class Hud {
  private readonly root = requireElement('hud');
  private readonly progressFill = requireElement('progress-fill');
  private readonly progressMarker = requireElement('progress-marker');
  private readonly progressCaption = requireElement('progress-caption');
  private readonly scoreValue = requireElement('score-value');
  private readonly killsValue = requireElement('kills-value');
  private readonly healthFill = requireElement('health-fill');
  private readonly shieldRow = requireElement('shield-row');
  private readonly shieldPips = requireElement('shield-pips');
  private readonly weaponTier = requireElement('weapon-tier');
  private readonly missileRow = requireElement('missile-row');
  private readonly effectsRow = requireElement('effects');
  private readonly bossPanel = requireElement('boss-panel');
  private readonly bossFill = requireElement('boss-fill');
  private readonly vignette = requireElement('vignette');
  private readonly toast = requireElement('toast');

  private lastScore = -1;
  private lastKills = -1;
  private lastHealth = -1;
  private lastShield = -1;
  private lastTier = -1;
  private lastMissiles = -1;
  private lastProgress = -1;
  private lastRapidFire = -1;
  private lastBossFraction = -1;
  private bossVisible = false;
  private toastTimer = 0;

  setVisible(visible: boolean): void {
    this.root.classList.toggle('visible', visible);
  }

  update(player: Player, run: RunState, boss: Boss | null, vignetteIntensity: number): void {
    this.updateScore(run);
    this.updateHealth(player);
    this.updateShield(player);
    this.updateArmament(player);
    this.updateEffects(player);
    this.updateProgress(run);
    this.updateBoss(boss);
    this.vignette.style.opacity = vignetteIntensity.toFixed(3);
  }

  private updateScore(run: RunState): void {
    if (run.score !== this.lastScore) {
      this.lastScore = run.score;
      this.scoreValue.textContent = run.score.toLocaleString();
    }
    if (run.kills !== this.lastKills) {
      this.lastKills = run.kills;
      this.killsValue.textContent = `${run.kills} KILL${run.kills === 1 ? '' : 'S'}`;
    }
  }

  private updateHealth(player: Player): void {
    if (player.health === this.lastHealth) {
      return;
    }
    this.lastHealth = player.health;

    const fraction = player.health / tuning.player.maxHealth;
    this.healthFill.style.width = `${Math.max(0, fraction) * 100}%`;
    this.healthFill.classList.toggle('warn', fraction <= 0.55 && fraction > 0.25);
    this.healthFill.classList.toggle('critical', fraction <= 0.25);
  }

  private updateShield(player: Player): void {
    if (player.shield === this.lastShield) {
      return;
    }
    this.lastShield = player.shield;

    this.shieldRow.classList.toggle('empty', player.shield <= 0);
    // Rebuilt rather than diffed: this runs a handful of times per run, not per frame.
    this.shieldPips.replaceChildren();
    for (let i = 0; i < player.shield; i += 1) {
      const pip = document.createElement('div');
      pip.className = 'shield-pip';
      this.shieldPips.appendChild(pip);
    }
  }

  private updateArmament(player: Player): void {
    if (player.weaponTier !== this.lastTier) {
      this.lastTier = player.weaponTier;
      const pips = this.weaponTier.children;
      for (let i = 0; i < pips.length; i += 1) {
        pips[i]?.classList.toggle('on', i < player.weaponTier);
      }
    }

    if (player.missiles !== this.lastMissiles) {
      this.lastMissiles = player.missiles;
      this.missileRow.textContent = `MISSILES ${player.missiles}`;
      this.missileRow.classList.toggle('empty', player.missiles <= 0);
    }
  }

  private updateEffects(player: Player): void {
    const remaining = player.rapidFireRemaining;
    const active = remaining > 0;
    const wasActive = this.lastRapidFire > 0;

    if (active !== wasActive) {
      this.effectsRow.replaceChildren();
      if (active) {
        this.effectsRow.appendChild(
          this.createEffectChip('rapidFire', POWER_UP_LABELS.rapidFire),
        );
      }
    }

    if (active) {
      const fraction = remaining / tuning.powerUps.effects.rapidFireDuration;
      const drain = this.effectsRow.querySelector<HTMLElement>('.drain span');
      if (drain) {
        drain.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
      }
    }

    this.lastRapidFire = remaining;
  }

  private createEffectChip(kind: PowerUpKind, label: string): HTMLElement {
    const chip = document.createElement('div');
    chip.className = 'effect-chip';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = label;

    const drain = document.createElement('div');
    drain.className = 'drain';
    const bar = document.createElement('span');
    bar.style.width = '100%';
    bar.style.background = `#${POWER_UP_COLORS[kind].toString(16).padStart(6, '0')}`;
    drain.appendChild(bar);

    chip.appendChild(name);
    chip.appendChild(drain);
    return chip;
  }

  private updateProgress(run: RunState): void {
    const fraction = Math.max(0, Math.min(1, run.distanceTravelled / run.trackLength));
    // Gate on twentieths of a percent rather than whole percent. At this route length a
    // whole percent is two seconds of flying, which made the bar advance in visible jumps.
    const ticks = Math.round(fraction * 2000);
    if (ticks === this.lastProgress) {
      return;
    }
    this.lastProgress = ticks;

    this.progressFill.style.width = `${fraction * 100}%`;
    this.progressMarker.style.left = `${fraction * 100}%`;
    const kilometres = (run.distanceTravelled / 1000).toFixed(1);
    this.progressCaption.textContent = `SECTOR ${Math.round(fraction * 100)}% \u00b7 ${kilometres} KM`;
  }

  private updateBoss(boss: Boss | null): void {
    const shouldShow = boss !== null && boss.active && boss.alive;
    if (shouldShow !== this.bossVisible) {
      this.bossVisible = shouldShow;
      this.bossPanel.classList.toggle('visible', shouldShow);
    }
    if (!shouldShow || !boss) {
      return;
    }

    const fraction = Math.max(0, boss.healthFraction);
    const rounded = Math.round(fraction * 200);
    if (rounded === this.lastBossFraction) {
      return;
    }
    this.lastBossFraction = rounded;
    this.bossFill.style.width = `${fraction * 100}%`;
  }

  /** Brief centred message, used to name a power the moment it is collected. */
  showToast(message: string, colour: number): void {
    this.toast.textContent = message;
    this.toast.style.color = `#${colour.toString(16).padStart(6, '0')}`;
    this.toast.style.opacity = '1';
    this.toastTimer = 1.4;
  }

  updateToast(dt: number): void {
    if (this.toastTimer <= 0) {
      return;
    }
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) {
      this.toast.style.opacity = '0';
    }
  }

  /** Forces every cached value to redraw, so a new run starts from a clean display. */
  reset(): void {
    this.lastScore = -1;
    this.lastKills = -1;
    this.lastHealth = -1;
    this.lastShield = -1;
    this.lastTier = -1;
    this.lastMissiles = -1;
    this.lastProgress = -1;
    this.lastRapidFire = -1;
    this.lastBossFraction = -1;
    this.bossVisible = false;
    this.toastTimer = 0;
    this.bossPanel.classList.remove('visible');
    this.effectsRow.replaceChildren();
    this.toast.style.opacity = '0';
    this.vignette.style.opacity = '0';
  }
}
