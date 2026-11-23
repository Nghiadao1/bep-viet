// ============================================================
// RecipeBookScene — Browse unlocked recipes
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { formatMoney } from '../utils/math';
import { RECIPES } from '../data/recipes';
import { MenuScene } from './MenuScene';

const RECIPES_PER_PAGE = 5;

export class RecipeBookScene implements Scene {
  private engine: Engine;
  private selectedIndex = 0;
  private page = 0;
  private unlocked: typeof RECIPES = [];

  // Rects
  private recipeListRects: Rect[] = [];
  private backBtn: Rect = { x: 20, y: 16, width: 100, height: 40 };
  private prevBtn: Rect = { x: 30, y: 480, width: 80, height: 36 };
  private nextBtn: Rect = { x: 300, y: 480, width: 80, height: 36 };

  private removeClick?: () => void;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  enter(): void {
    this.engine.input.clear();

    // Get unlocked recipes
    const save = this.engine.save.current;
    this.unlocked = RECIPES.filter(
      (r) => save.unlockedRecipes.includes(r.id),
    );
    // If none unlocked, show all with preview
    if (this.unlocked.length === 0) {
      this.unlocked = RECIPES;
    }

    this.selectedIndex = 0;
    this.page = 0;

    this.removeClick = this.engine.input.onClick((pos) => {
      // Back button
      if (InputManager.hitTest(pos, this.backBtn)) {
        this.engine.scenes.replace(new MenuScene(this.engine));
        return;
      }

      // Pagination
      if (InputManager.hitTest(pos, this.prevBtn) && this.page > 0) {
        this.page--;
        return;
      }
      const totalPages = Math.ceil(this.unlocked.length / RECIPES_PER_PAGE);
      if (InputManager.hitTest(pos, this.nextBtn) && this.page < totalPages - 1) {
        this.page++;
        return;
      }

      // Recipe list
      for (let i = 0; i < this.recipeListRects.length; i++) {
        if (InputManager.hitTest(pos, this.recipeListRects[i])) {
          this.selectedIndex = this.page * RECIPES_PER_PAGE + i;
          return;
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '📖 Sách Công Thức', W / 2, 46, '#FCA311');

    // --- Left panel: recipe list ---
    const listX = 30;
    const listY = 80;
    const listW = 340;
    const itemH = 72;
    const itemGap = 8;

    this.recipeListRects = [];

    const pageStart = this.page * RECIPES_PER_PAGE;
    const pageEnd = Math.min(pageStart + RECIPES_PER_PAGE, this.unlocked.length);

    for (let i = pageStart; i < pageEnd; i++) {
      const r = this.unlocked[i];
      const idx = i - pageStart;
      const y = listY + idx * (itemH + itemGap);
      const rect: Rect = { x: listX, y, width: listW, height: itemH };
      this.recipeListRects.push(rect);

      const isSelected = i === this.selectedIndex;
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);

      // Card
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      if (isSelected) {
        ctx.fillStyle = r.color;
      } else if (hover) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
      }
      ctx.fill();

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Color dot
      ctx.beginPath();
      ctx.arc(rect.x + 24, rect.y + itemH / 2, 10, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();

      // Name
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, r.name, rect.x + 44, rect.y + 24, isSelected ? '#fff' : '#ccc');

      // English name
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
      ctx.fillText(r.nameEn, rect.x + 44, rect.y + 48);

      // Price
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px monospace';
      drawTextShadow(ctx, formatMoney(r.basePrice), rect.x + listW - 16, rect.y + itemH / 2, '#4CAF50');
    }

    // Pagination
    const totalPages = Math.ceil(this.unlocked.length / RECIPES_PER_PAGE);
    if (totalPages > 1) {
      // Prev
      roundRect(ctx, this.prevBtn.x, this.prevBtn.y, this.prevBtn.width, this.prevBtn.height, 6);
      ctx.fillStyle = this.page > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '14px "Segoe UI"';
      ctx.fillStyle = this.page > 0 ? '#fff' : '#555';
      ctx.fillText('← Trước', this.prevBtn.x + this.prevBtn.width / 2, this.prevBtn.y + this.prevBtn.height / 2);

      // Page indicator
      ctx.font = '13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${this.page + 1}/${totalPages}`, 230, this.prevBtn.y + this.prevBtn.height / 2);

      // Next
      roundRect(ctx, this.nextBtn.x, this.nextBtn.y, this.nextBtn.width, this.nextBtn.height, 6);
      ctx.fillStyle = this.page < totalPages - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.font = '14px "Segoe UI"';
      ctx.fillStyle = this.page < totalPages - 1 ? '#fff' : '#555';
      ctx.fillText('Tiếp →', this.nextBtn.x + this.nextBtn.width / 2, this.nextBtn.y + this.nextBtn.height / 2);
    }

    // --- Right panel: recipe details ---
    this.renderDetails(ctx, W, H);

    // --- Back button ---
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

  private renderDetails(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const recipe = this.unlocked[this.selectedIndex];
    if (!recipe) return;

    const detailX = 400;
    const detailY = 80;
    const detailW = W - detailX - 30;
    const detailH = H - detailY - 30;

    // Panel
    roundRect(ctx, detailX, detailY, detailW, detailH, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header with color accent
    roundRect(ctx, detailX, detailY, detailW, 60, 14);
    ctx.fillStyle = recipe.color;
    ctx.fill();

    // Clip bottom corners of header
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(detailX, detailY + 46, detailW, 14);

    // Name
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, recipe.name, detailX + 20, detailY + 24);

    // English name
    ctx.textAlign = 'right';
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(recipe.nameEn, detailX + detailW - 16, detailY + 24);

    // Price
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px monospace';
    drawTextShadow(ctx, `💰 ${formatMoney(recipe.basePrice)}`, detailX + 20, detailY + 86, '#4CAF50');

    // Chapter badge
    ctx.textAlign = 'right';
    ctx.font = '14px "Segoe UI"';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`Chương ${recipe.chapter}`, detailX + detailW - 16, detailY + 86);

    // --- Steps ---
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('Các bước nấu:', detailX + 20, detailY + 120);

    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      const sy = detailY + 148 + i * 36;

      // Step number circle
      ctx.beginPath();
      ctx.arc(detailX + 36, sy, 12, 0, Math.PI * 2);
      ctx.fillStyle = recipe.color;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${i + 1}`, detailX + 36, sy);

      // Step text
      ctx.textAlign = 'left';
      ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ddd';
      ctx.fillText(`${step.action} — ${step.ingredient}`, detailX + 56, sy);

      // Duration
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${(step.duration / 1000).toFixed(1)}s`, detailX + detailW - 16, sy);
    }

    // --- Story ---
    const storyY = detailY + 160 + recipe.steps.length * 36;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('📖 Câu chuyện:', detailX + 20, storyY);

    ctx.font = 'italic 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    this.wrapText(ctx, recipe.story, detailX + 20, storyY + 28, detailW - 40, 20);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;

    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, cy);
        line = word + ' ';
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, cy);
  }
}
