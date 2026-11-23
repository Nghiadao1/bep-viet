// ============================================================
// OrderBubble — Speech bubble showing customer's order
// ============================================================

import { roundRect, drawTextShadow } from '../utils/draw';

export class OrderBubble {
  x: number;
  y: number;

  private items: string[] = [];
  private visible = false;

  // Animation state
  private scaleT = 0;           // 0→1 pop-in
  private flashT = 0;           // 0→1 flash red timer
  private flashActive = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // ---- Public API ----

  setOrder(items: string[]): void {
    this.items = items;
  }

  show(): void {
    this.visible = true;
    this.scaleT = 0;
  }

  hide(): void {
    this.visible = false;
    this.scaleT = 0;
  }

  /** Flash red to indicate patience is low. */
  flash(): void {
    this.flashT = 1;
    this.flashActive = true;
  }

  update(dt: number): void {
    // Pop-in animation
    if (this.visible && this.scaleT < 1) {
      this.scaleT = Math.min(1, this.scaleT + dt * 5);
    }

    // Flash decay
    if (this.flashActive) {
      this.flashT -= dt * 3;
      if (this.flashT <= 0) {
        this.flashT = 0;
        this.flashActive = false;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || this.items.length === 0) return;

    ctx.save();

    // Ease-out bounce scale
    const rawScale = this.scaleT;
    const scale = rawScale < 1
      ? 1 - Math.pow(1 - rawScale, 3) * (1 + 2.5 * (1 - rawScale))
      : 1;

    // Bubble dimensions
    const padding = 10;
    const lineHeight = 22;
    const fontSize = 15;
    const bubbleW = 140;
    const bubbleH = padding * 2 + this.items.length * lineHeight + 4;
    const tailH = 10;
    const r = 10;

    const bx = this.x - bubbleW / 2;
    const by = this.y - bubbleH - tailH;

    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.translate(-this.x, -this.y);

    // Flash tint
    const flashMix = this.flashT * 0.3;
    const bgR = Math.round(255 - flashMix * 0);
    const bgG = Math.round(255 - flashMix * 255);
    const bgB = Math.round(255 - flashMix * 255);
    const bgColor = `rgb(${bgR},${bgG},${bgB})`;

    // --- Bubble body ---
    roundRect(ctx, bx, by, bubbleW, bubbleH, r);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, bx, by, bubbleW, bubbleH, r);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // --- Tail ---
    ctx.beginPath();
    ctx.moveTo(this.x - 8, by + bubbleH - 1);
    ctx.lineTo(this.x, this.y);
    ctx.lineTo(this.x + 8, by + bubbleH - 1);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();

    // --- Items text ---
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < this.items.length; i++) {
      const iy = by + padding + i * lineHeight;
      const textColor = this.flashActive ? '#c1121f' : '#333';
      drawTextShadow(
        ctx,
        `• ${this.items[i]}`,
        bx + padding,
        iy,
        textColor,
        'rgba(0,0,0,0.05)',
        1,
      );
    }

    ctx.restore();
  }
}
