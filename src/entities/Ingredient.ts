// ============================================================
// Ingredient — Clickable ingredient on the bottom shelf
// ============================================================

import type { StationType, Rect } from '../types';
import { roundRect, drawTextShadow } from '../utils/draw';

export class Ingredient {
  id: string;
  name: string;
  spriteKey: string;
  stationType: StationType;
  x: number;
  y: number;
  available = true;

  private readonly width = 56;
  private readonly height = 56;

  constructor(
    id: string,
    name: string,
    spriteKey: string,
    stationType: StationType,
    x: number,
    y: number,
  ) {
    this.id = id;
    this.name = name;
    this.spriteKey = spriteKey;
    this.stationType = stationType;
    this.x = x;
    this.y = y;
  }

  /** Render the ingredient tile. */
  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, width: w, height: h } = this;

    // Background tile
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = this.available ? '#ecf0f1' : '#bdc3c7';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sprite placeholder (emoji based on stationType for now)
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.available ? '#333' : '#999';
    ctx.fillText(this.spriteKey, x + w / 2, y + h / 2 - 4);

    // Name label
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    drawTextShadow(
      ctx,
      this.name,
      x + w / 2,
      y + h - 2,
      this.available ? '#333' : '#999',
      'rgba(255,255,255,0.6)',
    );
  }

  /** Bounding rectangle for hit testing. */
  getRect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
