// ============================================================
// Customer — Customer entity
// ============================================================

import { CustomerMood } from '../types';
import type { CustomerConfig, Rect } from '../types';
import { clamp } from '../utils/math';
import { roundRect, drawProgressBar, drawTextShadow } from '../utils/draw';
import type { Dish } from './Dish';

/** Mood emoji lookup */
const MOOD_EMOJI: Record<CustomerMood, string> = {
  HAPPY:   '😊',
  NEUTRAL: '😐',
  ANGRY:   '😡',
};

/** Avatar colors by customer type */
const AVATAR_COLORS: Record<string, string> = {
  OFFICE_WORKER: '#3498db',
  ELDERLY:       '#95a5a6',
  FAMILY:        '#e67e22',
  SHIPPER:       '#2ecc71',
  TOURIST:       '#9b59b6',
  FOOD_BLOGGER:  '#e91e63',
};

export class Customer {
  config: CustomerConfig;
  x: number;
  y: number;
  width = 64;
  height = 64;

  order: string[];          // recipe IDs this customer wants
  patienceTimer = 0;
  maxPatience: number;      // ms
  mood: CustomerMood = CustomerMood.NEUTRAL;
  tips = 0;
  seated = false;
  served = false;

  constructor(config: CustomerConfig, x: number, y: number, order: string[]) {
    this.config = config;
    this.x = x;
    this.y = y;
    this.order = order;
    this.maxPatience = config.patience;
  }

  /** Advance patience timer and update mood. dt in ms. */
  update(dt: number): void {
    if (this.served) return;

    this.patienceTimer += dt;
    const ratio = this.getPatienceRatio();

    if (ratio > 0.6) {
      this.mood = CustomerMood.HAPPY;
    } else if (ratio > 0.25) {
      this.mood = CustomerMood.NEUTRAL;
    } else {
      this.mood = CustomerMood.ANGRY;
    }
  }

  /** Render the customer. */
  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, width: w, height: h, config } = this;

    // --- Avatar rectangle ---
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = AVATAR_COLORS[config.type] ?? '#888';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- Name label ---
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    drawTextShadow(ctx, config.name, x + w / 2, y + h - 2);

    // --- Mood emoji ---
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(MOOD_EMOJI[this.mood] ?? '😐', x + w / 2, y + h / 2 - 6);

    // --- Patience bar above head ---
    if (!this.served) {
      const ratio = clamp(this.getPatienceRatio(), 0, 1);
      let barColor: string;
      if (ratio > 0.6) barColor = '#2ecc71';
      else if (ratio > 0.25) barColor = '#f1c40f';
      else barColor = '#e74c3c';
      drawProgressBar(ctx, x + 4, y - 12, w - 8, 6, ratio, barColor);
    }
  }

  /**
   * Serve a dish to this customer.
   * Returns acceptance result with tips and star rating.
   */
  serve(dish: Dish): { accepted: boolean; tips: number; stars: number } {
    // Check if the dish matches one of the ordered recipes
    const idx = this.order.indexOf(dish.recipe.id);
    if (idx === -1) {
      return { accepted: false, tips: 0, stars: 0 };
    }

    this.order.splice(idx, 1);
    const patienceRatio = this.getPatienceRatio();
    const quality = dish.quality;

    // Stars: 0-3 based on quality and patience
    const avg = (quality + patienceRatio) / 2;
    let stars: number;
    if (avg >= 0.85) stars = 3;
    else if (avg >= 0.6) stars = 2;
    else if (avg >= 0.3) stars = 1;
    else stars = 0;

    // Tips based on quality, patience, and customer multiplier
    const baseTip = dish.recipe.basePrice * 0.2;
    this.tips = Math.round(baseTip * quality * patienceRatio * this.config.tipMultiplier);

    if (this.order.length === 0) {
      this.served = true;
      this.mood = stars >= 2 ? CustomerMood.HAPPY : CustomerMood.NEUTRAL;
    }

    return { accepted: true, tips: this.tips, stars };
  }

  /** Remaining patience as 0 → 1 (1 = fully patient). */
  getPatienceRatio(): number {
    return clamp(1 - this.patienceTimer / this.maxPatience, 0, 1);
  }

  /** Bounding rectangle for hit testing. */
  getRect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
