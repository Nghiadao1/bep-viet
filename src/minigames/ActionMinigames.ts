// ============================================================
// ActionMinigames — Tactile Physical Cooking Minigames:
// 1. FirePumpMinigame  (🔥 Thổi lửa đun nước dùng)
// 2. TimingCutMinigame (⏱️ Căn nhịp cắt bánh phở / trụng bún)
// 3. SliceLineMinigame (🔪 Cầm dao kéo theo đường kẻ thái thịt / xẻ bánh mì)
// 4. GrillFlipMinigame (🔥 Quạt than & lật nướng 2 mặt vàng ươm)
// ============================================================

import type { Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { clamp } from '../utils/math';
import {
  BOARD_RECT,
  gradeFromScore,
  renderMinigameFrame,
  renderResultStamp,
  type CookingMinigame,
  type MinigameContext,
  type MinigameResult,
} from './types';

// ============================================================
// 1. FirePumpMinigame — 🔥 Thổi lửa đun nước dùng (BROTH)
// ============================================================

export class FirePumpMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Chạm liên tục để thổi lửa giữ kim trong vùng xanh!';
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private temp = 28;         // 0..100
  private boilProgress = 0;  // 0..1 (fill in ~2.2s inside sweet spot)
  private overheatPenalty = 0;
  private holding = false;
  private flameBurst = 0;
  private catQuote = 'Chạm nút THỔI LỬA liên tục để nước sôi chuẩn vị nào!';

  private pumpBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `🔥 ${ctx.step.action} — ${ctx.recipe.name}`;
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.holding = true;
      this.temp = clamp(this.temp + 15, 0, 100);
      this.flameBurst = 0.25;
      const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
      this.ctx.particles.emitFireSparks(cx, 286, 10);
      this.ctx.particles.emitSteam(cx, 174, 2);
    }
  }

  onUp(): void {
    this.holding = false;
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.flameBurst > 0) this.flameBurst = Math.max(0, this.flameBurst - dt);

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    // Holding gently pumps fire; releasing cools pot down
    if (this.holding) {
      this.temp = clamp(this.temp + 42 * dt, 0, 100);
      if (Math.random() < dt * 18) {
        this.ctx.particles.emitFireSparks(BOARD_RECT.x + BOARD_RECT.width / 2, 286, 2);
      }
    } else {
      this.temp = clamp(this.temp - 24 * dt, 0, 100);
    }

    // Sweet spot: 50..82 (snappy 1.55s boil!)
    if (this.temp >= 50 && this.temp <= 82) {
      this.boilProgress = Math.min(1, this.boilProgress + dt / 1.55);
      if (Math.random() < dt * 10) {
        this.ctx.particles.emitSteam(BOARD_RECT.x + BOARD_RECT.width / 2, 174, 1);
      }
      this.catQuote = 'Sôi sùng sục rồi! Giữ đều ngọn lửa trong vùng xanh nhé! 🔥';
    } else if (this.temp > 82) {
      this.boilProgress = Math.min(1, this.boilProgress + dt / 2.8);
      this.overheatPenalty = Math.min(35, this.overheatPenalty + 22 * dt);
      if (Math.random() < dt * 14) {
        this.ctx.particles.emitSteam(BOARD_RECT.x + BOARD_RECT.width / 2, 165, 2);
      }
      this.catQuote = 'Á trào nước dùng rồi!! Nhả tay ra bớt lửa mau! 🙀';
    } else {
      this.catQuote = 'Lửa nhỏ quá! Bấm THỔI LỬA nhanh hơn nữa lên nào! 💨';
    }

    if (this.boilProgress >= 1) {
      const score = clamp(Math.round(100 - this.overheatPenalty), 50, 100);
      const grade = gradeFromScore(score);
      this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 230, grade === 'PERFECT' ? '#4CAF50' : '#FCA311', 22);
      this.result = {
        score,
        grade,
        catSpeaker: 'boss',
        catComment:
          grade === 'PERFECT'
            ? 'Nước dùng trong veo, ngọt thanh đúng chuẩn Vằn Bếp Trưởng! ⭐'
            : 'Nước dùng hơi sôi mạnh chút nhưng vẫn thơm lắm! Meow~',
      };
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;

    // Animated roaring fire beneath pot
    const flameScale = 0.5 + (this.temp / 100) * 1.1 + this.flameBurst * 0.9;
    ctx.save();
    for (let i = -2; i <= 2; i++) {
      const fx = cx + i * 26;
      const fh = (24 + Math.sin(this.elapsed * 18 + i) * 7) * flameScale;
      ctx.beginPath();
      ctx.ellipse(fx, 296 - fh * 0.3, 14, fh * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.temp > 80 ? '#ef233c' : '#f48c06';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fx, 298 - fh * 0.2, 7, fh * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffba08';
      ctx.fill();
    }

    // Stockpot sprite with subtle boiling wobble
    const wobble = this.temp >= 52 ? Math.sin(this.elapsed * 28) * (this.temp > 80 ? 3.5 : 1.5) : 0;
    if (this.ctx.engine.assets.hasImage('station_broth')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.ctx.engine.assets.getImage('station_broth'), cx - 64 + wobble, 154, 128, 128);
    }

    // Boiling steam bubbles rising when hot
    if (this.temp > 45) {
      for (let i = 0; i < 6; i++) {
        const t = (this.elapsed * (1.2 + this.temp / 100) + i * 0.45) % 1;
        const bx = cx - 34 + (i * 14) + Math.sin(t * 6 + i) * 6;
        const by = 180 - t * 44;
        ctx.beginPath();
        ctx.arc(bx, by, 4 + t * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - t) * 0.55})`;
        ctx.fill();
      }
    }

    // Temperature horizontal bar with green sweet spot (52%..80%)
    const barX = b.x + 70;
    const barY = 308;
    const barW = b.width - 140;
    const barH = 22;

    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.fillStyle = '#1f2937';
    ctx.fill();

    // Cold zone (0..52), Sweet boiling zone (52..80), Overheat zone (80..100)
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.clip();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.fillRect(barX, barY, barW * 0.52, barH);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.85)';
    ctx.fillRect(barX + barW * 0.52, barY, barW * 0.28, barH);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    ctx.fillRect(barX + barW * 0.8, barY, barW * 0.2, barH);
    ctx.restore();

    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Moving temperature needle
    const needleX = barX + (this.temp / 100) * barW;
    ctx.beginPath();
    ctx.moveTo(needleX, barY - 6);
    ctx.lineTo(needleX - 8, barY - 16);
    ctx.lineTo(needleX + 8, barY - 16);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillRect(needleX - 2, barY, 4, barH);

    // Boil progress bar above pump button
    drawProgressBar(ctx, barX + 60, 342, barW - 120, 14, this.boilProgress, '#FCA311');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`ĐỘ SÔI: ${Math.round(this.boilProgress * 100)}%`, cx, 349);

    // Big touch-friendly THỔI LỬA button
    const btn = this.pumpBtn;
    const pressedScale = this.holding || this.flameBurst > 0.1 ? 0.96 : 1;
    ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
    ctx.scale(pressedScale, pressedScale);
    roundRect(ctx, -btn.width / 2, -btn.height / 2, btn.width, btn.height, 14);
    ctx.fillStyle = this.holding ? '#f48c06' : '#e85d04';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '💨 THỔI LỬA! (Chạm / Giữ)', 0, 0, '#fff');
    ctx.restore();

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 2. TimingCutMinigame — ⏱️ Căn nhịp cắt bánh phở / trụng bún (NOODLE)
// ============================================================

export class TimingCutMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Bấm đúng lúc kim đi vào vùng vàng (3 lần)!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private cursor = 0;         // 0..1 oscillating
  private dir = 1;
  private speed = 1.15;
  private hits: number[] = []; // scores 0..100 for 3 cuts
  private popups: Array<{ text: string; color: string; y: number; alpha: number }> = [];
  private catQuote = 'Canh kim chạy vô giữa vùng vàng rồi bấm CẮT ngay nha!';

  private cutBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `⏱️ ${ctx.step.action} — ${ctx.recipe.name}`;
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.performCut();
    }
  }

  private performCut(): void {
    const dist = Math.abs(this.cursor - 0.5);
    let hitScore: number;
    let label: string;
    let color: string;

    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    if (dist <= 0.095) {
      hitScore = 100;
      label = '⭐ HOÀN HẢO!';
      color = '#4CAF50';
      this.ctx.particles.emitStarburst(cx, 205, '#ffd166', 14);
      this.catQuote = 'Nhát cắt chuẩn như máy luôn!! Tiếp nào anh/chị ơi! ✨';
    } else if (dist <= 0.2) {
      hitScore = 78;
      label = '👍 CHUẨN RỒI!';
      color = '#FCA311';
      this.ctx.particles.emitSliceSparks(cx, 205, '#fff3b0', 10);
      this.catQuote = 'Ngon lành! Cố canh sát tâm vàng hơn chút nữa nhé!';
    } else {
      hitScore = 45;
      label = '😅 HƠI LỆCH!';
      color = '#E63946';
      this.ctx.particles.shake(4, 0.14);
      this.catQuote = 'Ối sợi phở hơi to xíu! Bình tĩnh canh nhịp lại nha~';
    }

    this.hits.push(hitScore);
    this.popups.push({ text: label, color, y: 245, alpha: 1 });
    this.speed += 0.16;

    if (this.hits.length >= 3) {
      const avg = Math.round(this.hits.reduce((a, b) => a + b, 0) / this.hits.length);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(cx, 220, '#4CAF50', 22);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'golden',
        catComment:
          grade === 'PERFECT'
            ? 'Sợi phở đều tăm tắp mềm mướt luôn! Thơm xỉu! 🍜'
            : 'Xong phần bánh phở rồi, sang bước tiếp theo nào!',
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].y -= 42 * dt;
      this.popups[i].alpha -= 1.4 * dt;
      if (this.popups[i].alpha <= 0) this.popups.splice(i, 1);
    }

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    this.cursor += this.dir * this.speed * dt;
    if (this.cursor >= 1) {
      this.cursor = 1;
      this.dir = -1;
    } else if (this.cursor <= 0) {
      this.cursor = 0;
      this.dir = 1;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;

    // Cutting board with fresh white rice noodle sheet being sliced into ribbons!
    roundRect(ctx, cx - 170, 146, 340, 118, 16);
    ctx.fillStyle = '#8c5a2b';
    ctx.fill();
    roundRect(ctx, cx - 160, 154, 320, 102, 12);
    ctx.fillStyle = '#c89b6e';
    ctx.fill();

    // White flat bánh phở sheet + sliced strands based on hits count
    const sheetX = cx - 125;
    const sheetY = 172;
    const sheetW = 250;
    const sheetH = 66;
    roundRect(ctx, sheetX, sheetY, sheetW, sheetH, 8);
    ctx.fillStyle = '#fffcf2';
    ctx.fill();
    ctx.strokeStyle = '#d8cfc0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Visible cut lines for each completed cut
    const cutCount = this.hits.length;
    ctx.strokeStyle = '#b07d4f';
    ctx.lineWidth = 2;
    for (let i = 1; i <= cutCount * 4; i++) {
      const lx = sheetX + (i / 13) * sheetW;
      ctx.beginPath();
      ctx.moveTo(lx, sheetY + 2);
      ctx.lineTo(lx, sheetY + sheetH - 2);
      ctx.stroke();
    }

    // Cut counter badges (3 dots)
    for (let i = 0; i < 3; i++) {
      const dx = cx - 44 + i * 44;
      ctx.beginPath();
      ctx.arc(dx, 134, 12, 0, Math.PI * 2);
      ctx.fillStyle = i < this.hits.length
        ? (this.hits[i] >= 85 ? '#4CAF50' : '#FCA311')
        : 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(i < this.hits.length ? '✓' : `${i + 1}`, dx, 134);
    }

    // Rhythm Timing Track
    const barX = b.x + 66;
    const barY = 294;
    const barW = b.width - 132;
    const barH = 38;

    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Good zone (0.31..0.69) and Perfect gold zone (0.415..0.585)
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(252, 163, 17, 0.35)';
    ctx.fillRect(barX + barW * 0.31, barY, barW * 0.38, barH);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(barX + barW * 0.415, barY, barW * 0.17, barH);
    ctx.restore();

    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Moving knife cursor
    const kx = barX + this.cursor * barW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(kx - 3, barY - 6, 6, barH + 12);
    ctx.textAlign = 'center';
    ctx.font = '22px "Segoe UI"';
    ctx.fillText('🔪', kx, barY - 18);

    // Floating hit popups
    for (const p of this.popups) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, p.text, cx, p.y, p.color);
      ctx.restore();
    }

    // Touch button
    const btn = this.cutBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = '#2a9d8f';
    ctx.fill();
    ctx.strokeStyle = '#a8dadc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🔪 CẮT NGAY!', btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 3. SliceLineMinigame — 🔪 Cầm dao cắt theo đường kẻ (MEAT & BREAD)
// Drag/swipe from green start dot along dotted guide line to red end dot!
// ============================================================

interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  completed: boolean;
  score: number;
}

export class SliceLineMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction: string;
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private isBread: boolean;
  private elapsed = 0;
  private finishTimer = 0;

  private lines: GuideLine[] = [];
  private activeLineIdx = 0;
  private dragging = false;
  private trail: Vec2[] = [];
  private maxDeviation = 0;
  private startedNearStart = false;
  private catQuote: string;

  constructor(ctx: MinigameContext, isBread = false) {
    this.ctx = ctx;
    this.isBread = isBread;
    this.title = isBread
      ? `🥖 Xẻ Ổ Bánh Mì — ${ctx.recipe.name}`
      : `🔪 ${ctx.step.action} — ${ctx.recipe.name}`;
    this.instruction = isBread
      ? 'Kéo dao từ chấm xanh sang đỏ để xẻ đôi ổ bánh mì!'
      : 'Kéo dao dọc theo 3 đường kẻ để thái lát thịt đều!';
    this.catQuote = isBread
      ? 'Cầm dao xẻ dọc thân bánh mì thật gọn gàng để kẹp nhân nhé!'
      : 'Kéo dao dứt khoát từ chấm xanh 🟢 tới chấm đỏ 🔴 theo đúng đường kẻ!';

    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    if (isBread) {
      // 2 satisfying cuts on golden crispy baguette: long lengthwise slit + score cut
      this.lines = [
        { x1: cx - 155, y1: 266, x2: cx + 155, y2: 266, completed: false, score: 0 },
        { x1: cx - 75, y1: 215, x2: cx + 75, y2: 315, completed: false, score: 0 },
      ];
    } else {
      // 3 clean vertical/angled butcher slices across meat slab
      this.lines = [
        { x1: cx - 95, y1: 175, x2: cx - 75, y2: 355, completed: false, score: 0 },
        { x1: cx - 10, y1: 175, x2: cx + 10, y2: 355, completed: false, score: 0 },
        { x1: cx + 75, y1: 175, x2: cx + 95, y2: 355, completed: false, score: 0 },
      ];
    }
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    const guide = this.lines[this.activeLineIdx];
    if (!guide) return;

    this.dragging = true;
    this.trail = [pos];
    this.maxDeviation = 0;

    // Allow starting from either endpoint for left/right-handed comfort!
    const dStart = Math.hypot(pos.x - guide.x1, pos.y - guide.y1);
    const dEnd = Math.hypot(pos.x - guide.x2, pos.y - guide.y2);
    this.startedNearStart = dStart < 62 || dEnd < 62;
  }

  onMove(pos: Vec2): void {
    if (!this.dragging || this.result) return;
    const guide = this.lines[this.activeLineIdx];
    if (!guide) return;

    this.trail.push(pos);
    if (this.trail.length > 40) this.trail.shift();

    // Spray gleaming blade & crumb/meat particles along swipe trail!
    if (Math.random() < 0.45) {
      this.ctx.particles.emitSliceSparks(pos.x, pos.y, this.isBread ? '#f4be6b' : '#f28482', 2);
    }

    const dev = this.pointToSegmentDist(pos, guide);
    if (dev > this.maxDeviation) this.maxDeviation = dev;

    // Check if player sliced across at least 72% of the guide length!
    const startPt = this.trail[0];
    const dragSpan = Math.hypot(pos.x - startPt.x, pos.y - startPt.y);
    const guideLen = Math.hypot(guide.x2 - guide.x1, guide.y2 - guide.y1);
    const nearEnd =
      Math.hypot(pos.x - guide.x2, pos.y - guide.y2) < 55 ||
      Math.hypot(pos.x - guide.x1, pos.y - guide.y1) < 55;

    if (this.startedNearStart && dragSpan >= guideLen * 0.72 && nearEnd) {
      this.completeActiveLine();
    }
  }

  onUp(pos: Vec2): void {
    if (!this.dragging || this.result) return;
    this.dragging = false;

    const guide = this.lines[this.activeLineIdx];
    if (!guide || this.trail.length < 2) {
      this.trail = [];
      return;
    }

    const startPt = this.trail[0];
    const dragSpan = Math.hypot(pos.x - startPt.x, pos.y - startPt.y);
    const guideLen = Math.hypot(guide.x2 - guide.x1, guide.y2 - guide.y1);

    if (dragSpan >= guideLen * 0.58) {
      this.completeActiveLine();
    } else {
      this.catQuote = 'Kéo dài hết đường kẻ từ chấm xanh sang chấm đỏ nhé! 🔪';
      this.trail = [];
    }
  }

  private completeActiveLine(): void {
    const guide = this.lines[this.activeLineIdx];
    if (!guide) return;

    // Accuracy scoring based on deviation from dotted line
    const accuracyScore =
      this.maxDeviation <= 22 ? 100
      : this.maxDeviation <= 40 ? 82
      : 60;

    guide.completed = true;
    guide.score = accuracyScore;
    this.dragging = false;
    this.trail = [];
    this.activeLineIdx++;

    const midX = (guide.x1 + guide.x2) / 2;
    const midY = (guide.y1 + guide.y2) / 2;
    this.ctx.particles.emitSliceSparks(midX, midY, this.isBread ? '#ffd166' : '#ff758f', 14);
    if (accuracyScore >= 85) {
      this.ctx.particles.emitStarburst(midX, midY, '#ffd166', 10);
      this.catQuote = this.isBread
        ? 'Xẻ ngọt lịm giòn rụm luôn! Đúng chuẩn bánh mì Sài Gòn! ⭐'
        : 'Nhát dao điêu luyện! Miếng thịt mỏng đều đẹp mắt! ⭐';
    } else {
      this.catQuote = 'Khá ổn! Cố đi sát đường kẻ vàng ở nhát tiếp theo nhé!';
    }

    if (this.activeLineIdx >= this.lines.length) {
      const avg = Math.round(this.lines.reduce((s, l) => s + l.score, 0) / this.lines.length);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 260, '#4CAF50', 22);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'boss',
        catComment:
          grade === 'PERFECT'
            ? (this.isBread ? 'Ổ bánh mì xẻ đôi quá hoàn hảo! Meow~ 🥖' : 'Thịt thái mỏng tang đẳng cấp bếp trưởng! 🥩')
            : 'Cắt xong rồi, nhanh tay sang trạm tiếp theo nào!',
      };
    }
  }

  private pointToSegmentDist(p: Vec2, g: GuideLine): number {
    const vx = g.x2 - g.x1;
    const vy = g.y2 - g.y1;
    const lenSq = vx * vx + vy * vy || 1;
    const t = clamp(((p.x - g.x1) * vx + (p.y - g.y1) * vy) / lenSq, 0, 1);
    const px = g.x1 + t * vx;
    const py = g.y1 + t * vy;
    return Math.hypot(p.x - px, p.y - py);
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;
    const cy = 266;

    // Warm rustic wooden chopping board
    ctx.save();
    roundRect(ctx, cx - 230, 146, 460, 240, 26);
    ctx.fillStyle = '#6f4518';
    ctx.fill();
    roundRect(ctx, cx - 220, 154, 440, 224, 22);
    ctx.fillStyle = '#b07d4f';
    ctx.fill();
    roundRect(ctx, cx - 208, 164, 416, 204, 18);
    ctx.fillStyle = '#d4a373';
    ctx.fill();

    // Draw the Meat Slab or Golden Crispy Baguette!
    if (this.isBread) {
      // Golden crusty Vietnamese Bánh Mì baguette
      ctx.beginPath();
      ctx.ellipse(cx, cy, 175, 62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b5651d';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy - 4, 168, 54, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e09f3e';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy - 12, 145, 30, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f4be6b';
      ctx.fill();
    } else {
      // Marbled fresh Vietnamese beef/pork slab
      roundRect(ctx, cx - 150, cy - 68, 300, 136, 42);
      ctx.fillStyle = '#8d2424';
      ctx.fill();
      roundRect(ctx, cx - 140, cy - 58, 280, 116, 36);
      ctx.fillStyle = '#b83232';
      ctx.fill();
      // Delicious marbling streaks
      ctx.strokeStyle = 'rgba(255, 225, 215, 0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 110, cy - 22);
      ctx.quadraticCurveTo(cx - 30, cy - 5, cx + 100, cy - 30);
      ctx.moveTo(cx - 90, cy + 24);
      ctx.quadraticCurveTo(cx + 15, cy + 8, cx + 115, cy + 28);
      ctx.stroke();
    }

    // Completed slice seams
    for (const l of this.lines) {
      if (!l.completed) continue;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.strokeStyle = this.isBread ? '#fff3d6' : '#3a0d0d';
      ctx.lineWidth = this.isBread ? 7 : 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Active dotted cut guide + pulsing start/end markers + animated demo knife
    const active = this.lines[this.activeLineIdx];
    if (active) {
      ctx.beginPath();
      ctx.moveTo(active.x1, active.y1);
      ctx.lineTo(active.x2, active.y2);
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -this.elapsed * 24;
      ctx.stroke();
      ctx.setLineDash([]);

      // Green start dot
      const pulse = 14 + Math.sin(this.elapsed * 8) * 3;
      ctx.beginPath();
      ctx.arc(active.x1, active.y1, pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#4CAF50';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Red end target dot
      ctx.beginPath();
      ctx.arc(active.x2, active.y2, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#E63946';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Animated guiding knife gliding along line when not dragging
      if (!this.dragging) {
        const t = (this.elapsed * 0.9) % 1;
        const gx = active.x1 + (active.x2 - active.x1) * t;
        const gy = active.y1 + (active.y2 - active.y1) * t;
        ctx.font = '26px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔪', gx, gy - 14);
      }
    }

    // Gleaming player knife swipe trail
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#90e0ef';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const tip = this.trail[this.trail.length - 1];
      ctx.font = '28px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔪', tip.x, tip.y - 12);
    }

    ctx.restore();

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 4. GrillFlipMinigame — 🔥 Nướng bếp than & lật 2 mặt vàng ươm (GRILL)
// ============================================================

export class GrillFlipMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Chờ chín vàng vào vùng xanh rồi bấm LẬT MẶT (2 mặt)!';
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private side = 1;            // 1 or 2
  private cook = 0;            // 0..1 (sweet spot 0.62..0.86)
  private sideScores: number[] = [];
  private flipAnim = 0;        // jump animation when flipping
  private catQuote = 'Nghe tiếng xèo xèo chưa? Canh kim vào vùng vàng ươm rồi lật nha!';

  private flipBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `🔥 ${ctx.step.action} — ${ctx.recipe.name}`;
  }

  onDown(pos: Vec2): void {
    if (this.result || this.flipAnim > 0) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.flipOrFinish();
    }
  }

  private flipOrFinish(): void {
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    let sScore: number;
    if (this.cook >= 0.6 && this.cook <= 0.88) {
      sScore = 100;
      this.ctx.particles.emitStarburst(cx, 224, '#ffd166', 16);
      this.ctx.particles.emitFireSparks(cx, 232, 14);
      this.catQuote = 'Vàng ươm thơm nức cả khu phố!! Đúng chuẩn bếp than hoa! ⭐';
    } else if (this.cook >= 0.44 && this.cook <= 0.94) {
      sScore = 74;
      this.ctx.particles.emitFireSparks(cx, 232, 10);
      this.catQuote = this.cook < 0.6 ? 'Hơi non chút xíu nhưng vẫn ngon!' : 'Suýt cháy cạnh rồi đó nha! 😅';
    } else {
      sScore = 40;
      this.ctx.particles.emitAngryPuff(cx, 224);
      this.ctx.particles.shake(5, 0.2);
      this.catQuote = this.cook < 0.44 ? 'Còn sống nhăn à! Chờ chín thêm chút nữa!' : 'Á cháy đen thui rồi!! 🙀';
    }

    this.sideScores.push(sScore);

    if (this.side === 1) {
      this.side = 2;
      this.cook = 0;
      this.flipAnim = 0.3;
    } else {
      const avg = Math.round((this.sideScores[0] + this.sideScores[1]) / 2);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(cx, 224, '#4CAF50', 22);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'boss',
        catComment:
          grade === 'PERFECT'
            ? 'Nướng vàng ruộm 2 mặt, Mèo Vàng nhìn chảy nước miếng kìa! 🔥'
            : 'Nướng xong 2 mặt rồi, bày ra đĩa thôi nào!',
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.flipAnim > 0) {
      this.flipAnim = Math.max(0, this.flipAnim - dt);
      return;
    }

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    // Continuous sizzling sparks & smoke from charcoal
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    if (Math.random() < dt * 8) {
      this.ctx.particles.emitSteam(cx, 212, 1);
    }
    if (Math.random() < dt * 6) {
      this.ctx.particles.emitFireSparks(cx, 240, 1);
    }

    this.cook += 0.56 * dt;
    if (this.cook >= 1) {
      this.cook = 1;
      this.flipOrFinish(); // auto-burn if never flipped
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;

    // Charcoal bed with glowing coals
    roundRect(ctx, cx - 190, 166, 380, 120, 18);
    ctx.fillStyle = '#2b2d42';
    ctx.fill();
    roundRect(ctx, cx - 176, 178, 352, 96, 12);
    ctx.fillStyle = '#9d0208';
    ctx.fill();

    for (let i = 0; i < 14; i++) {
      const ex = cx - 156 + i * 24;
      const glow = 0.5 + 0.5 * Math.sin(this.elapsed * 8 + i * 1.3);
      ctx.beginPath();
      ctx.arc(ex, 226 + (i % 2) * 16 - 8, 9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 186, 8, ${0.35 + glow * 0.5})`;
      ctx.fill();
    }

    // Metal grill bars
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 4;
    for (let x = cx - 165; x <= cx + 165; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 174);
      ctx.lineTo(x, 278);
      ctx.stroke();
    }

    // Sizzling meat/food changing color from pink raw -> golden brown -> burnt!
    const flipJump = this.flipAnim > 0 ? Math.sin((this.flipAnim / 0.35) * Math.PI) * -45 : 0;
    const flipScaleY = this.flipAnim > 0 ? Math.max(0.2, Math.abs(Math.cos((this.flipAnim / 0.35) * Math.PI))) : 1;

    const meatColor =
      this.cook < 0.45 ? '#e07a7a'
      : this.cook < 0.62 ? '#d98a4e'
      : this.cook <= 0.86 ? '#b5561d'
      : '#2c1810';

    ctx.save();
    ctx.translate(cx, 224 + flipJump);
    ctx.scale(1, flipScaleY);
    ctx.beginPath();
    ctx.ellipse(0, 0, 92, 42, 0, 0, Math.PI * 2);
    ctx.fillStyle = meatColor;
    ctx.fill();
    ctx.strokeStyle = '#3d1c0a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Searing grill marks appear as it cooks!
    if (this.cook > 0.45) {
      ctx.strokeStyle = 'rgba(40, 16, 8, 0.65)';
      ctx.lineWidth = 5;
      for (let gx = -52; gx <= 52; gx += 26) {
        ctx.beginPath();
        ctx.moveTo(gx - 8, -24);
        ctx.lineTo(gx + 8, 24);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Side indicator badge
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Mặt ${this.side} / 2`, cx, 146, '#ffd166');

    // Doneness gauge bar (0..1, green sweet spot 0.62..0.86)
    const barX = b.x + 70;
    const barY = 308;
    const barW = b.width - 140;
    const barH = 26;

    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.fillStyle = '#1f2937';
    ctx.fill();

    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.clip();
    ctx.fillStyle = 'rgba(244, 162, 97, 0.35)';
    ctx.fillRect(barX, barY, barW * 0.62, barH);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(barX + barW * 0.62, barY, barW * 0.24, barH);
    ctx.fillStyle = '#E63946';
    ctx.fillRect(barX + barW * 0.86, barY, barW * 0.14, barH);
    ctx.restore();

    roundRect(ctx, barX, barY, barW, barH, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Doneness pointer
    const px = barX + this.cook * barW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 3, barY - 5, 6, barH + 10);

    // Flip / Done button
    const btn = this.flipBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = this.cook >= 0.62 && this.cook <= 0.86 ? '#4CAF50' : '#e85d04';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.side === 1 ? '🔄 LẬT MẶT!' : '✅ LẤY RA ĐĨA!',
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}
