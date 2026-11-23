// ============================================================
// Dish — A dish being prepared from a Recipe
// ============================================================

import type { Recipe, CookingStep } from '../types';
import { clamp } from '../utils/math';
import { roundRect, drawTextShadow } from '../utils/draw';

/** Thresholds (in ms) for quality degradation. */
const FAST_THRESHOLD_MS = 30_000;    // ≤ 30 s → 100 %
const NORMAL_THRESHOLD_MS = 60_000;  // ≤ 60 s → 70 %

export class Dish {
  recipe: Recipe;
  completedSteps: CookingStep[] = [];
  startTime: number;
  quality = 1; // 0 – 1

  constructor(recipe: Recipe) {
    this.recipe = recipe;
    this.startTime = Date.now();
  }

  /** Append a completed cooking step. */
  addStep(step: CookingStep): void {
    this.completedSteps.push(step);
  }

  /**
   * Check whether `step` can be added next.
   * The step must match the recipe's next expected step by stationType.
   */
  canAddStep(step: CookingStep): boolean {
    const nextIndex = this.completedSteps.length;
    if (nextIndex >= this.recipe.steps.length) return false;
    const expected = this.recipe.steps[nextIndex];
    return expected.stationType === step.stationType;
  }

  /** Whether all required steps have been completed. */
  isComplete(): boolean {
    return this.completedSteps.length >= this.recipe.steps.length;
  }

  /**
   * Calculate quality based on how long the dish has been in preparation.
   * - ≤ 30 s  → 1.0
   * - ≤ 60 s  → 0.7
   * - > 60 s  → 0.4
   */
  calculateQuality(elapsedMs: number): number {
    if (elapsedMs <= FAST_THRESHOLD_MS) return 1.0;
    if (elapsedMs <= NORMAL_THRESHOLD_MS) return 0.7;
    return 0.4;
  }

  /** Render a small dish card at (x, y). */
  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const w = 100;
    const h = 36;

    // Background
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = this.recipe.color || '#555';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Name
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextShadow(ctx, this.recipe.name, x + w / 2, y + 12);

    // Step progress
    const progress = `${this.completedSteps.length}/${this.recipe.steps.length}`;
    ctx.font = '10px sans-serif';
    drawTextShadow(ctx, progress, x + w / 2, y + 26);

    // Quality indicator dot
    const q = clamp(this.quality, 0, 1);
    const dotColor = q >= 0.9 ? '#2ecc71' : q >= 0.6 ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  }
}
