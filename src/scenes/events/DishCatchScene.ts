// ============================================================
// DishCatchScene — 🫧 Rửa Bát Đĩa (Hứng Bia Style Catcher!)
// Slide Mèo Vàng left/right to catch dirty dishes, sponges, and
// dish soap bottles while dodging bricks & jagged broken plates!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../../utils/draw';
import { clamp, formatMoney, randFloat, randPick } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

interface FallingObj {
  x: number;
  y: number;
  vy: number;
  rot: number;
  vrot: number;
  kind: 'dirty' | 'sponge' | 'soap' | 'brick' | 'broken';
  spriteKey: string;
  good: boolean;
  points: number;
}

export class DishCatchScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'summary' = 'intro';
  private elapsed = 0;
  private timeRemaining = 22;

  private catX = 480;
  private targetX = 480;
  private dragging = false;
  private moveDir = 0; // keyboard -1 / 0 / 1
  private hearts = 3;
  private invulnTimer = 0;
  private foamRushTimer = 0; // 2x bonus when catching dish soap!

  private washed = 0;
  private readonly targetWash = 14;
  private scoreMoney = 0;
  private objs: FallingObj[] = [];
  private spawnTimer = 0.45;

  private actionBtn: Rect = { x: 340, y: 434, width: 280, height: 54 };
  private removeDown?: () => void;
  private removeMove?: () => void;
  private removeUp?: () => void;
  private removeClick?: () => void;
  private keyDown?: (e: KeyboardEvent) => void;
  private keyUp?: (e: KeyboardEvent) => void;

  constructor(engine: Engine, onComplete: () => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('action');
    this.engine.audio.playCatVoice('golden');
    this.phase = 'intro';
    this.elapsed = 0;
    this.timeRemaining = 22;
    this.catX = 480;
    this.targetX = 480;
    this.hearts = 3;
    this.invulnTimer = 0;
    this.foamRushTimer = 0;
    this.washed = 0;
    this.scoreMoney = 0;
    this.objs = [];
    this.particles.clear();

    this.removeDown = this.engine.input.onDown((pos) => {
      if (this.phase !== 'playing') return;
      this.dragging = true;
      this.targetX = clamp(pos.x, 70, 890);
    });
    this.removeMove = this.engine.input.onMove((pos) => {
      if (this.phase !== 'playing') return;
      if (this.dragging || pos.x > 0) {
        this.targetX = clamp(pos.x, 70, 890);
      }
    });
    this.removeUp = this.engine.input.onUp(() => {
      this.dragging = false;
    });

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.engine.audio.playSfx('click');
          this.phase = 'playing';
        }
        return;
      }
      if (this.phase === 'summary') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.4) {
          this.engine.audio.playSfx('click');
          this.onComplete();
        }
      }
    });

    this.keyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.moveDir = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.moveDir = 1;
      else if (this.phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) this.phase = 'playing';
    };
    this.keyUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && this.moveDir === -1) this.moveDir = 0;
      if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && this.moveDir === 1) this.moveDir = 0;
    };
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
  }

  exit(): void {
    this.removeDown?.();
    this.removeMove?.();
    this.removeUp?.();
    this.removeClick?.();
    if (this.keyDown) window.removeEventListener('keydown', this.keyDown);
    if (this.keyUp) window.removeEventListener('keyup', this.keyUp);
  }

  private spawnItem(): void {
    const badRoll = Math.random();
    if (badRoll < 0.34) {
      const isBrick = Math.random() < 0.5;
      this.objs.push({
        x: randFloat(85, 875),
        y: 36,
        vy: randFloat(220, 315),
        rot: randFloat(-0.3, 0.3),
        vrot: randFloat(-3, 3),
        kind: isBrick ? 'brick' : 'broken',
        spriteKey: isBrick ? 'dish_brick' : 'dish_broken',
        good: false,
        points: 0,
      });
    } else {
      const pick = randPick<'dirty' | 'sponge' | 'soap'>(['dirty', 'dirty', 'sponge', 'soap']);
      this.objs.push({
        x: randFloat(85, 875),
        y: 36,
        vy: randFloat(190, 275),
        rot: randFloat(-0.2, 0.2),
        vrot: randFloat(-2, 2),
        kind: pick,
        spriteKey: pick === 'dirty' ? 'dish_dirty' : pick === 'sponge' ? 'dish_sponge' : 'dish_soap',
        good: true,
        points: pick === 'soap' ? 14 : pick === 'dirty' ? 10 : 8,
      });
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
    if (this.phase !== 'playing') return;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.foamRushTimer > 0) this.foamRushTimer = Math.max(0, this.foamRushTimer - dt);

    if (this.moveDir !== 0) {
      this.targetX = clamp(this.targetX + this.moveDir * 560 * dt, 70, 890);
    }
    this.catX += (this.targetX - this.catX) * Math.min(1, dt * 16);

    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishWash();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnItem();
      this.spawnTimer = randFloat(0.45, 0.72);
    }

    const tubY = 440;
    for (let i = this.objs.length - 1; i >= 0; i--) {
      const o = this.objs[i];
      o.y += o.vy * dt;
      o.rot += o.vrot * dt;

      // Catch collision with Mèo Vàng's soapy washbasin!
      if (Math.abs(o.y - tubY) < 36 && Math.abs(o.x - this.catX) < 62) {
        if (o.good) {
          this.washed++;
          const mult = this.foamRushTimer > 0 ? 2 : 1;
          const earn = o.points * mult;
          this.scoreMoney += earn;
          this.engine.audio.playSfx(o.kind === 'soap' ? 'perfect' : 'splash');
          this.particles.emitLiquidSplash(o.x, tubY - 10, '#e0f7ff', 10);
          if (o.kind === 'soap') {
            this.foamRushTimer = 4.5;
            this.particles.emitFloatingText(o.x, tubY - 34, '🫧 BỌT XÀ PHÒNG x2!!', '#7dd3fc', 18);
          } else {
            this.particles.emitFloatingText(o.x, tubY - 28, `+${earn}đ ✨`, '#80ed99', 16);
          }
          if (this.washed >= this.targetWash) {
            this.objs.splice(i, 1);
            this.finishWash();
            return;
          }
        } else if (this.invulnTimer <= 0) {
          this.hearts--;
          this.invulnTimer = 1.0;
          this.engine.audio.playSfx('error');
          this.particles.emitAngryPuff(o.x, tubY);
          this.particles.shake(7, 0.25);
          this.particles.emitFloatingText(
            o.x,
            tubY - 32,
            o.kind === 'brick' ? '💥 TRÚNG GẠCH!!' : '💥 BÁT VỠ!!',
            '#E63946',
            18,
          );
          if (this.hearts <= 0) {
            this.objs.splice(i, 1);
            this.finishWash();
            return;
          }
        }
        this.objs.splice(i, 1);
        continue;
      }

      if (o.y > 560) this.objs.splice(i, 1);
    }
  }

  private finishWash(): void {
    this.phase = 'summary';
    this.elapsed = 0;
    const bonus = this.washed >= this.targetWash ? 30 : 0;
    this.scoreMoney += bonus;
    if (this.scoreMoney > 0) this.engine.save.addMoney(this.scoreMoney);
    this.engine.audio.playSfx(this.hearts > 0 ? 'win' : 'lose');
    this.engine.audio.playCatVoice('golden');
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Cozy Pastel Tiled Kitchen Washroom Background!
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_dish_wash')) {
      ctx.drawImage(this.engine.assets.getImage('bg_dish_wash'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Falling items!
    for (const o of this.objs) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fillStyle = o.good ? 'rgba(76, 175, 80, 0.22)' : 'rgba(230, 57, 70, 0.3)';
      ctx.fill();
      if (this.engine.assets.hasImage(o.spriteKey)) {
        ctx.drawImage(this.engine.assets.getImage(o.spriteKey), -28, -28, 56, 56);
      }
      ctx.restore();
    }

    // 3. Mèo Vàng holding soapy wooden washbasin at bottom!
    const blinkHide = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 16) % 2 === 0;
    if (!blinkHide) {
      ctx.save();
      // Shadow
      ctx.beginPath();
      ctx.ellipse(this.catX, 502, 56, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // Mèo Vàng proudly holding the soapy tub (head clearly visible above the foam!)
      if (this.engine.assets.hasImage('npc_cat_golden')) {
        ctx.imageSmoothingEnabled = true;
        const img = this.engine.assets.getImage('npc_cat_golden');
        const dh = 96;
        const dw = (img.width / img.height) * dh;
        ctx.drawImage(img, this.catX - dw / 2, 376, dw, dh);
      }

      // Soapy wooden washbasin in front of Mèo Vàng!
      roundRect(ctx, this.catX - 58, 444, 116, 46, 16);
      ctx.fillStyle = this.foamRushTimer > 0 ? '#38bdf8' : '#b07d4f';
      ctx.fill();
      ctx.strokeStyle = this.foamRushTimer > 0 ? '#e0f7ff' : '#582f0e';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Sparkling white soap bubbles brimming on top of tub!
      for (let b = -38; b <= 38; b += 19) {
        ctx.beginPath();
        ctx.arc(this.catX + b, 444 + Math.sin(this.elapsed * 7 + b) * 2, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#e0f7ff';
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Top HUD Bar
    ctx.fillStyle = 'rgba(10, 12, 24, 0.8)';
    ctx.fillRect(0, 0, W, 52);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.foamRushTimer > 0 ? '🫧 RỬA BÁT x2 BỌT XÀ PHÒNG!!' : '🫧 RỬA BÁT ĐĨA (HỨNG ĐỒ RỬA)',
      18,
      26,
      this.foamRushTimer > 0 ? '#7dd3fc' : '#FCA311',
    );

    drawProgressBar(ctx, 396, 16, 196, 20, this.washed / this.targetWash, '#4CAF50');
    ctx.textAlign = 'center';
    ctx.font = 'bold 12.5px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`🍽️ ${this.washed}/${this.targetWash} sạch`, 494, 26);

    ctx.textAlign = 'right';
    ctx.font = '19px "Segoe UI"';
    ctx.fillText('❤️'.repeat(this.hearts) + '🖤'.repeat(3 - this.hearts), W - 110, 26);
    ctx.font = 'bold 20px monospace';
    drawTextShadow(ctx, `⏱ ${Math.ceil(this.timeRemaining)}s`, W - 18, 26, this.timeRemaining < 6 ? '#E63946' : '#fff');

    this.particles.render(ctx);

    if (this.phase === 'intro') {
      this.renderModal(
        ctx,
        '🫧 DỌN DẸP RỬA BÁT ĐĨA CUỐI CA!',
        '#2A9D8F',
        '🐾 Mèo Vàng: "Khách ăn xong để lại cả núi tô phở luôn! Di chuyển tay/chuột (hoặc ← →) đẩy chậu hứng Bát Bẩn 🍽️, Bọt Biển 🧽, Nước Rửa Chén 🧴 (nhân đôi điểm!) — nhớ NÉ Gạch Đá 🧱 và Bát Vỡ 💔 kẻo đứt tay nha!"',
        '🫧 BẮT ĐẦU RỬA BÁT!',
      );
    } else if (this.phase === 'summary') {
      this.renderModal(
        ctx,
        this.washed >= this.targetWash ? '✨ BÁT ĐĨA SẠCH BONG KIN KÍT!!' : '🫧 DỌN DẸP XONG CA RỒI!',
        '#2d9348',
        `👑 Vằn Bếp Trưởng: "Giỏi lắm Mèo Vàng! Rửa sạch ${this.washed} món, thưởng sạch sẽ +${formatMoney(this.scoreMoney)} cộng thẳng vào quỹ quán!"`,
        '🍜 TIẾP TỤC KINH DOANH!',
      );
    }

    ctx.restore();
  }

  private renderModal(ctx: CanvasRenderingContext2D, title: string, accent: string, text: string, cta: string): void {
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, 960, 540);
    roundRect(ctx, 150, 102, 660, 316, 20);
    ctx.fillStyle = '#1b1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 23px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, 480, 148, '#FCA311');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '15.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    const words = text.split(' ');
    let line = '';
    let cy = 194;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > 580 && line) {
        ctx.fillText(line.trim(), 190, cy);
        line = w + ' ';
        cy += 25;
      } else line = t;
    }
    if (line.trim()) ctx.fillText(line.trim(), 190, cy);

    const b = this.actionBtn;
    roundRect(ctx, b.x, b.y, b.width, b.height, 14);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, cta, b.x + b.width / 2, b.y + b.height / 2, '#fff');
  }
}
