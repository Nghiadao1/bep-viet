// ============================================================
// ProgressBar — Animated Canvas 2D progress bar
// ============================================================

import { roundRect, drawTextShadow } from '../utils/draw';

export interface ProgressBarOptions {
  fgColor?: string;
  bgColor?: string;
  animated?: boolean;
  showLabel?: boolean;
}

export class ProgressBar {
  x: number;
  y: number;
  width: number;
  height: number;

  private fgColor: string;
  private bgColor: string;
  private animated: boolean;
  private showLabel: boolean;

  private targetProgress = 0;
  private displayProgress = 0;
  private shimmerOffset = 0;

  constructor(
    x: number, y: number,
    width: number, height: number,
    options: ProgressBarOptions = {},
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.fgColor = options.fgColor ?? '#4cc9f0';
    this.bgColor = options.bgColor ?? 'rgba(0,0,0,0.3)';
    this.animated = options.animated ?? true;
    this.showLabel = options.showLabel ?? false;
  }

  // ---- Public API ----

  setProgress(value: number): void {
    this.targetProgress = Math.max(0, Math.min(1, value));
    if (!this.animated) {
      this.displayProgress = this.targetProgress;
    }
  }

  setColor(color: string): void {
    this.fgColor = color;
  }

  update(dt: number): void {
    // Smooth lerp towards target
    const diff = this.targetProgress - this.displayProgress;
    if (Math.abs(diff) < 0.001) {
      this.displayProgress = this.targetProgress;
    } else {
      this.displayProgress += diff * Math.min(1, dt * 6);
    }

    // Shimmer animation
    if (this.animated) {
      this.shimmerOffset = (this.shimmerOffset + dt * 120) % (this.width * 2);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const r = this.height / 2;

    // --- Background ---
    roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.fillStyle = this.bgColor;
    ctx.fill();

    // --- Foreground fill ---
    if (this.displayProgress > 0) {
      const fillW = Math.max(this.height, this.width * this.displayProgress);
      roundRect(ctx, this.x, this.y, fillW, this.height, r);
      ctx.fillStyle = this.fgColor;
      ctx.fill();

      // Shimmer overlay
      if (this.animated && this.displayProgress > 0.05) {
        ctx.save();
        roundRect(ctx, this.x, this.y, fillW, this.height, r);
        ctx.clip();

        const shimmerW = this.width * 0.3;
        const sx = this.x - shimmerW + this.shimmerOffset;
        const grad = ctx.createLinearGradient(sx, 0, sx + shimmerW, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, this.y, shimmerW, this.height);
        ctx.restore();
      }
    }

    // --- Border ---
    roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Label ---
    if (this.showLabel) {
      const pct = Math.round(this.displayProgress * 100);
      const fontSize = Math.max(10, this.height - 4);
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawTextShadow(
        ctx,
        `${pct}%`,
        this.x + this.width / 2,
        this.y + this.height / 2 + 1,
      );
    }

    ctx.restore();
  }
}
