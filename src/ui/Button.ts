// ============================================================
// Button — Reusable Canvas 2D button component
// ============================================================

import { Vec2 } from '../types';
import { roundRect, drawTextShadow } from '../utils/draw';

export interface ButtonOptions {
  color?: string;
  hoverColor?: string;
  textColor?: string;
  fontSize?: number;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export class Button {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;

  private color: string;
  private hoverColor: string;
  private textColor: string;
  private fontSize: number;
  private icon: string | null;
  private disabled: boolean;
  private onClick: (() => void) | null;

  // Animation state
  private hovered = false;
  private hoverT = 0;          // 0→1 hover lerp
  private clickScale = 1;
  private clickVelocity = 0;

  constructor(
    x: number, y: number,
    width: number, height: number,
    text: string,
    options: ButtonOptions = {},
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.text = text;

    this.color = options.color ?? '#e85d04';
    this.hoverColor = options.hoverColor ?? '#f48c06';
    this.textColor = options.textColor ?? '#ffffff';
    this.fontSize = options.fontSize ?? 18;
    this.icon = options.icon ?? null;
    this.disabled = options.disabled ?? false;
    this.onClick = options.onClick ?? null;
  }

  // ---- Public API ----

  setText(s: string): void {
    this.text = s;
  }

  setDisabled(v: boolean): void {
    this.disabled = v;
  }

  /** Returns true if the click was consumed. */
  handleClick(pos: Vec2): boolean {
    if (this.disabled) return false;
    if (
      pos.x >= this.x && pos.x <= this.x + this.width &&
      pos.y >= this.y && pos.y <= this.y + this.height
    ) {
      // Trigger click animation
      this.clickScale = 0.9;
      this.clickVelocity = 0.4;
      this.onClick?.();
      return true;
    }
    return false;
  }

  /** Call on mouse/touch move to update hover state. */
  handleHover(pos: Vec2): void {
    this.hovered =
      !this.disabled &&
      pos.x >= this.x && pos.x <= this.x + this.width &&
      pos.y >= this.y && pos.y <= this.y + this.height;
  }

  update(dt: number): void {
    // Smooth hover transition
    const target = this.hovered ? 1 : 0;
    this.hoverT += (target - this.hoverT) * Math.min(1, dt * 10);

    // Spring-back click animation
    if (this.clickScale !== 1) {
      this.clickScale += this.clickVelocity * dt * 10;
      this.clickVelocity -= (this.clickScale - 1) * dt * 60;
      this.clickVelocity *= 0.85; // damping
      if (Math.abs(this.clickScale - 1) < 0.002 && Math.abs(this.clickVelocity) < 0.002) {
        this.clickScale = 1;
        this.clickVelocity = 0;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply click scale about center
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.clickScale, this.clickScale);
    ctx.translate(-cx, -cy);

    const r = Math.min(this.height / 2, 12);

    // --- Background gradient ---
    const baseColor = this.disabled
      ? '#888'
      : this.lerpColor(this.color, this.hoverColor, this.hoverT);

    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    grad.addColorStop(0, this.lighten(baseColor, 0.15));
    grad.addColorStop(1, baseColor);

    roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle border
    roundRect(ctx, this.x, this.y, this.width, this.height, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- Text ---
    const fSize = this.fontSize;
    ctx.font = `bold ${fSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = cx + (this.icon ? fSize * 0.5 : 0);
    const textY = cy + 1;

    // Icon
    if (this.icon) {
      ctx.font = `${fSize + 2}px system-ui, sans-serif`;
      const iconX = cx - ctx.measureText(this.text).width / 2 - fSize * 0.6;
      drawTextShadow(ctx, this.icon, iconX, textY, this.textColor);
      ctx.font = `bold ${fSize}px system-ui, sans-serif`;
    }

    const tColor = this.disabled ? '#ccc' : this.textColor;
    drawTextShadow(ctx, this.text, this.icon ? textX : cx, textY, tColor);

    ctx.restore();
  }

  // ---- Helpers ----

  private hexToRgb(hex: string): [number, number, number] {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c)))
      .toString(16).padStart(2, '0')).join('');
  }

  private lerpColor(a: string, b: string, t: number): string {
    const ca = this.hexToRgb(a);
    const cb = this.hexToRgb(b);
    return this.rgbToHex(
      ca[0] + (cb[0] - ca[0]) * t,
      ca[1] + (cb[1] - ca[1]) * t,
      ca[2] + (cb[2] - ca[2]) * t,
    );
  }

  private lighten(hex: string, amount: number): string {
    const [r, g, b] = this.hexToRgb(hex);
    return this.rgbToHex(
      r + (255 - r) * amount,
      g + (255 - g) * amount,
      b + (255 - b) * amount,
    );
  }
}
