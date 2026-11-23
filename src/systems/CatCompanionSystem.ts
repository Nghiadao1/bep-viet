// ============================================================
// CatCompanionSystem — Continuous Live Interaction Widget
// Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp react live to everything
// the player does in the kitchen and can be tapped for hearts!
// ============================================================

import type { Engine } from '../core/Engine';
import type { Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect } from '../utils/draw';
import { randPick } from '../utils/math';

export type CatSpeaker = 'boss' | 'golden' | 'both';

interface FloatingHeart {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  emoji: string;
}

const IDLE_BANTER: Array<{ speaker: CatSpeaker; text: string }> = [
  { speaker: 'golden', text: 'Anh Vằn ơi mùi phở thơm quá, cho em nếm miếng xíu nha~ 😋' },
  { speaker: 'boss', text: 'Tập trung nấu cho khách đi Mèo Vàng, lát đóng quán ta nấu riêng cho!' },
  { speaker: 'golden', text: 'Khách hôm nay đông ghê! Cố kiếm 3 sao mở khóa vùng mới nhé! ⭐' },
  { speaker: 'boss', text: 'Nhớ xem kỹ phiếu khẩu vị khách nha — đừng rắc hành vào tô người ghét hành!' },
  { speaker: 'golden', text: 'Chạm vào tụi em bất cứ lúc nào để nạp năng lượng Meow nha! 💕' },
];

const PET_RESPONSES: Array<{ speaker: CatSpeaker; text: string }> = [
  { speaker: 'golden', text: 'Meo meo~ Gãi cằm đã quá! Chúc bạn nấu món nào PERFECT món đó! 💕' },
  { speaker: 'boss', text: '(Tai cụp rung rinh) Hừm... vuốt đầu xong rồi thì lo canh lửa kẻo cháy nha! 😸' },
  { speaker: 'golden', text: 'Yêu đầu bếp nhất luôn! Em cổ vũ hết mình nè!! 🐾✨' },
  { speaker: 'boss', text: 'Meow~ Cố lên cộng sự! Cuốn Sổ Vị Giác sắp hoàn thành rồi! 👑' },
];

export class CatCompanionSystem {
  private engine: Engine;
  private speaker: CatSpeaker = 'boss';
  private message = 'Chào mừng vào bếp! Chạm thẻ món bên dưới để bắt đầu nấu nhé!';
  private messageTimer = 5.0;
  private idleTimer = 11.0;
  private elapsed = 0;
  private bounceBoss = 0;
  private bounceGolden = 0;
  private hearts: FloatingHeart[] = [];

  // Dedicated Cat Kitchen Booth on the right side of the wooden counter!
  readonly boothRect: Rect = { x: 760, y: 108, width: 190, height: 84 };

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /** Make either cat (or both) react immediately with a speech bubble */
  say(speaker: CatSpeaker, text: string, duration = 4.2): void {
    this.speaker = speaker;
    this.message = text;
    this.messageTimer = duration;
    this.idleTimer = 11.0;
    if (speaker === 'boss' || speaker === 'both') this.bounceBoss = 0.45;
    if (speaker === 'golden' || speaker === 'both') this.bounceGolden = 0.45;
  }

  /** Handle tapping the cats for cute meow encouragement & floating hearts! */
  handleClick(pos: Vec2): boolean {
    if (!InputManager.hitTest(pos, this.boothRect, 6)) return false;

    const reply = randPick(PET_RESPONSES);
    this.say(reply.speaker, reply.text, 3.6);

    for (let i = 0; i < 4; i++) {
      this.hearts.push({
        x: pos.x + (Math.random() - 0.5) * 44,
        y: pos.y - 6,
        vy: -38 - Math.random() * 24,
        alpha: 1,
        emoji: i % 2 === 0 ? '💕' : '✨',
      });
    }
    return true;
  }

  update(dt: number): void {
    this.elapsed += dt;

    if (this.bounceBoss > 0) this.bounceBoss = Math.max(0, this.bounceBoss - dt);
    if (this.bounceGolden > 0) this.bounceGolden = Math.max(0, this.bounceGolden - dt);

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
    } else {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        const banter = randPick(IDLE_BANTER);
        this.say(banter.speaker, banter.text, 4.5);
      }
    }

    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.y += h.vy * dt;
      h.alpha -= 0.9 * dt;
      if (h.alpha <= 0) this.hearts.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const r = this.boothRect;
    ctx.save();

    // Subtle wooden booth highlight behind the 2 resident chef cats
    roundRect(ctx, r.x, r.y + 8, r.width, r.height - 6, 12);
    ctx.fillStyle = 'rgba(17, 19, 38, 0.48)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.imageSmoothingEnabled = true;

    // Left cat in booth: Vằn Bếp Trưởng
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const img = this.engine.assets.getImage('npc_cat_boss');
      const jump = this.bounceBoss > 0 ? Math.sin((this.bounceBoss / 0.45) * Math.PI) * -14 : 0;
      const idle = Math.sin(this.elapsed * 2.5) * 2;
      const dh = 82;
      const dw = (img.width / img.height) * dh;
      ctx.save();
      if (this.speaker === 'boss' || this.speaker === 'both') {
        ctx.shadowColor = 'rgba(252, 163, 17, 0.55)';
        ctx.shadowBlur = 10;
      }
      ctx.drawImage(img, r.x + 8, r.y + r.height - dh + 4 + jump + idle, dw, dh);
      ctx.restore();
    }

    // Right cat in booth: Mèo Vàng Phụ Bếp
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const jump = this.bounceGolden > 0 ? Math.sin((this.bounceGolden / 0.45) * Math.PI) * -14 : 0;
      const idle = Math.sin(this.elapsed * 2.5 + 1.3) * 2;
      const dh = 72;
      const dw = (img.width / img.height) * dh;
      ctx.save();
      if (this.speaker === 'golden' || this.speaker === 'both') {
        ctx.shadowColor = 'rgba(244, 162, 97, 0.6)';
        ctx.shadowBlur = 10;
      }
      ctx.drawImage(img, r.x + r.width - dw - 6, r.y + r.height - dh + 4 + jump + idle, dw, dh);
      ctx.restore();
    }

    // Compact live speech bubble right above the Cat Booth (y = 54..108)
    if (this.messageTimer > 0 && this.message) {
      const alpha = Math.min(1, this.messageTimer * 2);
      const bw = 278;
      const bh = 52;
      const bx = 950 - bw;
      const by = 54;

      ctx.save();
      ctx.globalAlpha = alpha;

      roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fillStyle = 'rgba(17, 19, 38, 0.94)';
      ctx.fill();
      ctx.strokeStyle = this.speaker === 'boss' ? '#FCA311' : this.speaker === 'golden' ? '#F4A261' : '#4CAF50';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pointer tail down to the speaking cat
      const tailX = this.speaker === 'golden' ? r.x + r.width - 42 : r.x + 48;
      ctx.beginPath();
      ctx.moveTo(tailX - 6, by + bh);
      ctx.lineTo(tailX, by + bh + 8);
      ctx.lineTo(tailX + 6, by + bh);
      ctx.fillStyle = 'rgba(17, 19, 38, 0.94)';
      ctx.fill();

      // Speaker tag + wrapped concise text
      const name =
        this.speaker === 'boss' ? '👑 Vằn:'
        : this.speaker === 'golden' ? '🐾 Mèo Vàng:'
        : '👑🐾 Hai Mèo:';

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = this.speaker === 'boss' ? '#FCA311' : '#F4A261';
      ctx.fillText(name, bx + 9, by + 6);

      ctx.font = '11.5px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#fffcf5';
      this.wrapLines(ctx, this.message, bx + 9, by + 20, bw - 18, 14, 2);

      ctx.restore();
    }

    // Floating hearts when player taps the cats!
    for (const h of this.hearts) {
      ctx.save();
      ctx.globalAlpha = h.alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '20px "Segoe UI"';
      ctx.fillText(h.emoji, h.x, h.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private wrapLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let row = 0;

    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        if (row === maxLines - 1) {
          ctx.fillText(`${line.trim()}…`, x, y + row * lineHeight);
          return;
        }
        ctx.fillText(line.trim(), x, y + row * lineHeight);
        line = words[i] + ' ';
        row++;
      } else {
        line = test;
      }
    }
    if (line.trim() && row < maxLines) {
      ctx.fillText(line.trim(), x, y + row * lineHeight);
    }
  }
}
