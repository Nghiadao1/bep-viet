// ============================================================
// StarRating — Star display (1-3 stars) with bounce animation
// ============================================================

import { drawTextShadow } from '../utils/draw';

export class StarRating {
  x: number;
  y: number;
  size: number;

  private starCount = 0;
  private displayStars = 0;       // how many stars currently visible
  private animating = false;
  private animTimer = 0;
  private bouncePhase: number[] = [0, 0, 0]; // per-star bounce phase (0 = not started, 1 = done)
  private starSpacing: number;

  constructor(x: number, y: number, size: number) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.starSpacing = size * 1.4;
  }

  // ---- Public API ----

  setStars(count: number): void {
    this.starCount = Math.max(0, Math.min(3, Math.round(count)));
    if (!this.animating) {
      this.displayStars = this.starCount;
      this.bouncePhase = [1, 1, 1];
    }
  }

  /** Stars appear one by one with bounce. */
  animateIn(): void {
    this.animating = true;
    this.animTimer = 0;
    this.displayStars = 0;
    this.bouncePhase = [0, 0, 0];
  }

  update(dt: number): void {
    if (!this.animating) return;

    this.animTimer += dt;

    // Stagger: each star starts 0.3s after the previous
    for (let i = 0; i < this.starCount; i++) {
      const starStart = i * 0.3;
      if (this.animTimer >= starStart && this.bouncePhase[i] < 1) {
        const local = (this.animTimer - starStart) / 0.4; // 0.4s per star
        this.bouncePhase[i] = Math.min(1, local);
        if (local >= 0) {
          this.displayStars = Math.max(this.displayStars, i + 1);
        }
      }
    }

    // Check if animation complete
    if (this.bouncePhase.every((p, i) => i >= this.starCount || p >= 1)) {
      this.animating = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const totalW = 3 * this.starSpacing;
    const startX = this.x - totalW / 2 + this.starSpacing / 2;

    for (let i = 0; i < 3; i++) {
      const sx = startX + i * this.starSpacing;
      const isFilled = i < this.displayStars;

      // Bounce scale
      let scale = 1;
      if (this.animating || this.bouncePhase[i] < 1) {
        const t = this.bouncePhase[i];
        // Elastic ease-out bounce
        scale = t < 1
          ? 1 + Math.sin(t * Math.PI) * 0.35 * (1 - t)
          : 1;
        scale *= t; // fade in from 0
      }
      scale = isFilled ? Math.max(0.001, scale) : 1;

      ctx.save();
      ctx.translate(sx, this.y);
      ctx.scale(scale, scale);
      ctx.translate(-sx, -this.y);

      ctx.font = `${this.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isFilled) {
        drawTextShadow(ctx, '★', sx, this.y, '#ffd60a', 'rgba(0,0,0,0.3)', 2);
      } else {
        drawTextShadow(ctx, '☆', sx, this.y, '#aaa', 'rgba(0,0,0,0.1)', 1);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
