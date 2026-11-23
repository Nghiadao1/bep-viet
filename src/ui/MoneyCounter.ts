// ============================================================
// MoneyCounter — Animated money display with fly-up effect
// ============================================================

import { drawTextShadow } from '../utils/draw';

interface FlyText {
  amount: number;
  y: number;
  opacity: number;
  age: number;
}

export class MoneyCounter {
  x: number;
  y: number;

  private currentAmount = 0;
  private displayAmount = 0;
  private flyTexts: FlyText[] = [];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // ---- Public API ----

  setAmount(n: number): void {
    this.currentAmount = n;
    this.displayAmount = n;
  }

  addAmount(n: number): void {
    this.currentAmount += n;
    // Create fly-up text
    if (n !== 0) {
      this.flyTexts.push({
        amount: n,
        y: 0,
        opacity: 1,
        age: 0,
      });
    }
  }

  update(dt: number): void {
    // Smooth counter roll towards target
    const diff = this.currentAmount - this.displayAmount;
    if (Math.abs(diff) < 1) {
      this.displayAmount = this.currentAmount;
    } else {
      this.displayAmount += diff * Math.min(1, dt * 8);
    }

    // Update fly-up texts
    for (let i = this.flyTexts.length - 1; i >= 0; i--) {
      const ft = this.flyTexts[i];
      ft.age += dt;
      ft.y -= dt * 50; // float up
      ft.opacity = Math.max(0, 1 - ft.age / 1.2); // fade over 1.2s
      if (ft.opacity <= 0) {
        this.flyTexts.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // --- Main display ---
    const formatted = this.formatNumber(Math.round(this.displayAmount));

    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Coin icon
    const iconSize = 24;
    ctx.font = `${iconSize}px system-ui, sans-serif`;
    drawTextShadow(ctx, '🪙', this.x, this.y, '#ffd60a', 'rgba(0,0,0,0.3)', 2);

    // Number
    ctx.font = 'bold 20px system-ui, sans-serif';
    const numX = this.x + iconSize + 6;
    drawTextShadow(ctx, formatted, numX, this.y, '#fff', 'rgba(0,0,0,0.5)', 2);

    // --- Fly-up texts ---
    for (const ft of this.flyTexts) {
      ctx.globalAlpha = ft.opacity;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';

      const sign = ft.amount > 0 ? '+' : '';
      const color = ft.amount > 0 ? '#06d6a0' : '#ef476f';
      const flyY = this.y + ft.y;

      drawTextShadow(
        ctx,
        `${sign}${this.formatNumber(ft.amount)}đ`,
        this.x + 30,
        flyY - 20,
        color,
        'rgba(0,0,0,0.3)',
        1,
      );
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- Helpers ----

  private formatNumber(n: number): string {
    return n.toLocaleString('vi-VN') + 'đ';
  }
}
