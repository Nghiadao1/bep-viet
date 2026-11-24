// ============================================================
// CraftMinigames — Creative Craft & Customer-Taste Minigames:
// 5. VeggiePrepMinigame  (🥗 Nhặt rau tươi, loại lá úa)
// 6. SeasoningMinigame   (🧂 Nêm gia vị & topping đúng khẩu vị khách!)
// 7. WokTossMinigame     (🍳 Hất chảo xào lửa lớn)
// 8. LayerPourMinigame   (☕ Giữ thả đúng vạch rót tầng Chè / Cà Phê)
// ============================================================

import type { Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { clamp, lerp, randFloat, shuffle } from '../utils/math';
import { generateCustomerTaste, type CustomerTasteOrder, type ToppingOption } from '../data/tastes';
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
// 5. VeggiePrepMinigame — 🥗 Nhặt rau thơm tươi sạch (VEGGIE)
// ============================================================

interface VeggieItem {
  x: number;
  y: number;
  r: number;
  emoji: string;
  fresh: boolean;
  picked: boolean;
  shake: number;
  phase: number;
}

export class VeggiePrepMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction: string;
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;
  private items: VeggieItem[] = [];
  private targetFresh: number;
  private mistakes = 0;
  private catQuote = 'Nhặt nhanh mấy cọng rau xanh mướt bỏ vô tô nha, né lá úa ra!';

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    const freshCount = d < 0.15 ? 4 : d < 0.5 ? 5 : 6;
    const badCount = d < 0.15 ? 1 : d < 0.5 ? 2 : 3;
    this.targetFresh = freshCount;
    this.title = `🥗 ${ctx.step.action} — ${ctx.recipe.name}`;
    this.instruction = `Chạm nhặt hết ${freshCount} rau tươi xanh — tránh lá úa & sâu!`;

    // 9 clean non-overlapping basket slots so up to 6 fresh + 3 bad never collide!
    const slots = shuffle([
      { x: 318, y: 215 }, { x: 416, y: 194 }, { x: 522, y: 194 }, { x: 626, y: 215 },
      { x: 344, y: 288 }, { x: 432, y: 274 }, { x: 528, y: 274 }, { x: 616, y: 288 },
      { x: 480, y: 332 },
    ]);
    const freshEmojis = ['🥬', '🌿', '🌱', '🥒', '🥕', '🫑'];
    const badEmojis = ['🍂', '🐛', '🥀'];

    for (let i = 0; i < freshCount; i++) {
      this.items.push({
        x: slots[i].x + randFloat(-6, 6),
        y: slots[i].y + randFloat(-5, 5),
        r: 31,
        emoji: freshEmojis[i % freshEmojis.length],
        fresh: true,
        picked: false,
        shake: 0,
        phase: i * 1.1,
      });
    }
    for (let i = 0; i < badCount; i++) {
      this.items.push({
        x: slots[freshCount + i].x + randFloat(-6, 6),
        y: slots[freshCount + i].y + randFloat(-5, 5),
        r: 28,
        emoji: badEmojis[i % badEmojis.length],
        fresh: false,
        picked: false,
        shake: 0,
        phase: i * 2.1,
      });
    }
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    for (const item of this.items) {
      if (item.picked) continue;
      if (Math.hypot(pos.x - item.x, pos.y - item.y) <= item.r + 8) {
        if (item.fresh) {
          item.picked = true;
          this.ctx.particles.emitLeafBurst(item.x, item.y);
          const remaining = this.items.filter((it) => it.fresh && !it.picked).length;
          this.catQuote =
            remaining > 0
              ? `Tươi roi rói! Còn ${remaining} lá rau nữa thôi! 🌿`
              : 'Rau sạch bong kin kít luôn! Tuyệt vời! ⭐';

          if (remaining === 0) {
            const score = clamp(100 - this.mistakes * 20, 45, 100);
            const grade = gradeFromScore(score);
            this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 260, '#52b788', 22);
            this.result = {
              score,
              grade,
              catSpeaker: 'golden',
              catComment:
                grade === 'PERFECT'
                  ? 'Rau thơm tươi xanh không một vết úa! Khách mê tít! 🥬'
                  : 'Nhặt xong rau rồi! Lần sau nhớ né sâu với lá úa nha~',
            };
          }
        } else {
          this.mistakes++;
          item.shake = 0.4;
          this.ctx.particles.emitAngryPuff(item.x, item.y);
          this.ctx.particles.shake(4, 0.16);
          this.catQuote = 'Á!! Đó là lá úa / bé sâu mà! Đừng bỏ vô tô khách nha! 🙀';
        }
        return;
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (const item of this.items) {
      if (item.shake > 0) item.shake = Math.max(0, item.shake - dt);
    }
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

    // Large woven bamboo basket
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, 268, 240, 128, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7f4f24';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, 264, 226, 116, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#b07d4f';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, 262, 206, 102, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2d4739';
    ctx.fill();

    // Draw veggie tokens
    for (const item of this.items) {
      if (item.picked) continue;
      const bob = Math.sin(this.elapsed * 4 + item.phase) * 3;
      const shakeX = item.shake > 0 ? Math.sin(item.shake * 55) * 7 : 0;

      ctx.beginPath();
      ctx.arc(item.x + shakeX, item.y + bob, item.r, 0, Math.PI * 2);
      ctx.fillStyle = item.fresh ? 'rgba(76, 175, 80, 0.28)' : 'rgba(230, 57, 70, 0.22)';
      ctx.fill();
      ctx.strokeStyle = item.fresh ? '#80ed99' : '#e63946';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '34px "Segoe UI"';
      ctx.fillText(item.emoji, item.x + shakeX, item.y + bob);
    }

    // Counter top of basket
    const picked = this.items.filter((it) => it.fresh && it.picked).length;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Rau tươi đã nhặt: ${picked} / ${this.targetFresh}`, cx, 138, '#80ed99');
    ctx.restore();

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 6. SeasoningMinigame — 🧂 Nêm gia vị & topping theo đúng khẩu vị khách!
// (Hành lá / KHÔNG HÀNH, tương ớt, quẩy, nước mắm, pate, đồ chua...)
// ============================================================

export class SeasoningMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Chọn đúng gia vị khách yêu cầu rồi bấm XONG!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private taste: CustomerTasteOrder;
  private elapsed = 0;
  private finishTimer = 0;

  private selected = new Set<string>();
  private jarRects: Array<{ option: ToppingOption; rect: Rect }> = [];
  private confirmBtn: Rect = { x: 642, y: 222, width: 152, height: 64 };
  private catQuote: string;

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    this.taste = ctx.taste ?? generateCustomerTaste(ctx.recipe, ctx.difficulty);
    this.title = `🧂 Nêm Gia Vị & Topping — ${ctx.recipe.name}`;

    const wantsText = this.taste.wanted.map((w) => w.label).join(' + ');
    this.catQuote = this.taste.forbidden
      ? `Khách dặn thêm ${wantsText}, và TUYỆT ĐỐI KHÔNG ${this.taste.forbidden.label.toUpperCase()} nha!`
      : `Khách thích đậm đà: thêm ${wantsText} nhé!`;

    // Lay out 6 touch-friendly seasoning jars cleanly along the bottom shelf
    const jarW = 98;
    const jarH = 82;
    const gap = 10;
    const totalW = this.taste.tray.length * jarW + (this.taste.tray.length - 1) * gap;
    const startX = BOARD_RECT.x + (BOARD_RECT.width - totalW) / 2;

    this.jarRects = this.taste.tray.map((option, i) => ({
      option,
      rect: {
        x: startX + i * (jarW + gap),
        y: 336,
        width: jarW,
        height: jarH,
      },
    }));
  }

  onDown(pos: Vec2): void {
    if (this.result) return;

    // Toggle seasoning jars
    for (const { option, rect } of this.jarRects) {
      if (InputManager.hitTest(pos, rect, 4)) {
        if (this.selected.has(option.id)) {
          this.selected.delete(option.id);
          this.catQuote = `Đã gắp ${option.label} ra khỏi món!`;
        } else {
          this.selected.add(option.id);
          const dishCx = BOARD_RECT.x + 260;
          const dishCy = 258;
          this.ctx.particles.emitSpiceRain(dishCx, dishCy, option.color);

          if (this.taste.forbidden && option.id === this.taste.forbidden.id) {
            this.ctx.particles.emitAngryPuff(dishCx, dishCy);
            this.ctx.particles.shake(5, 0.18);
            this.catQuote = `Á!! Khách dặn KHÔNG ${option.label.toUpperCase()} mà! Chạm lại hũ đó để gắp ra mau! 🙀`;
          } else if (this.taste.wanted.some((w) => w.id === option.id)) {
            this.ctx.particles.emitStarburst(dishCx, dishCy - 10, '#ffd166', 10);
            this.catQuote = `Chuẩn bài! Đúng vị ${option.label} khách mê luôn! ✨`;
          } else {
            this.catQuote = `Đã thêm chút ${option.label} — xem kỹ phiếu yêu cầu nha!`;
          }
        }
        return;
      }
    }

    // Confirm button
    if (InputManager.hitTest(pos, this.confirmBtn, 6)) {
      this.submitSeasoning();
    }
  }

  private submitSeasoning(): void {
    let score = 100;
    let missing = 0;
    let addedForbidden = false;
    let extras = 0;

    for (const w of this.taste.wanted) {
      if (!this.selected.has(w.id)) {
        score -= 28;
        missing++;
      }
    }
    if (this.taste.forbidden && this.selected.has(this.taste.forbidden.id)) {
      score -= 45;
      addedForbidden = true;
    }
    for (const id of this.selected) {
      const isWanted = this.taste.wanted.some((w) => w.id === id);
      const isForb = this.taste.forbidden?.id === id;
      if (!isWanted && !isForb) {
        score -= 10;
        extras++;
      }
    }

    score = clamp(score, 25, 100);
    const grade = gradeFromScore(score);

    let comment: string;
    if (addedForbidden && this.taste.forbidden) {
      comment = `Ôi không! Lỡ bỏ ${this.taste.forbidden.label} khách ghét rồi, Vằn Bếp Trưởng lườm kìa! 😿`;
    } else if (missing === 0 && extras === 0) {
      comment = 'Đúng từng miligam khẩu vị khách hàng! Tiền tip bay phấp phới luôn! ⭐';
    } else if (missing > 0) {
      comment = 'Hơi thiếu gia vị khách gọi một chút, lần sau nhìn kỹ phiếu nha!';
    } else {
      comment = 'Nêm hơi hào phóng thêm chút gia vị phụ nhưng vẫn ngon lắm! 😋';
    }

    this.ctx.particles.emitStarburst(
      BOARD_RECT.x + 260,
      250,
      addedForbidden ? '#e63946' : '#4CAF50',
      22,
    );
    this.result = {
      score,
      grade,
      catSpeaker: addedForbidden ? 'boss' : 'golden',
      catComment: comment,
    };
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.52) this.done = true;
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

    // Customer Custom Taste Ticket (top of board)
    const ticketX = b.x + 24;
    const ticketY = 130;
    const ticketW = b.width - 48;
    const ticketH = 54;

    roundRect(ctx, ticketX, ticketY, ticketW, ticketH, 12);
    ctx.fillStyle = '#fffcf5';
    ctx.fill();
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#3d281c';
    ctx.fillText('📋 PHIẾU KHẨU VỊ:', ticketX + 14, ticketY + ticketH / 2);

    // Draw wanted & forbidden badges inside ticket (compact cleanly when 3+ wanted!)
    const compact = this.taste.wanted.length >= 3;
    let bx = ticketX + (compact ? 148 : 158);
    const badgeGap = compact ? 6 : 10;
    const badgePad = compact ? 12 : 18;
    const badgeFont = compact ? 'bold 12px "Segoe UI", system-ui, sans-serif' : 'bold 13px "Segoe UI", system-ui, sans-serif';

    for (const w of this.taste.wanted) {
      const done = this.selected.has(w.id);
      const label = compact ? w.shortLabel : w.label;
      const text = `${done ? '✅' : '+'} ${w.emoji} ${label}`;
      ctx.font = badgeFont;
      const tw = ctx.measureText(text).width + badgePad;
      roundRect(ctx, bx, ticketY + 11, tw, 32, 8);
      ctx.fillStyle = done ? '#2d9348' : '#e85d04';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(text, bx + tw / 2, ticketY + ticketH / 2);
      bx += tw + badgeGap;
    }

    if (this.taste.forbidden) {
      const f = this.taste.forbidden;
      const violated = this.selected.has(f.id);
      const text = compact ? `🚫 ${f.emoji} ${f.shortLabel}` : `🚫 KHÔNG ${f.emoji} ${f.shortLabel}`;
      ctx.font = badgeFont;
      const tw = ctx.measureText(text).width + badgePad;
      roundRect(ctx, bx, ticketY + 11, tw, 32, 8);
      ctx.fillStyle = violated ? '#d00000' : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(text, bx + tw / 2, ticketY + ticketH / 2);
    }

    // Center Dish Preview + floating added topping emojis!
    const dishCx = b.x + 260;
    const dishCy = 258;
    ctx.beginPath();
    ctx.ellipse(dishCx, dishCy + 34, 72, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    const foodKey = `food_${this.ctx.recipe.id}`;
    if (this.ctx.engine.assets.hasImage(foodKey)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.ctx.engine.assets.getImage(foodKey), dishCx - 54, dishCy - 56, 108, 108);
    }

    // Display currently added toppings orbiting neatly on top of the dish
    let idx = 0;
    for (const id of this.selected) {
      const opt = this.taste.tray.find((t) => t.id === id);
      if (!opt) continue;
      const ox = dishCx - 44 + (idx % 3) * 44;
      const oy = dishCy - 18 + Math.floor(idx / 3) * 28;
      ctx.font = '26px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.emoji, ox, oy);
      idx++;
    }

    // Confirm button to the right of the dish
    const cb = this.confirmBtn;
    const allWantedSelected = this.taste.wanted.every((w) => this.selected.has(w.id));
    roundRect(ctx, cb.x, cb.y, cb.width, cb.height, 14);
    ctx.fillStyle = allWantedSelected ? '#4CAF50' : '#2a9d8f';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '✅ XONG MÓN!', cb.x + cb.width / 2, cb.y + cb.height / 2, '#fff');

    // Bottom tray: 6 clickable Vietnamese seasoning jars
    for (const { option, rect } of this.jarRects) {
      const isPicked = this.selected.has(option.id);
      const isForb = this.taste.forbidden?.id === option.id;

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.fillStyle = isPicked
        ? (isForb ? 'rgba(230, 57, 70, 0.85)' : 'rgba(76, 175, 80, 0.85)')
        : 'rgba(255, 255, 255, 0.09)';
      ctx.fill();
      ctx.strokeStyle = isPicked ? '#fff' : option.color;
      ctx.lineWidth = isPicked ? 3 : 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '28px "Segoe UI"';
      ctx.fillText(option.emoji, rect.x + rect.width / 2, rect.y + 30);

      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, option.label, rect.x + rect.width / 2, rect.y + 64, '#fff');
    }

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 7. WokTossMinigame — 🍳 Hất chảo xào lửa lớn (WOK)
// ============================================================

export class WokTossMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction: string;
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private tossCount = 0;
  private targetTosses: number;
  private shrinkSpeed: number;
  private sweetTol: number;
  private targetPhase = 0.78; // Shifts target ring radius on EVERY toss!
  private scores: number[] = [];
  private pulsePhase = 0;     // 0..1 ring shrinking onto center
  private tossAnim = 0;       // ingredients flying up in arc
  private catQuote = 'Vòng xanh đổi kích cỡ sau mỗi lần hất! Canh vòng lửa chạm vòng xanh rồi HẤT CHẢO!';

  private tossBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    this.targetTosses = d > 0.55 ? 4 : 3;
    this.shrinkSpeed = lerp(0.68, 1.12, d);
    this.sweetTol = lerp(0.16, 0.10, d);
    this.targetPhase = randFloat(0.60, 0.86);
    this.title = `🍳 ${ctx.step.action} — ${ctx.recipe.name}`;
    this.instruction = `Vòng mục tiêu đổi cỡ liên tục — HẤT CHẢO đúng nhịp (${this.targetTosses} lần)!`;
  }

  onDown(pos: Vec2): void {
    if (this.result || this.tossAnim > 0) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.doToss();
    }
  }

  private doToss(): void {
    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    const dist = Math.abs(this.pulsePhase - this.targetPhase);
    const s = dist <= this.sweetTol ? 100 : dist <= this.sweetTol + 0.14 ? 76 : 52;
    this.scores.push(s);
    this.tossCount++;
    this.tossAnim = 0.42;
    this.pulsePhase = 0;
    this.targetPhase = randFloat(0.55, 0.88); // Fresh new ring size for next toss!

    this.ctx.particles.emitFireSparks(cx, 286, 18);
    this.ctx.particles.shake(4, 0.14);
    if (s >= 85) {
      this.ctx.particles.emitStarburst(cx, 230, '#ffd166', 14);
    }

    this.catQuote =
      s >= 85
        ? 'Lửa bùng dậy mùi thơm chảo gang! Đỉnh của chóp! 🔥'
        : 'Hất mạnh tay thêm chút nữa theo nhịp vòng lửa nha!';

    if (this.tossCount >= this.targetTosses) {
      const avg = Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(cx, 240, '#4CAF50', 24);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'boss',
        catComment:
          grade === 'PERFECT'
            ? 'Xào chảo lửa lớn dậy mùi thơm nức! Đệ tử ruột của Vằn! ⭐'
            : 'Món xào nóng hổi xong rồi!',
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.tossAnim > 0) this.tossAnim = Math.max(0, this.tossAnim - dt);

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    this.pulsePhase = (this.pulsePhase + dt * this.shrinkSpeed) % 1;
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
    const cy = 262;

    // Dynamic target golden/green ring + shrinking timing ring
    const targetR = 128 - this.targetPhase * 86;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, targetR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
    ctx.lineWidth = 6;
    ctx.stroke();

    const shrinkR = 128 - this.pulsePhase * 86;
    const inSweet = Math.abs(this.pulsePhase - this.targetPhase) <= this.sweetTol;
    ctx.beginPath();
    ctx.arc(cx, cy, shrinkR, 0, Math.PI * 2);
    ctx.strokeStyle = inSweet ? '#ffd166' : 'rgba(244, 140, 6, 0.8)';
    ctx.lineWidth = inSweet ? 5 : 3;
    ctx.stroke();

    // Wok sprite + tossed ingredients flying!
    const wokKick = this.tossAnim > 0 ? Math.sin((this.tossAnim / 0.45) * Math.PI) * -22 : 0;
    if (this.ctx.engine.assets.hasImage('station_wok')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.ctx.engine.assets.getImage('station_wok'), cx - 64, cy - 60 + wokKick, 128, 128);
    }

    if (this.tossAnim > 0) {
      const arc = Math.sin((this.tossAnim / 0.45) * Math.PI) * 95;
      ctx.font = '26px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText('🍜', cx - 28, cy - 30 - arc);
      ctx.fillText('🥩', cx + 24, cy - 36 - arc * 0.9);
      ctx.fillText('🌿', cx, cy - 48 - arc * 1.1);
    }

    // Counter
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `Lần hất chảo: ${this.tossCount} / ${this.targetTosses}`, cx, 140, '#ffd166');

    // Toss button
    const btn = this.tossBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = inSweet ? '#4CAF50' : '#e85d04';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🍳 HẤT CHẢO NGAY!', btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');
    ctx.restore();

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}

// ============================================================
// 8. LayerPourMinigame — ☕ Giữ & thả đúng vạch rót tầng Chè / Cà Phê
// ============================================================

interface PourLayer {
  name: string;
  color: string;
  targetTop: number; // 0..1 height of glass
}

export class LayerPourMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Nhấn GIỮ nút để rót — THẢ TAY đúng vạch vàng!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private layers: PourLayer[];
  private layerIdx = 0;
  private level = 0; // current fill 0..1
  private pouring = false;
  private pourSpeed: number;
  private perfectTol: number;
  private goodTol: number;
  private layerScores: number[] = [];
  private filledLayers: Array<{ from: number; to: number; color: string }> = [];
  private catQuote: string;

  private pourBtn: Rect = { x: 350, y: 368, width: 260, height: 54 };

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    this.pourSpeed = lerp(0.46, 0.78, d);
    this.perfectTol = lerp(0.08, 0.048, d);
    this.goodTol = lerp(0.16, 0.105, d);
    this.title = `☕ ${ctx.step.action} — ${ctx.recipe.name}`;

    const threeLayers = d > 0.45;
    if (ctx.recipe.id.includes('che_')) {
      this.layers = threeLayers
        ? [
            { name: 'Đậu đỏ bùi béo', color: '#b8323a', targetTop: 0.32 },
            { name: 'Đậu xanh đánh mịn', color: '#e9c46a', targetTop: 0.62 },
            { name: 'Thạch lá dứa & Cốt dừa', color: '#2d9348', targetTop: 0.88 },
          ]
        : [
            { name: 'Đậu đỏ & Đậu xanh', color: '#b8323a', targetTop: 0.45 },
            { name: 'Thạch lá dứa & Cốt dừa', color: '#2d9348', targetTop: 0.86 },
          ];
    } else if (ctx.recipe.id.includes('tra_da')) {
      this.layers = threeLayers
        ? [
            { name: 'Trà mạn đậm vị', color: '#b87d14', targetTop: 0.36 },
            { name: 'Nước trà thơm', color: '#e0a938', targetTop: 0.66 },
            { name: 'Đá lạnh mát rượi', color: '#90e0ef', targetTop: 0.9 },
          ]
        : [
            { name: 'Trà thơm vàng óng', color: '#d49a1a', targetTop: 0.55 },
            { name: 'Đá lạnh mát rượi', color: '#90e0ef', targetTop: 0.88 },
          ];
    } else {
      this.layers = threeLayers
        ? [
            { name: 'Sữa đặc Ông Thọ', color: '#f7ebd2', targetTop: 0.28 },
            { name: 'Cà phê phin đậm đà', color: '#4a2410', targetTop: 0.66 },
            { name: 'Bọt kem & Đá lạnh', color: '#d8a46c', targetTop: 0.9 },
          ]
        : [
            { name: 'Sữa đặc Ông Thọ', color: '#f7ebd2', targetTop: 0.36 },
            { name: 'Cà phê phin đậm đà', color: '#4a2410', targetTop: 0.86 },
          ];
    }

    // Add subtle randomized shift to each layer's target line so every pour requires focus!
    for (let i = 0; i < this.layers.length; i++) {
      const prev = i > 0 ? this.layers[i - 1].targetTop + 0.16 : 0.22;
      const next = i < this.layers.length - 1 ? this.layers[i + 1].targetTop - 0.16 : 0.92;
      this.layers[i].targetTop = clamp(this.layers[i].targetTop + randFloat(-0.06, 0.06), prev, next);
    }

    this.catQuote = `Giữ nút RÓT để đổ lớp "${this.layers[0].name}" tới đúng vạch vàng rồi thả tay nha!`;
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
    this.finishCurrentLayer();
  }

  private finishCurrentLayer(): void {
    const layer = this.layers[this.layerIdx];
    const prevTop = this.filledLayers.length > 0 ? this.filledLayers[this.filledLayers.length - 1].to : 0;
    const diff = Math.abs(this.level - layer.targetTop);

    const score =
      diff <= this.perfectTol ? 100
      : diff <= this.goodTol ? 78
      : 50;

    this.filledLayers.push({ from: prevTop, to: this.level, color: layer.color });
    this.layerScores.push(score);
    this.layerIdx++;

    const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
    const liquidY = 154 + 190 * (1 - this.level);
    if (score >= 85) {
      this.ctx.particles.emitStarburst(cx, liquidY, '#ffd166', 14);
    }

    if (this.layerIdx >= this.layers.length) {
      const avg = Math.round(this.layerScores.reduce((a, b) => a + b, 0) / this.layerScores.length);
      const grade = gradeFromScore(avg);
      this.ctx.particles.emitStarburst(cx, 230, '#4CAF50', 22);
      this.result = {
        score: avg,
        grade,
        catSpeaker: 'golden',
        catComment:
          grade === 'PERFECT'
            ? 'Phân tầng đẹp như hình chụp quảng cáo luôn!! Em thèm quá~ ☕✨'
            : 'Rót xong rồi, mát lạnh giải khát hết sẩy!',
      };
    } else {
      const next = this.layers[this.layerIdx];
      this.catQuote =
        score >= 85
          ? `Chuẩn từng giọt! Giờ giữ để rót tiếp "${next.name}" tới vạch trên nha!`
          : `Hơi lệch vạch xíu! Cố canh chuẩn lớp "${next.name}" nhé!`;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    if (this.pouring) {
      this.level = Math.min(1, this.level + this.pourSpeed * dt);
      const activeLayer = this.layers[this.layerIdx];
      if (activeLayer && Math.random() < dt * 24) {
        const cx = BOARD_RECT.x + BOARD_RECT.width / 2;
        const liquidY = 154 + 190 * (1 - this.level);
        this.ctx.particles.emitLiquidSplash(cx, liquidY, activeLayer.color, 2);
      }
      if (this.level >= 1) {
        this.pouring = false;
        this.finishCurrentLayer();
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
    const glassW = 112;
    const glassH = 190;
    const glassX = cx - glassW / 2;
    const glassY = 154;

    ctx.save();

    // Pouring stream from top when holding
    const activeLayer = this.layers[this.layerIdx];
    if (this.pouring && activeLayer) {
      ctx.fillStyle = activeLayer.color;
      ctx.fillRect(cx - 5, 128, 10, glassY + glassH * (1 - this.level) - 128);
    }

    // Glass backdrop
    roundRect(ctx, glassX, glassY, glassW, glassH, 12);
    ctx.fillStyle = 'rgba(216, 243, 252, 0.16)';
    ctx.fill();

    // Clip liquids inside glass
    ctx.save();
    roundRect(ctx, glassX + 4, glassY + 4, glassW - 8, glassH - 8, 8);
    ctx.clip();

    // Already completed layers
    for (const fl of this.filledLayers) {
      const yBottom = glassY + glassH * (1 - fl.from);
      const yTop = glassY + glassH * (1 - fl.to);
      ctx.fillStyle = fl.color;
      ctx.fillRect(glassX, yTop, glassW, yBottom - yTop + 1);
    }

    // Currently pouring active layer
    if (activeLayer) {
      const prevTop = this.filledLayers.length > 0 ? this.filledLayers[this.filledLayers.length - 1].to : 0;
      if (this.level > prevTop) {
        const yBottom = glassY + glassH * (1 - prevTop);
        const yTop = glassY + glassH * (1 - this.level);
        ctx.fillStyle = activeLayer.color;
        ctx.fillRect(glassX, yTop, glassW, yBottom - yTop + 1);
      }
    }
    ctx.restore();

    // Glass glossy outline
    roundRect(ctx, glassX, glassY, glassW, glassH, 12);
    ctx.strokeStyle = '#d8f3fc';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Target golden fill line for active layer!
    if (activeLayer) {
      const targetY = glassY + glassH * (1 - activeLayer.targetTop);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(glassX - 24, targetY);
      ctx.lineTo(glassX + glassW + 24, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, `← Vạch chuẩn (${activeLayer.name})`, glassX + glassW + 30, targetY, '#ffd166');
    }

    // Hold-to-pour button
    const btn = this.pourBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = this.pouring ? '#4CAF50' : '#2a9d8f';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.pouring ? '🫗 ĐANG RÓT... (THẢ ĐÚNG VẠCH!)' : '🫗 GIỮ ĐỂ RÓT!',
      btn.x + btn.width / 2,
      btn.y + btn.height / 2,
      '#fff',
    );
    ctx.restore();

    if (this.result) {
      renderResultStamp(ctx, this.result, this.finishTimer);
    }
  }
}
