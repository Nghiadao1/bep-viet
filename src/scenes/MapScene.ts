// ============================================================
// MapScene — Chapter/level selection as a Vietnam map
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { CHAPTERS, getLevelsByChapter } from '../data/levels';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';

type MapView = 'chapters' | 'levels';

export class MapScene implements Scene {
  private engine: Engine;
  private view: MapView = 'chapters';
  private selectedChapter = 0;

  // Click regions
  private chapterRects: Rect[] = [];
  private levelRects: Rect[] = [];
  private backBtn: Rect = { x: 20, y: 16, width: 100, height: 40 };

  private removeClick?: () => void;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  enter(): void {
    this.engine.input.clear();
    this.view = 'chapters';

    this.removeClick = this.engine.input.onClick((pos) => {
      // Back button
      if (this.view === 'levels' && InputManager.hitTest(pos, this.backBtn)) {
        this.view = 'chapters';
        return;
      }

      if (this.view === 'chapters') {
        for (let i = 0; i < this.chapterRects.length; i++) {
          if (InputManager.hitTest(pos, this.chapterRects[i])) {
            this.selectedChapter = i;
            this.view = 'levels';
            return;
          }
        }
        // Back to menu
        if (InputManager.hitTest(pos, this.backBtn)) {
          this.engine.scenes.replace(new MenuScene(this.engine));
          return;
        }
      } else {
        const chapter = CHAPTERS[this.selectedChapter];
        const levels = getLevelsByChapter(chapter.id);
        const save = this.engine.save.current;
        for (let i = 0; i < this.levelRects.length; i++) {
          if (InputManager.hitTest(pos, this.levelRects[i])) {
            const level = levels[i];
            // Check if unlocked (level ID <= currentLevel)
            if (level.id <= save.currentLevel) {
              this.engine.scenes.replace(new GameScene(this.engine, level.id));
            }
            return;
          }
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  update(_dt: number): void {
    // Static scene, no updates needed
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (this.view === 'chapters') {
      this.renderChapters(ctx, W, H);
    } else {
      this.renderLevels(ctx, W, H);
    }

    // Back button
    roundRect(ctx, this.backBtn.x, this.backBtn.y, this.backBtn.width, this.backBtn.height, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '← Quay lại', this.backBtn.x + this.backBtn.width / 2, this.backBtn.y + this.backBtn.height / 2);
  }

  private renderChapters(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const save = this.engine.save.current;

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🗺 Bản đồ Việt Nam', W / 2, 46, '#FCA311');

    // Map layout: 5 chapter boxes arranged vertically (Vietnam is tall)
    const boxW = 200;
    const boxH = 80;
    const startX = W / 2 - boxW / 2;
    const startY = 80;
    const gap = 8;

    // Map background silhouette
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, startX - 30, startY - 10, boxW + 60, 5 * (boxH + gap) + 20, 20);
    ctx.fill();
    ctx.restore();

    this.chapterRects = [];

    for (let i = 0; i < CHAPTERS.length; i++) {
      const ch = CHAPTERS[i];
      const y = startY + i * (boxH + gap);
      const rect: Rect = { x: startX, y, width: boxW, height: boxH };
      this.chapterRects.push(rect);

      // Check if unlocked
      const firstLevel = ch.levels[0];
      const unlocked = firstLevel <= save.currentLevel;

      // Calculate stars
      let earnedStars = 0;
      let totalStars = ch.levels.length * 3;
      for (const lv of ch.levels) {
        earnedStars += save.levelStars[lv] ?? 0;
      }

      // Box
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);

      ctx.save();
      if (!unlocked) {
        ctx.globalAlpha = 0.4;
      }
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.fillStyle = hover && unlocked ? ch.color : this.darken(ch.color, 0.2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Border
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Chapter name
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, `Ch.${ch.id}: ${ch.name}`, rect.x + boxW / 2, rect.y + 28);

      // Stars
      ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = unlocked ? '#FCA311' : '#666';
      ctx.fillText(`⭐ ${earnedStars}/${totalStars}`, rect.x + boxW / 2, rect.y + 54);

      // Lock icon
      if (!unlocked) {
        ctx.font = '28px "Segoe UI"';
        ctx.fillStyle = '#888';
        ctx.fillText('🔒', rect.x + boxW / 2, rect.y + boxH / 2);
      }

      // Region label (right side)
      ctx.textAlign = 'left';
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(ch.region, rect.x + boxW + 16, rect.y + boxH / 2);
    }
  }

  private renderLevels(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const chapter = CHAPTERS[this.selectedChapter];
    const levels = getLevelsByChapter(chapter.id);
    const save = this.engine.save.current;

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `${chapter.name} — ${chapter.region}`, W / 2, 46, chapter.color);

    // Grid of level circles: 5 columns × 2 rows
    const cols = 5;
    const rows = 2;
    const circR = 30;
    const gapX = 100;
    const gapY = 100;
    const gridW = (cols - 1) * gapX;
    const gridH = (rows - 1) * gapY;
    const startX = W / 2 - gridW / 2;
    const startY = H / 2 - gridH / 2 + 20;

    this.levelRects = [];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * gapX;
      const cy = startY + row * gapY;

      const rect: Rect = { x: cx - circR, y: cy - circR, width: circR * 2, height: circR * 2 };
      this.levelRects.push(rect);

      const unlocked = level.id <= save.currentLevel;
      const stars = save.levelStars[level.id] ?? 0;
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, circR, 0, Math.PI * 2);

      if (!unlocked) {
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#555';
      } else {
        ctx.fillStyle = hover ? chapter.color : this.darken(chapter.color, 0.3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      }
      ctx.lineWidth = 2;
      ctx.stroke();

      // Level number
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = unlocked ? 'bold 20px monospace' : '20px monospace';
      ctx.fillStyle = unlocked ? '#fff' : '#666';
      ctx.fillText(`${i + 1}`, cx, cy - 2);

      // Stars below
      if (unlocked) {
        const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        ctx.font = '10px "Segoe UI"';
        ctx.fillStyle = '#FCA311';
        ctx.fillText(starStr, cx, cy + circR + 14);
      } else {
        ctx.font = '16px "Segoe UI"';
        ctx.fillStyle = '#666';
        ctx.fillText('🔒', cx, cy + 4);
      }

      // Connection line to next
      if (i < levels.length - 1) {
        const nextCol = (i + 1) % cols;
        const nextRow = Math.floor((i + 1) / cols);
        const nx = startX + nextCol * gapX;
        const ny = startY + nextRow * gapY;

        ctx.beginPath();
        ctx.moveTo(cx + circR + 4, cy);
        if (nextRow !== row) {
          // Wrap to next row
          ctx.lineTo(cx + circR + 20, cy);
          ctx.lineTo(cx + circR + 20, ny);
          ctx.lineTo(nx - circR - 4, ny);
        } else {
          ctx.lineTo(nx - circR - 4, ny);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Day name for selected level hint
    ctx.textAlign = 'center';
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Chọn một ngày để bắt đầu nấu ăn!', W / 2, H - 40);
  }

  private darken(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - amount))}, ${Math.floor(g * (1 - amount))}, ${Math.floor(b * (1 - amount))})`;
  }
}
