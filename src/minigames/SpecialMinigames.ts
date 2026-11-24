// ============================================================
// SpecialMinigames — 6 Brand-New Creative Vietnamese Minigames!
//  9. SwirlWhiskMinigame  (🌀 Xoay tròn đánh mắm tôm / pha nước chấm sủi bọt)
// 10. RollWrapMinigame    (🌯 Vuốt 3 bước cuốn Gỏi Cuốn / Phở Cuốn / Bánh Nậm)
// 11. BlanchDipMinigame   (💧 Nhúng giỏ tre trụng phở & nhấc ráo đúng độ mềm)
// 12. SqueezeLimeMinigame (🍋 Vắt chanh / tắc tươi, né rơi hạt vào tô!)
// 13. IceCrushMinigame    (🧊 Đập tảng đá thành đá viên mát lạnh)
// 14. PourTrayMinigame    (🎨 Đổ chén Bánh Bèo & rắc tôm cháy mỡ hành)
// ============================================================

import type { Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { clamp, lerp, randFloat } from '../utils/math';
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
// 9. SwirlWhiskMinigame — 🌀 Xoay tròn đánh mắm tôm / pha nước chấm!
// ============================================================

export class SwirlWhiskMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Xoay tròn quanh chén để đánh nước chấm sủi bọt thơm!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private isMamTom: boolean;
  private elapsed = 0;
  private finishTimer = 0;

  private dragging = false;
  private lastAngle: number | null = null;
  private whiskAngle = 0;
  private foam = 0; // 0..1
  private targetTurns: number;
  private catQuote: string;

  private bowlCx = BOARD_RECT.x + BOARD_RECT.width / 2;
  private bowlCy = 266;

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.isMamTom = ctx.recipe.id.includes('mam_tom');
    this.targetTurns = lerp(2.6, 4.2, ctx.difficulty);
    this.title = this.isMamTom
      ? `🌀 Đánh Mắm Tôm Sủi Bọt — ${ctx.recipe.name}`
      : `🌀 Pha Nước Chấm Đậm Đà — ${ctx.recipe.name}`;
    this.catQuote = this.isMamTom
      ? 'Vắt tắc rồi khuấy tròn đều tay cho mắm tôm sủi bọt trắng thơm lừng nha! 🟣'
      : 'Xoay tròn đũa trong chén cho đường tỏi ớt hòa tan đều vị nhé! 🥢';
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.dragging = true;
      this.lastAngle = Math.atan2(pos.y - this.bowlCy, pos.x - this.bowlCx);
    }
  }

  onMove(pos: Vec2): void {
    if (!this.dragging || this.result) return;
    const angle = Math.atan2(pos.y - this.bowlCy, pos.x - this.bowlCx);
    if (this.lastAngle !== null) {
      let delta = angle - this.lastAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;

      const absDelta = Math.abs(delta);
      if (absDelta > 0.03 && absDelta < 1.2) {
        this.whiskAngle += delta;
        this.foam = Math.min(1, this.foam + absDelta / (Math.PI * 2 * this.targetTurns));

        if (Math.random() < 0.45) {
          this.ctx.particles.emitLiquidSplash(
            this.bowlCx + Math.cos(angle) * 42,
            this.bowlCy + Math.sin(angle) * 42,
            this.isMamTom ? '#e0aaff' : '#ffd166',
            2,
          );
        }

        if (this.foam > 0.55) {
          this.catQuote = this.isMamTom
            ? 'Sủi bọt bông trắng mịn luôn rồi!! Thơm muốn xỉu! ✨'
            : 'Nước chấm sánh mịn tỏi ớt nổi đều đẹp quá trời! ✨';
        }

        if (this.foam >= 1) {
          const timeBonus = clamp(Math.round(105 - this.elapsed * 4), 78, 100);
          const grade = gradeFromScore(timeBonus);
          this.ctx.particles.emitStarburst(this.bowlCx, this.bowlCy, '#ffd166', 24);
          this.result = {
            score: timeBonus,
            grade,
            catSpeaker: 'golden',
            catComment: this.isMamTom
              ? 'Mắm tôm đánh bông cực phẩm! Chấm đậu rán nóng là hết bài! 🟣⭐'
              : 'Chén nước mắm pha chuẩn vị chua cay mặn ngọt luôn! 🥢⭐',
          };
        }
      }
    }
    this.lastAngle = angle;
  }

  onUp(): void {
    this.dragging = false;
    this.lastAngle = null;
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

    const cx = this.bowlCx;
    const cy = this.bowlCy;

    ctx.save();
    // Porcelain dipping bowl
    ctx.beginPath();
    ctx.arc(cx, cy, 102, 0, Math.PI * 2);
    ctx.fillStyle = '#e6dfd3';
    ctx.fill();
    ctx.strokeStyle = '#2a6f97';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Sauce liquid inside
    ctx.beginPath();
    ctx.arc(cx, cy, 86, 0, Math.PI * 2);
    ctx.fillStyle = this.isMamTom ? '#5a365f' : '#c95c16';
    ctx.fill();

    // Swirling spiral + rising foam bubbles as foam increases!
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.whiskAngle);
    ctx.strokeStyle = this.isMamTom ? 'rgba(240, 215, 255, 0.7)' : 'rgba(255, 224, 130, 0.75)';
    ctx.lineWidth = 4;
    for (let arm = 0; arm < 3; arm++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(20, 0, 22 + this.foam * 24, 0, Math.PI * 1.1);
      ctx.stroke();
    }
    // Floating chili/garlic or bubbly foam dots
    const bubbleCount = Math.floor(4 + this.foam * 22);
    for (let i = 0; i < bubbleCount; i++) {
      const a = i * 1.15;
      const rad = 16 + ((i * 19) % 62);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fillStyle = this.isMamTom ? 'rgba(255,245,255,0.85)' : i % 3 === 0 ? '#e63946' : '#fff3b0';
      ctx.fill();
    }
    ctx.restore();

    // Dotted circular swirl guide arrow
    if (!this.result) {
      ctx.beginPath();
      ctx.arc(cx, cy, 118, 0, Math.PI * 1.65);
      ctx.strokeStyle = 'rgba(252, 163, 17, 0.65)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.elapsed * 30;
      ctx.stroke();
      ctx.setLineDash([]);

      // Animated chopstick whisk orbiting bowl
      const stickA = this.dragging ? this.whiskAngle : this.elapsed * 2.8;
      const sx = cx + Math.cos(stickA) * 52;
      const sy = cy + Math.sin(stickA) * 52;
      ctx.strokeStyle = '#d4a373';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 54, sy - 64);
      ctx.stroke();
      ctx.strokeStyle = '#b07d4f';
      ctx.beginPath();
      ctx.moveTo(sx + 7, sy + 4);
      ctx.lineTo(sx + 62, sy - 58);
      ctx.stroke();
    }

    // Foam progress bar at top of board
    drawProgressBar(ctx, b.x + 150, 134, b.width - 300, 16, this.foam, this.isMamTom ? '#c77dff' : '#FCA311');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`ĐỘ SỦI BỌT: ${Math.round(this.foam * 100)}%`, cx, 142);
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 10. RollWrapMinigame — 🌯 Vuốt 3 bước cuốn Gỏi Cuốn / Phở Cuốn / Bánh Nậm!
// Step 0: Swipe Right (gấp mép trái) -> Step 1: Swipe Left (gấp mép phải) -> Step 2: Swipe Up (cuộn tròn!)
// ============================================================

export class RollWrapMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Vuốt theo 3 mũi tên (Phải → Trái → Lên) để cuốn thật chặt!';
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private isLeaf: boolean;
  private elapsed = 0;
  private finishTimer = 0;

  private foldStage = 0; // 0: swipe right, 1: swipe left, 2: swipe up
  private startPos: Vec2 | null = null;
  private mistakes = 0;
  private catQuote = 'Bước 1: Vuốt sang PHẢI ➡️ để gấp mép bánh bên trái vào!';

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.isLeaf = ctx.recipe.id.includes('banh_nam');
    this.title = this.isLeaf
      ? `🍃 Gói Lá Chuối — ${ctx.recipe.name}`
      : `🌯 Cuốn Bánh Tráng — ${ctx.recipe.name}`;
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.startPos = pos;
    }
  }

  onUp(pos: Vec2): void {
    if (!this.startPos || this.result) return;
    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    this.startPos = null;

    if (Math.hypot(dx, dy) < 42) return;

    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    const matched =
      (this.foldStage === 0 && dx > 35 && Math.abs(dx) > Math.abs(dy) * 0.7) ||
      (this.foldStage === 1 && dx < -35 && Math.abs(dx) > Math.abs(dy) * 0.7) ||
      (this.foldStage === 2 && dy < -35 && Math.abs(dy) > Math.abs(dx) * 0.7);

    if (matched) {
      this.foldStage++;
      this.ctx.particles.emitStarburst(cx, 268, '#80ed99', 14);
      if (this.foldStage === 1) {
        this.catQuote = 'Gọn lắm! Bước 2: Vuốt sang TRÁI ⬅️ để gấp mép bên phải vào!';
      } else if (this.foldStage === 2) {
        this.catQuote = 'Chuẩn rồi! Bước 3: Vuốt thẳng LÊN TRÊN ⬆️ để cuộn chặt tay!';
      } else {
        const timePenalty = Math.max(0, (this.elapsed - lerp(7, 3.8, this.ctx.difficulty)) * 4);
        const score = clamp(Math.round(100 - this.mistakes * 18 - timePenalty), 55, 100);
        const grade = gradeFromScore(score);
        this.ctx.particles.emitStarburst(cx, 260, '#ffd166', 24);
        this.result = {
          score,
          grade,
          catSpeaker: 'boss',
          catComment:
            grade === 'PERFECT'
              ? 'Cuốn tròn trịa chắc tay không bung một góc nào! Đẳng cấp! 🌯⭐'
              : 'Cuốn xong rồi, xếp ra đĩa phục vụ khách thôi!',
        };
      }
    } else {
      this.mistakes++;
      this.ctx.particles.shake(4, 0.14);
      this.catQuote =
        this.foldStage === 0
          ? 'Vuốt sang PHẢI ➡️ nhé!'
          : this.foldStage === 1
            ? 'Vuốt sang TRÁI ⬅️ nhé!'
            : 'Vuốt thẳng LÊN TRÊN ⬆️ để cuộn tròn nào!';
    }
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
    const cy = 272;

    ctx.save();
    // Bamboo rolling mat
    roundRect(ctx, cx - 205, 152, 410, 232, 18);
    ctx.fillStyle = '#9c6644';
    ctx.fill();
    for (let y = 162; y < 376; y += 12) {
      ctx.strokeStyle = 'rgba(60, 30, 12, 0.28)';
      ctx.beginPath();
      ctx.moveTo(cx - 198, y);
      ctx.lineTo(cx + 198, y);
      ctx.stroke();
    }

    // Rice paper / banana leaf wrapper transforming cleanly per foldStage!
    const wrapColor = this.isLeaf ? '#40916c' : 'rgba(255, 252, 245, 0.9)';
    const wrapStroke = this.isLeaf ? '#1b4332' : '#d8cfc0';

    if (this.foldStage < 3) {
      const leftEdge = this.foldStage >= 1 ? cx - 95 : cx - 150;
      const rightEdge = this.foldStage >= 2 ? cx + 95 : cx + 150;
      roundRect(ctx, leftEdge, cy - 82, rightEdge - leftEdge, 164, 16);
      ctx.fillStyle = wrapColor;
      ctx.fill();
      ctx.strokeStyle = wrapStroke;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Delicious filling in center (shrimp/beef + fresh herbs!)
      roundRect(ctx, cx - 72, cy - 18, 144, 38, 14);
      ctx.fillStyle = '#52b768';
      ctx.fill();
      ctx.font = '26px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍤  🥩  🌿', cx, cy + 2);
    } else {
      // Completed tight plump spring roll / leaf parcel!
      roundRect(ctx, cx - 105, cy - 36, 210, 72, 32);
      ctx.fillStyle = this.isLeaf ? '#2d6a4f' : '#fffcf5';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.isLeaf ? '#fff' : '#2d9348';
      ctx.fillText('✨ CUỐN TRÒN CHẮC TAY! ✨', cx, cy);
    }

    // Animated directional swipe guide arrow
    if (this.foldStage < 3) {
      const slide = Math.sin(this.elapsed * 6) * 14;
      ctx.font = 'bold 42px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      if (this.foldStage === 0) {
        ctx.fillText('➡️', cx - 115 + slide, cy);
      } else if (this.foldStage === 1) {
        ctx.fillText('⬅️', cx + 115 - slide, cy);
      } else {
        ctx.fillText('⬆️', cx, cy + 54 - Math.abs(slide));
      }
      ctx.shadowBlur = 0;
    }

    // 3 step indicator pills
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Bước gấp: ${this.foldStage} / 3`, cx, 138, '#ffd166');
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 11. BlanchDipMinigame — 💧 Nhúng giỏ tre trụng phở & nhấc ráo đúng độ mềm!
// Hold to dip basket into boiling pot; release inside the green zone!
// ============================================================

export class BlanchDipMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Nhấn GIỮ để nhúng giỏ phở — THẢ TAY khi tới vùng xanh!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private dipping = false;
  private softness = 0; // 0..1 (sweet spot tightens slightly with difficulty!)
  private sweetMin: number;
  private sweetMax: number;
  private speed: number;
  private basketY = 175;
  private catQuote = 'Giữ nút NHÚNG để trụng sợi phở trong nước sôi — chín tới vùng xanh thì nhấc lên liền!';

  private dipBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `💧 Trụng Giỏ Tre — ${ctx.recipe.name}`;
    this.speed = lerp(0.50, 0.80, ctx.difficulty);
    const halfSpan = lerp(0.13, 0.075, ctx.difficulty);
    const center = randFloat(0.52, 0.80); // Randomized blanch sweet-spot every time!
    this.sweetMin = clamp(center - halfSpan, 0.34, 0.78);
    this.sweetMax = clamp(center + halfSpan, 0.50, 0.92);
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.dipping = true;
      const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
      this.ctx.particles.emitLiquidSplash(cx, 250, '#90e0ef', 8);
      this.ctx.particles.emitSteam(cx, 232, 3);
      this.catQuote = 'Đang trụng sôi sùng sục! Canh vùng xanh lá rồi thả tay nhấc giỏ lên!';
    }
  }

  onUp(): void {
    if (!this.dipping || this.result) return;
    this.dipping = false;
    this.evaluate();
  }

  private evaluate(): void {
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    let score: number;
    let comment: string;

    if (this.softness >= this.sweetMin && this.softness <= this.sweetMax) {
      score = 100;
      this.ctx.particles.emitStarburst(cx, 210, '#4CAF50', 22);
      comment = 'Sợi phở dai mềm ráo nước chuẩn tiệm gia truyền!! 🍜⭐';
    } else if (this.softness < this.sweetMin) {
      score = clamp(Math.round((this.softness / this.sweetMin) * 78), 40, 78);
      comment = 'Nhấc hơi sớm nên sợi còn hơi cứng chút xíu nè! 😅';
    } else {
      score = 48;
      this.ctx.particles.emitAngryPuff(cx, 220);
      this.ctx.particles.shake(4, 0.16);
      comment = 'Trụng quá tay sợi hơi mềm nát mất rồi! Nhấc sớm hơn chút nha~ 🙀';
    }

    this.result = {
      score,
      grade: gradeFromScore(score),
      catSpeaker: 'golden',
      catComment: comment,
    };
  }

  update(dt: number): void {
    this.elapsed += dt;
    const targetY = this.dipping ? 236 : 168;
    this.basketY += (targetY - this.basketY) * Math.min(1, dt * 14);

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    if (this.dipping) {
      this.softness += this.speed * dt;
      if (Math.random() < dt * 14) {
        this.ctx.particles.emitSteam(BOARD_RECT.x + BOARD_RECT.width / 2, 238, 1);
      }
      if (this.softness >= 1) {
        this.softness = 1;
        this.dipping = false;
        this.evaluate();
      }
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

    ctx.save();
    // Steaming metal boiling pot at bottom
    roundRect(ctx, cx - 105, 240, 210, 96, 16);
    ctx.fillStyle = '#6c757d';
    ctx.fill();
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(cx - 90, 242, 42, 90);
    // Boiling shimmering water surface
    ctx.beginPath();
    ctx.ellipse(cx, 244, 96, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#90e0ef';
    ctx.fill();

    // Woven bamboo blanching basket moving smoothly into/out of pot!
    roundRect(ctx, cx - 44, this.basketY, 88, 66, 14);
    ctx.fillStyle = '#d4a373';
    ctx.fill();
    ctx.strokeStyle = '#7f4f24';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Long bamboo handle
    ctx.strokeStyle = '#b07d4f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx + 36, this.basketY + 12);
    ctx.lineTo(cx + 108, this.basketY - 46);
    ctx.stroke();
    // White noodles piled inside basket
    ctx.beginPath();
    ctx.ellipse(cx, this.basketY + 10, 38, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fffcf2';
    ctx.fill();

    // Softness horizontal gauge
    const barX = b.x + 86;
    const barY = 136;
    const barW = b.width - 172;
    const barH = 22;

    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.clip();
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(barX + barW * this.sweetMin, barY, barW * (this.sweetMax - this.sweetMin), barH);
    ctx.fillStyle = '#E63946';
    ctx.fillRect(barX + barW * this.sweetMax, barY, barW * (1 - this.sweetMax), barH);
    ctx.restore();
    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const px = barX + this.softness * barW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 3, barY - 4, 6, barH + 8);

    // Hold-to-dip button
    const btn = this.dipBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = this.dipping ? '#4CAF50' : '#2a9d8f';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.dipping ? '⬆️ THẢ TAY ĐỂ NHẤC GIỎ!' : '💧 GIỮ ĐỂ NHÚNG TRỤNG!',
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 12. SqueezeLimeMinigame — 🍋 Vắt chanh / tắc tươi, né rơi hạt vào tô!
// Tap to squeeze juice drops when the seed isn't directly at the spout!
// ============================================================

export class SqueezeLimeMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Chạm VẮT CHANH khi hạt chanh né sang hai bên!';
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private drops = 0;
  private targetDrops: number;
  private seedFallen = 0;
  private seedPhase = 0; // oscillates -1..1; danger when near 0!
  private seedSpeed: number;
  private squeezeAnim = 0;
  private catQuote = 'Chạm VẮT CHANH khi hạt chanh màu trắng tránh khỏi chính giữa nhé!';

  private squeezeBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `🍋 Vắt Chanh Tươi — ${ctx.recipe.name}`;
    this.targetDrops = ctx.difficulty > 0.5 ? 5 : 4;
    this.seedSpeed = lerp(2.2, 3.8, ctx.difficulty);
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.squeeze();
    }
  }

  private squeeze(): void {
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    this.squeezeAnim = 0.22;
    const seedPos = Math.sin(this.seedPhase);

    if (Math.abs(seedPos) < 0.34) {
      // Oops! Seed dropped into the bowl!
      this.seedFallen++;
      this.ctx.particles.emitAngryPuff(cx, 250);
      this.ctx.particles.shake(4, 0.16);
      this.catQuote = 'Ối rơi hạt chanh cái tõm vào tô rồi!! Canh hạt lệch sang 2 bên hãy vắt! 🍋🙀';
    } else {
      this.drops++;
      this.ctx.particles.emitLiquidSplash(cx, 275, '#b7e868', 10);
      this.ctx.particles.emitStarburst(cx, 285, '#80ed99', 8);
      this.catQuote = `Tách tách! Nước cốt chanh thơm lừng (${this.drops}/${this.targetDrops})! ✨`;
    }

    if (this.drops >= this.targetDrops) {
      const score = clamp(100 - this.seedFallen * 20, 45, 100);
      const grade = gradeFromScore(score);
      this.ctx.particles.emitStarburst(cx, 250, '#80ed99', 24);
      this.result = {
        score,
        grade,
        catSpeaker: 'boss',
        catComment:
          grade === 'PERFECT'
            ? 'Vắt chanh chuẩn không rơi một hạt nào! Chua thanh cực đã! 🍋⭐'
            : 'Vắt chanh xong rồi — lần sau nhớ gạt hạt kỹ hơn nhé!',
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.seedPhase += this.seedSpeed * dt;
    if (this.squeezeAnim > 0) this.squeezeAnim = Math.max(0, this.squeezeAnim - dt);

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
    const squeezeScale = this.squeezeAnim > 0 ? 0.86 : 1;
    const seedOffset = Math.sin(this.seedPhase) * 62;
    const danger = Math.abs(Math.sin(this.seedPhase)) < 0.34;

    ctx.save();
    // Big fresh Vietnamese green lime wedge at top
    ctx.save();
    ctx.translate(cx, 198);
    ctx.scale(squeezeScale, 1 / squeezeScale);
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#2d9348';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#b7e868';
    ctx.fill();
    ctx.restore();

    // Sliding white lime seed indicator track!
    roundRect(ctx, cx - 80, 232, 160, 22, 11);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();
    // Red danger spout center
    ctx.fillStyle = 'rgba(230, 57, 70, 0.65)';
    ctx.fillRect(cx - 24, 232, 48, 22);
    // Moving seed
    ctx.beginPath();
    ctx.ellipse(cx + seedOffset, 243, 9, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fffcf5';
    ctx.fill();
    ctx.strokeStyle = danger ? '#ef233c' : '#2d9348';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Waiting steaming dish bowl underneath
    const foodKey = `food_${this.ctx.recipe.id}`;
    if (this.ctx.engine.assets.hasImage(foodKey)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.ctx.engine.assets.getImage(foodKey), cx - 44, 276, 88, 88);
    }

    // Drop counter
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Giọt chanh tươi: ${this.drops} / ${this.targetDrops}`, cx, 138, '#b7e868');

    // Squeeze button
    const btn = this.squeezeBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = danger ? '#64748b' : '#2d9348';
    ctx.fill();
    ctx.strokeStyle = danger ? '#e63946' : '#b7e868';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      danger ? '⚠️ CHỜ HẠT NÉ RA!' : '🍋 BÓP VẮT CHANH!',
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 13. IceCrushMinigame — 🧊 Đập tảng đá thành đá viên mát lạnh!
// Tap the glowing crack spots on the crystal ice block!
// ============================================================

interface CrackSpot {
  x: number;
  y: number;
  r: number;
  broken: boolean;
}

export class IceCrushMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Chạm nhanh vào các điểm nứt phát sáng để đập đá!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;
  private spots: CrackSpot[] = [];
  private blockShake = 0;
  private catQuote = 'Đập tan tảng đá lớn lấy đá viên mát lạnh nào! Chạm điểm sáng trên khối băng!';

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.title = `🧊 Đập Đá Mát Lạnh — ${ctx.recipe.name}`;

    const count = ctx.difficulty > 0.45 ? 6 : 4;
    const preset: Array<[number, number]> = [
      [425, 224], [532, 218], [478, 272], [432, 316], [538, 310], [482, 206],
    ];
    for (let i = 0; i < count; i++) {
      this.spots.push({ x: preset[i][0], y: preset[i][1], r: 30, broken: false });
    }
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    for (const s of this.spots) {
      if (s.broken) continue;
      if (Math.hypot(pos.x - s.x, pos.y - s.y) <= s.r + 12) {
        s.broken = true;
        this.blockShake = 0.2;
        this.ctx.particles.emitSliceSparks(s.x, s.y, '#90e0ef', 16);
        this.ctx.particles.emitLiquidSplash(s.x, s.y, '#d8f3fc', 6);
        this.ctx.particles.shake(3.5, 0.12);

        const left = this.spots.filter((sp) => !sp.broken).length;
        this.catQuote =
          left > 0
            ? `Rắc rắc!! Còn ${left} điểm nứt nữa thôi! 🧊`
            : 'Đá viên trong veo mát rượi luôn!! ❄️✨';

        if (left === 0) {
          const score = clamp(Math.round(105 - this.elapsed * 4), 78, 100);
          const grade = gradeFromScore(score);
          this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 268, '#90e0ef', 26);
          this.result = {
            score,
            grade,
            catSpeaker: 'golden',
            catComment: 'Đá đập giòn tan mát lạnh đánh bay cái nắng Sài Gòn! 🧊⭐',
          };
        }
        return;
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.blockShake > 0) this.blockShake = Math.max(0, this.blockShake - dt);
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
    const shakeX = this.blockShake > 0 ? Math.sin(this.blockShake * 70) * 6 : 0;

    ctx.save();
    ctx.translate(shakeX, 0);

    // Sparkling crystal ice block
    roundRect(ctx, cx - 120, 174, 240, 190, 22);
    const iceGrad = ctx.createLinearGradient(cx - 120, 174, cx + 120, 364);
    iceGrad.addColorStop(0, '#e0f7ff');
    iceGrad.addColorStop(0.5, '#90e0ef');
    iceGrad.addColorStop(1, '#48cae4');
    ctx.fillStyle = iceGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Glossy ice highlight streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 88, 200);
    ctx.lineTo(cx - 46, 246);
    ctx.moveTo(cx - 72, 194);
    ctx.lineTo(cx - 42, 226);
    ctx.stroke();

    // Crack spots
    for (const s of this.spots) {
      if (s.broken) {
        // Shattered crack lines!
        ctx.strokeStyle = '#0077b6';
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(a) * 26, s.y + Math.sin(a) * 26);
          ctx.stroke();
        }
        continue;
      }

      const pulse = s.r + Math.sin(this.elapsed * 9) * 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '24px "Segoe UI"';
      ctx.fillText('🔨', s.x, s.y);
    }

    const doneCount = this.spots.filter((s) => s.broken).length;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Đập đá: ${doneCount} / ${this.spots.length}`, cx, 144, '#90e0ef');
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 14. PourTrayMinigame — 🎨 Đổ 3 chén Bánh Bèo & rắc tôm cháy mỡ hành!
// Tap & hold each porcelain saucer to fill cleanly to the golden rim!
// ============================================================

interface SaucerSlot {
  x: number;
  y: number;
  fill: number; // 0..1 (target 0.72..0.95)
  done: boolean;
  score: number;
}

export class PourTrayMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Nhấn GIỮ nút để đổ đầy từng chén Bánh Bèo tới viền vàng!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;
  private saucers: SaucerSlot[];
  private activeIdx = 0;
  private pouring = false;
  private fillSpeed: number;
  private sweetMin: number;
  private sweetMax: number;
  private catQuote = 'Giữ nút ĐỔ BỘT cho chén Bánh Bèo đầy tròn vừa miệng rồi thả tay nha!';

  private pourBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    this.title = `🎨 Đổ Chén Bánh Bèo — ${ctx.recipe.name}`;
    this.fillSpeed = lerp(0.75, 1.18, d);
    this.sweetMin = lerp(0.66, 0.76, d);
    this.sweetMax = lerp(0.97, 0.93, d);
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    this.saucers = [
      { x: cx - 150, y: 260, fill: 0, done: false, score: 0 },
      { x: cx, y: 260, fill: 0, done: false, score: 0 },
      { x: cx + 150, y: 260, fill: 0, done: false, score: 0 },
    ];
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.pouring = true;
    }
  }

  onUp(): void {
    if (!this.pouring || this.result) return;
    this.pouring = false;
    this.finishSaucer();
  }

  private finishSaucer(): void {
    const s = this.saucers[this.activeIdx];
    if (!s) return;
    s.done = true;

    if (s.fill >= this.sweetMin && s.fill <= this.sweetMax) {
      s.score = 100;
      this.ctx.particles.emitStarburst(s.x, s.y, '#ffd166', 14);
      this.ctx.particles.emitSpiceRain(s.x, s.y, '#f47b20');
      this.catQuote = 'Tròn xoe trắng mịn + rắc tôm cháy mỡ hành đẹp mê ly!! ✨';
    } else if (s.fill < this.sweetMin) {
      s.score = 68;
      this.catQuote = 'Chén này hơi ít bột chút, chén sau đổ đầy thêm nha!';
    } else {
      s.score = 52;
      this.ctx.particles.emitAngryPuff(s.x, s.y);
      this.catQuote = 'Á tràn ra ngoài chén rồi! Thả tay sớm hơn chút nhé! 😅';
    }

    this.activeIdx++;
    if (this.activeIdx >= this.saucers.length) {
      const avg = Math.round(this.saucers.reduce((a, sc) => a + sc.score, 0) / this.saucers.length);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 250, '#4CAF50', 22);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'golden',
        catComment:
          grade === 'PERFECT'
            ? 'Mâm Bánh Bèo Huế 3 chén đẹp chuẩn cung đình luôn! ⭐'
            : 'Xong mâm Bánh Bèo rồi, bưng ra cho khách thôi!',
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    if (this.pouring && this.saucers[this.activeIdx]) {
      const s = this.saucers[this.activeIdx];
      s.fill += this.fillSpeed * dt;
      if (Math.random() < dt * 16) {
        this.ctx.particles.emitLiquidSplash(s.x, s.y, '#fffcf5', 2);
      }
      if (s.fill >= 1.05) {
        s.fill = 1.05;
        this.pouring = false;
        this.finishSaucer();
      }
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

    ctx.save();
    // Wooden Huế serving tray
    roundRect(ctx, cx - 240, 174, 480, 166, 26);
    ctx.fillStyle = '#7f4f24';
    ctx.fill();
    roundRect(ctx, cx - 228, 184, 456, 146, 20);
    ctx.fillStyle = '#9c6644';
    ctx.fill();

    // 3 little white porcelain saucers!
    for (let i = 0; i < this.saucers.length; i++) {
      const s = this.saucers[i];
      const isActive = i === this.activeIdx && !this.result;

      // Saucer rim
      ctx.beginPath();
      ctx.arc(s.x, s.y, 56, 0, Math.PI * 2);
      ctx.fillStyle = '#e6dfd3';
      ctx.fill();
      ctx.strokeStyle = isActive ? '#ffd166' : '#bfb5a4';
      ctx.lineWidth = isActive ? 4 : 2;
      ctx.stroke();

      // Target sweet-spot ring (visually matches sweetMin..sweetMax!)
      const midR = ((this.sweetMin + this.sweetMax) / 2) * 50;
      ctx.beginPath();
      ctx.arc(s.x, s.y, midR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.65)';
      ctx.lineWidth = Math.max(2.5, (this.sweetMax - this.sweetMin) * 28);
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // White rice cake batter expanding cleanly as poured!
      if (s.fill > 0) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.min(54, s.fill * 50), 0, Math.PI * 2);
        ctx.fillStyle = '#fffcf5';
        ctx.fill();

        // Orange dried shrimp floss & green scallion oil garnish once done!
        if (s.done) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
          ctx.fillStyle = '#f47b20';
          ctx.fill();
          ctx.fillStyle = '#2d9348';
          ctx.fillRect(s.x - 10, s.y - 6, 6, 5);
          ctx.fillRect(s.x + 6, s.y + 4, 6, 5);
        }
      }
    }

    // Pour button
    const btn = this.pourBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = this.pouring ? '#4CAF50' : '#e85d04';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.pouring ? '⬆️ THẢ TAY ĐÚNG VIỀN XANH!' : `🎨 GIỮ ĐỔ CHÉN ${Math.min(3, this.activeIdx + 1)}/3`,
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );
    ctx.restore();

    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}
