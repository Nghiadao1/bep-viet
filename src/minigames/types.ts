// ============================================================
// Minigame Shared Types & Reusable Kitchen Board Frame
// ============================================================

import type { Engine } from '../core/Engine';
import type { CookingStep, Recipe, Rect, Vec2 } from '../types';
import type { CustomerTasteOrder } from '../data/tastes';
import { roundRect, drawTextShadow } from '../utils/draw';

export type MinigameGrade = 'PERFECT' | 'GOOD' | 'OK';

export interface MinigameResult {
  score: number;          // 0..100
  grade: MinigameGrade;
  catSpeaker: 'boss' | 'golden';
  catComment: string;
}

export interface MinigameContext {
  engine: Engine;
  recipe: Recipe;
  step: CookingStep;
  taste: CustomerTasteOrder | null;
}

export interface CookingMinigame {
  readonly title: string;
  readonly instruction: string;
  readonly catSpeaker: 'boss' | 'golden';
  readonly done: boolean;
  readonly result: MinigameResult | null;

  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onDown?(pos: Vec2): void;
  onMove?(pos: Vec2): void;
  onUp?(pos: Vec2): void;
  onClick?(pos: Vec2): void;
}

export const BOARD_RECT: Rect = { x: 140, y: 66, width: 680, height: 416 };

export function gradeFromScore(score: number): MinigameGrade {
  if (score >= 85) return 'PERFECT';
  if (score >= 55) return 'GOOD';
  return 'OK';
}

/**
 * Draw the shared cozy wooden kitchen minigame modal backdrop,
 * header, instruction banner, live Cat mentor portrait + bubble,
 * and completion stamp overlay.
 */
export function renderMinigameFrame(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  opts: {
    title: string;
    instruction: string;
    catSpeaker: 'boss' | 'golden';
    catQuote: string;
    elapsed: number;
    result: MinigameResult | null;
  },
): void {
  const W = 960;
  const H = 540;
  const b = BOARD_RECT;

  ctx.save();

  // Dim backdrop
  ctx.fillStyle = 'rgba(10, 11, 22, 0.72)';
  ctx.fillRect(0, 0, W, H);

  // Outer warm wooden board shadow & frame
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;

  roundRect(ctx, b.x, b.y, b.width, b.height, 20);
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.height);
  bg.addColorStop(0, '#2a2238');
  bg.addColorStop(1, '#1a1728');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowBlur = 0;

  roundRect(ctx, b.x, b.y, b.width, b.height, 20);
  ctx.strokeStyle = '#FCA311';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header strip
  roundRect(ctx, b.x, b.y, b.width, 54, 20);
  ctx.fillStyle = 'rgba(232, 93, 4, 0.25)';
  ctx.fill();
  ctx.fillStyle = '#2a2238';
  ctx.fillRect(b.x + 2, b.y + 42, b.width - 4, 14);
  ctx.strokeStyle = 'rgba(252, 163, 17, 0.35)';
  ctx.beginPath();
  ctx.moveTo(b.x + 12, b.y + 54);
  ctx.lineTo(b.x + b.width - 12, b.y + 54);
  ctx.stroke();

  // Title
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px "Segoe UI", system-ui, sans-serif';
  drawTextShadow(ctx, opts.title, b.x + 20, b.y + 28, '#FCA311');

  // Instruction sub-pill on right of header
  ctx.textAlign = 'right';
  ctx.font = '13.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(opts.instruction, b.x + b.width - 20, b.y + 28);

  // Live Cat Mentor popping up on bottom-left of screen beside the board!
  const catKey = opts.catSpeaker === 'boss' ? 'npc_cat_boss' : 'npc_cat_golden';
  const catName = opts.catSpeaker === 'boss' ? '👑 Vằn Bếp Trưởng' : '🐾 Mèo Vàng';
  const bob = Math.sin(opts.elapsed * 4.5) * 4;

  if (engine.assets.hasImage(catKey)) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    const img = engine.assets.getImage(catKey);
    const dh = 136;
    const dw = (img.width / img.height) * dh;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.drawImage(img, 12, H - dh - 8 + bob, dw, dh);
    ctx.restore();
  }

  // Cat Mentor live reaction bubble at bottom of board
  const stripX = b.x + 16;
  const stripY = b.y + b.height - 46;
  const stripW = b.width - 32;
  roundRect(ctx, stripX, stripY, stripW, 34, 10);
  ctx.fillStyle = 'rgba(15, 16, 30, 0.85)';
  ctx.fill();
  ctx.strokeStyle = opts.catSpeaker === 'boss' ? 'rgba(252,163,17,0.45)' : 'rgba(244,162,97,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = opts.catSpeaker === 'boss' ? '#FCA311' : '#F4A261';
  ctx.fillText(`${catName}:`, stripX + 12, stripY + 17);

  const nameOffset = ctx.measureText(`${catName}: `).width;
  ctx.font = '13.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fffcf5';
  ctx.fillText(opts.catQuote, stripX + 14 + nameOffset, stripY + 17);

  ctx.restore();
}

/** Draw the juicy PERFECT / GOOD / OK stamp when a minigame finishes */
export function renderResultStamp(
  ctx: CanvasRenderingContext2D,
  result: MinigameResult,
  finishTimer: number,
): void {
  const b = BOARD_RECT;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2 - 10;
  const pop = Math.min(1, finishTimer * 5);
  const scale = 0.5 + 0.5 * (1 + Math.sin(pop * Math.PI * 0.65) * 0.15);

  const color =
    result.grade === 'PERFECT' ? '#4CAF50'
    : result.grade === 'GOOD' ? '#FCA311'
    : '#F4A261';
  const label =
    result.grade === 'PERFECT' ? '⭐ HOÀN HẢO!'
    : result.grade === 'GOOD' ? '👍 NGON LÀNH!'
    : '👌 TẠM ỔN!';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  roundRect(ctx, -170, -48, 340, 96, 18);
  ctx.fillStyle = 'rgba(15, 16, 30, 0.94)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
  drawTextShadow(ctx, label, 0, -10, color);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Chất lượng: ${Math.round(result.score)}%`, 0, 26);

  ctx.restore();
}
