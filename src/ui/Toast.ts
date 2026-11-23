// ============================================================
// Toast — Popup notification system (singleton queue)
// ============================================================

import { roundRect, drawTextShadow } from '../utils/draw';

export type ToastType = 'success' | 'warning' | 'info';

interface ToastEntry {
  message: string;
  type: ToastType;
  duration: number;
  age: number;
  slideT: number;    // 0→1 slide-in progress
  opacity: number;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: '#06d6a0', border: '#05b384', text: '#fff' },
  warning: { bg: '#ffd166', border: '#e6b84d', text: '#333' },
  info:    { bg: '#118ab2', border: '#0e7a9e', text: '#fff' },
};

const TOAST_WIDTH = 300;
const TOAST_HEIGHT = 44;
const TOAST_GAP = 8;
const TOAST_TOP_Y = 12;
const CANVAS_CENTER_X = 960 / 2;

/** Active toast queue — module-level singleton. */
const activeToasts: ToastEntry[] = [];

export class Toast {
  // ---- Static API ----

  static show(message: string, type: ToastType = 'info', duration = 2.5): void {
    activeToasts.push({
      message,
      type,
      duration,
      age: 0,
      slideT: 0,
      opacity: 0,
    });
  }

  static updateAll(dt: number): void {
    for (let i = activeToasts.length - 1; i >= 0; i--) {
      const t = activeToasts[i];
      t.age += dt;

      // Slide in
      if (t.slideT < 1) {
        t.slideT = Math.min(1, t.slideT + dt * 6);
      }

      // Opacity: fade in then fade out
      const fadeOutStart = t.duration - 0.4;
      if (t.age < 0.2) {
        t.opacity = Math.min(1, t.age / 0.2);
      } else if (t.age > fadeOutStart) {
        t.opacity = Math.max(0, 1 - (t.age - fadeOutStart) / 0.4);
      } else {
        t.opacity = 1;
      }

      if (t.age >= t.duration) {
        activeToasts.splice(i, 1);
      }
    }
  }

  static renderAll(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (let i = 0; i < activeToasts.length; i++) {
      const t = activeToasts[i];
      const colors = TOAST_COLORS[t.type];

      // Ease-out slide
      const ease = 1 - Math.pow(1 - t.slideT, 3);
      const targetY = TOAST_TOP_Y + i * (TOAST_HEIGHT + TOAST_GAP);
      const drawY = targetY * ease - TOAST_HEIGHT * (1 - ease);
      const drawX = CANVAS_CENTER_X - TOAST_WIDTH / 2;

      ctx.globalAlpha = t.opacity;

      // Background
      const r = TOAST_HEIGHT / 2;
      roundRect(ctx, drawX, drawY, TOAST_WIDTH, TOAST_HEIGHT, r);
      ctx.fillStyle = colors.bg;
      ctx.fill();

      // Border
      roundRect(ctx, drawX, drawY, TOAST_WIDTH, TOAST_HEIGHT, r);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Icon
      let icon = '';
      if (t.type === 'success') icon = '✓';
      else if (t.type === 'warning') icon = '⚠';
      else icon = 'ℹ';

      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const iconX = drawX + 16;
      const textCY = drawY + TOAST_HEIGHT / 2;
      drawTextShadow(ctx, icon, iconX, textCY, colors.text, 'rgba(0,0,0,0.15)', 1);

      // Message
      ctx.font = '14px system-ui, sans-serif';
      drawTextShadow(ctx, t.message, iconX + 24, textCY, colors.text, 'rgba(0,0,0,0.15)', 1);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
