// ============================================================
// Station — Cooking station entity
// ============================================================

import type { StationType, CookingStep, Rect } from '../types';
import { clamp } from '../utils/math';
import { roundRect, drawProgressBar, drawTextShadow } from '../utils/draw';

/** Color mapping per station type */
const STATION_COLORS: Record<StationType, string> = {
  BROTH:   '#c0392b',
  NOODLE:  '#f39c12',
  MEAT:    '#8e44ad',
  VEGGIE:  '#27ae60',
  SAUCE:   '#e67e22',
  BREAD:   '#d4a574',
  GRILL:   '#e74c3c',
  WOK:     '#2c3e50',
  DRINK:   '#3498db',
  DESSERT: '#e91e63',
};

/** Short icon label per station type */
const STATION_ICONS: Record<StationType, string> = {
  BROTH:   '🍲',
  NOODLE:  '🍜',
  MEAT:    '🥩',
  VEGGIE:  '🥬',
  SAUCE:   '🧂',
  BREAD:   '🍞',
  GRILL:   '🔥',
  WOK:     '🥘',
  DRINK:   '🥤',
  DESSERT: '🍮',
};

export class Station {
  type: StationType;
  x: number;
  y: number;
  width = 80;
  height = 80;
  state: 'idle' | 'cooking' | 'done' = 'idle';
  cookTimer = 0;
  cookDuration = 0;
  currentStep: CookingStep | null = null;
  level = 1; // upgrade level

  constructor(type: StationType, x: number, y: number) {
    this.type = type;
    this.x = x;
    this.y = y;
  }

  /** Start cooking a step at this station. speedMultiplier < 1 means faster. */
  startCooking(step: CookingStep, speedMultiplier = 1): void {
    if (this.state !== 'idle') return;
    this.currentStep = step;
    this.cookDuration = step.duration * speedMultiplier;
    this.cookTimer = 0;
    this.state = 'cooking';
  }

  /** Advance timer by dt (ms). Transitions to 'done' when finished. */
  update(dt: number): void {
    if (this.state !== 'cooking') return;
    this.cookTimer += dt;
    if (this.cookTimer >= this.cookDuration) {
      this.cookTimer = this.cookDuration;
      this.state = 'done';
    }
  }

  /** Render the station onto the canvas. */
  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, width: w, height: h, type, state } = this;

    // --- Glow when done ---
    if (state === 'done') {
      ctx.save();
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 16;
      roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 10);
      ctx.fillStyle = 'rgba(241,196,15,0.25)';
      ctx.fill();
      ctx.restore();
    }

    // --- Station body ---
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = STATION_COLORS[type] ?? '#555';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Icon label ---
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STATION_ICONS[type] ?? '?', x + w / 2, y + h / 2 - 4);

    // --- Type label ---
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    drawTextShadow(ctx, type, x + w / 2, y + h - 4);

    // --- Progress bar while cooking ---
    if (state === 'cooking' && this.cookDuration > 0) {
      const progress = clamp(this.cookTimer / this.cookDuration, 0, 1);
      drawProgressBar(ctx, x + 4, y - 12, w - 8, 8, progress, '#2ecc71');
    }
  }

  /** Whether the station can accept a new cooking step. */
  isAvailable(): boolean {
    return this.state === 'idle';
  }

  /** Collect the finished result and reset to idle. Returns the completed step. */
  collectResult(): CookingStep | null {
    if (this.state !== 'done') return null;
    const step = this.currentStep;
    this.currentStep = null;
    this.cookTimer = 0;
    this.cookDuration = 0;
    this.state = 'idle';
    return step;
  }

  /** Bounding rectangle for hit testing. */
  getRect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
