// ============================================================
// StoryScene — Visual-Novel Cutscene Scene
// Starring Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { CHAPTER_STORIES, type ChapterStory, type StoryLine } from '../data/stories';

export class StoryScene implements Scene {
  private engine: Engine;
  private chapterId: number;
  private story: ChapterStory;
  private onComplete: () => void;

  private lineIndex = 0;
  private elapsed = 0;
  private lineElapsed = 0;

  private boxRect: Rect = { x: 56, y: 344, width: 848, height: 174 };
  private nextBtn: Rect = { x: 694, y: 458, width: 190, height: 46 };
  private skipBtn: Rect = { x: 836, y: 18, width: 104, height: 38 };

  private removeClick?: () => void;

  constructor(engine: Engine, chapterId: number, onComplete: () => void) {
    this.engine = engine;
    this.chapterId = chapterId;
    this.story = CHAPTER_STORIES[chapterId] ?? CHAPTER_STORIES[1];
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('menu');
    this.engine.audio.playSfx('meow');
    this.lineIndex = 0;
    this.elapsed = 0;
    this.lineElapsed = 0;

    this.removeClick = this.engine.input.onClick((pos) => {
      // Skip cutscene
      if (InputManager.hitTest(pos, this.skipBtn, 8)) {
        this.engine.audio.playSfx('click');
        this.onComplete();
        return;
      }

      const line = this.story.lines[this.lineIndex];
      if (!line) {
        this.onComplete();
        return;
      }

      // First tap finishes typewriter text immediately; second tap advances line
      const shownChars = Math.floor(this.lineElapsed * 55);
      if (shownChars < line.text.length) {
        this.lineElapsed = 20;
        this.engine.audio.playSfx('click');
        return;
      }

      if (this.lineIndex < this.story.lines.length - 1) {
        this.lineIndex++;
        this.lineElapsed = 0;
        this.engine.audio.playSfx('pop');
      } else {
        this.engine.audio.playSfx('click');
        this.onComplete();
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.lineElapsed += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const line: StoryLine = this.story.lines[this.lineIndex] ?? this.story.lines[0];

    // --- Atmospheric chapter background ---
    if (this.engine.assets.hasImage('bg_saigon')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.engine.assets.getImage('bg_saigon'), 0, 0, W, H);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `${this.story.themeColors[0]}dd`);
    grad.addColorStop(1, `${this.story.themeColors[1]}f2`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Floating warm lantern sparkles
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const x = ((i * 67 + this.elapsed * 12) % (W + 40)) - 20;
      const y = 70 + ((i * 43) % 240) + Math.sin(this.elapsed * 2 + i) * 8;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(252, 163, 17, ${0.15 + 0.18 * Math.sin(this.elapsed * 3 + i)})`;
      ctx.fill();
    }
    ctx.restore();

    // --- Chapter title header ---
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText(this.story.locationBadge, W / 2, 28);

    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `${this.story.title} — ${this.story.subtitle}`, W / 2, 62, '#fffcf5');
    ctx.restore();

    // --- Skip button ---
    const sk = this.skipBtn;
    roundRect(ctx, sk.x, sk.y, sk.width, sk.height, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('Bỏ qua ✕', sk.x + sk.width / 2, sk.y + sk.height / 2);

    // --- Cat NPC portraits standing above dialogue box ---
    const bobA = Math.sin(this.elapsed * 3) * 5;
    const bobB = Math.sin(this.elapsed * 3 + 1.5) * 5;
    ctx.imageSmoothingEnabled = true;

    // Left: Vằn Bếp Trưởng (cat_boss)
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const active = line.speaker === 'boss' || line.speaker === 'both';
      const dim = line.speaker === 'golden' || line.speaker === 'narrator';
      ctx.save();
      ctx.globalAlpha = dim ? 0.45 : 1;
      const scale = active ? 1.02 : 0.9;
      const img = this.engine.assets.getImage('npc_cat_boss');
      const drawH = 236 * scale;
      const drawW = (img.width / img.height) * drawH;
      const x = 96;
      const y = this.boxRect.y - drawH + 28 + (active ? bobA : 0);
      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.restore();
    }

    // Right: Mèo Vàng Phụ Bếp (cat_golden)
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const active = line.speaker === 'golden' || line.speaker === 'both';
      const dim = line.speaker === 'boss' || line.speaker === 'narrator';
      // In Chapter 1 line 0-1, Mèo Vàng hasn't arrived yet!
      const hidden = this.chapterId === 1 && this.lineIndex < 2;
      if (!hidden) {
        ctx.save();
        ctx.globalAlpha = dim ? 0.45 : 1;
        const scale = active ? 1.02 : 0.9;
        const img = this.engine.assets.getImage('npc_cat_golden');
        const drawH = 204 * scale;
        const drawW = (img.width / img.height) * drawH;
        const x = W - drawW - 96;
        const y = this.boxRect.y - drawH + 28 + (active ? bobB : 0);
        ctx.drawImage(img, x, y, drawW, drawH);
        ctx.restore();
      }
    }

    // --- Dialogue box ---
    const meta = this.getSpeakerMeta(line.speaker);
    const box = this.boxRect;

    roundRect(ctx, box.x, box.y, box.width, box.height, 18);
    const boxGrad = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
    boxGrad.addColorStop(0, 'rgba(20, 20, 38, 0.96)');
    boxGrad.addColorStop(1, 'rgba(12, 13, 26, 0.98)');
    ctx.fillStyle = boxGrad;
    ctx.fill();
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Speaker badge on top edge
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    const nameW = Math.max(210, ctx.measureText(meta.name).width + 38);
    const nameX =
      line.speaker === 'golden'
        ? box.x + box.width - nameW - 24
        : line.speaker === 'narrator'
          ? (W - nameW) / 2
          : box.x + 24;
    const nameY = box.y - 18;

    roundRect(ctx, nameX, nameY, nameW, 34, 17);
    ctx.fillStyle = meta.color;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextShadow(ctx, meta.name, nameX + nameW / 2, nameY + 17, '#1a1418', 'rgba(255,255,255,0.25)', 1);

    // Typewriter text
    const visibleLen = Math.min(line.text.length, Math.floor(this.lineElapsed * 55));
    const shownText = line.text.slice(0, visibleLen);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = line.speaker === 'narrator'
      ? 'italic 19px "Segoe UI", system-ui, sans-serif'
      : '19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = line.speaker === 'narrator' ? '#fde68a' : '#fffcf5';
    this.wrapText(ctx, shownText, box.x + 28, box.y + 30, box.width - 56, 28);

    // Progress dots (bottom-left of box)
    const dotY = this.nextBtn.y + this.nextBtn.height / 2;
    for (let i = 0; i < this.story.lines.length; i++) {
      ctx.beginPath();
      ctx.arc(box.x + 34 + i * 18, dotY, i === this.lineIndex ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === this.lineIndex ? '#FCA311' : i < this.lineIndex ? '#4CAF50' : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }

    // Next / Finish CTA button
    const isLast = this.lineIndex >= this.story.lines.length - 1;
    const btn = this.nextBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 12);
    ctx.fillStyle = isLast ? '#2a9d8f' : '#E85D04';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      isLast ? 'Vào hành trình! 🍜' : 'Tiếp tục ▶',
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );
  }

  private getSpeakerMeta(speaker: StoryLine['speaker']): { name: string; color: string } {
    switch (speaker) {
      case 'boss':
        return { name: '👑 Vằn Bếp Trưởng', color: '#FCA311' };
      case 'golden':
        return { name: '🐾 Mèo Vàng Phụ Bếp', color: '#F4A261' };
      case 'both':
        return { name: '👑 Vằn Bếp Trưởng & Mèo Vàng', color: '#4CAF50' };
      default:
        return { name: '📖 Dẫn Truyện', color: '#94a3b8' };
    }
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
    if (line.trim()) ctx.fillText(line.trim(), x, cy);
  }
}
