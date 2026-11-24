// ============================================================
// FishingMinerScene — 🎣 Câu Cá Nghỉ Trưa (Gold-Miner Style!)
// Swing the fishing hook like classic Đào Vàng:
// - Reel in Golden Fish, Treasure Chests (+Money/Score)
// - Reel in Iced Tea & Fizzy Soda (+Customer Patience Drink Items!)
// - Avoid heavy low-value junk obstacles (Old Boots & Heavy Rocks)!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow } from '../../utils/draw';
import { clamp, formatMoney, randFloat } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

interface PondItem {
  x: number;
  y: number;
  vx: number; // fish swim gently!
  r: number;
  spriteKey: string;
  label: string;
  value: number;
  givesDrink: boolean;
  weight: number; // higher = slower reel-in!
  caught: boolean;
}

export class FishingMinerScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'summary' = 'intro';
  private elapsed = 0;
  private timeRemaining = 26;

  // Gold-miner pendulum hook physics
  private readonly pivotX = 480;
  private readonly pivotY = 166;
  private hookAngle = 0;
  private hookDir = 1;
  private hookLen = 42;
  private hookState: 'swing' | 'extend' | 'retract' = 'swing';
  private caughtItem: PondItem | null = null;

  private items: PondItem[] = [];
  private moneyEarned = 0;
  private drinksCaught = 0;
  private junkCaught = 0;

  private actionBtn: Rect = { x: 340, y: 434, width: 280, height: 54 };
  private dropBtn: Rect = { x: 380, y: 472, width: 200, height: 48 };
  private removeClick?: () => void;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(engine: Engine, onComplete: () => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('menu');
    this.engine.audio.playCatVoice('boss');
    this.phase = 'intro';
    this.elapsed = 0;
    this.timeRemaining = 26;
    this.hookAngle = 0;
    this.hookLen = 42;
    this.hookState = 'swing';
    this.caughtItem = null;
    this.moneyEarned = 0;
    this.drinksCaught = 0;
    this.junkCaught = 0;
    this.particles.clear();
    this.populatePond();

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
        return;
      }

      // Drop hook on tap anywhere!
      if (this.hookState === 'swing') {
        this.hookState = 'extend';
        this.engine.audio.playSfx('splash');
      }
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') {
        if (this.phase === 'intro') this.phase = 'playing';
        else if (this.phase === 'playing' && this.hookState === 'swing') {
          this.hookState = 'extend';
          this.engine.audio.playSfx('splash');
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  exit(): void {
    this.removeClick?.();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  private populatePond(): void {
    this.items = [
      // Swimming valuable fish
      { x: 240, y: 265, vx: 38, r: 28, spriteKey: 'fish_gold', label: 'Cá Vàng', value: 50, givesDrink: false, weight: 1.0, caught: false },
      { x: 680, y: 315, vx: -42, r: 30, spriteKey: 'fish_gold', label: 'Cá Vàng', value: 55, givesDrink: false, weight: 1.0, caught: false },
      { x: 420, y: 388, vx: 30, r: 36, spriteKey: 'fish_big', label: 'Cá Lóc Bự', value: 70, givesDrink: false, weight: 1.5, caught: false },
      // Patience-boosting Tea & Soda items!
      { x: 310, y: 335, vx: 0, r: 26, spriteKey: 'item_tea', label: 'Trà Đá (+Kiên nhẫn)', value: 15, givesDrink: true, weight: 0.85, caught: false },
      { x: 625, y: 260, vx: 0, r: 26, spriteKey: 'item_soda', label: 'Nước Ngọt (+Kiên nhẫn)', value: 15, givesDrink: true, weight: 0.85, caught: false },
      { x: 525, y: 428, vx: 0, r: 26, spriteKey: 'item_tea', label: 'Trà Đá (+Kiên nhẫn)', value: 15, givesDrink: true, weight: 0.9, caught: false },
      // Sunken Treasure Chest
      { x: 770, y: 448, vx: 0, r: 32, spriteKey: 'chest_gold', label: 'Rương Báu', value: 95, givesDrink: false, weight: 1.8, caught: false },
      // Heavy low-value junk obstacles!
      { x: 205, y: 425, vx: 0, r: 32, spriteKey: 'junk_rock', label: 'Đá Nặng', value: 4, givesDrink: false, weight: 2.9, caught: false },
      { x: 465, y: 310, vx: 0, r: 28, spriteKey: 'junk_boot', label: 'Ủng Rách', value: 2, givesDrink: false, weight: 2.5, caught: false },
      { x: 645, y: 412, vx: 0, r: 32, spriteKey: 'junk_rock', label: 'Đá Nặng', value: 4, givesDrink: false, weight: 2.9, caught: false },
      { x: 345, y: 454, vx: 0, r: 26, spriteKey: 'junk_boot', label: 'Ủng Cũ', value: 2, givesDrink: false, weight: 2.4, caught: false },
    ];
  }

  private getHookTip(): { x: number; y: number } {
    return {
      x: this.pivotX + Math.sin(this.hookAngle) * this.hookLen,
      y: this.pivotY + Math.cos(this.hookAngle) * this.hookLen,
    };
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
    if (this.phase !== 'playing') return;

    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishFishing();
      return;
    }

    // Gently swim active fish
    for (const it of this.items) {
      if (it.caught || it.vx === 0) continue;
      it.x += it.vx * dt;
      if (it.x < 110) { it.x = 110; it.vx = Math.abs(it.vx); }
      if (it.x > 850) { it.x = 850; it.vx = -Math.abs(it.vx); }
    }

    // Hook state machine
    if (this.hookState === 'swing') {
      this.hookAngle += this.hookDir * 1.42 * dt;
      if (this.hookAngle > 1.18) { this.hookAngle = 1.18; this.hookDir = -1; }
      if (this.hookAngle < -1.18) { this.hookAngle = -1.18; this.hookDir = 1; }
    } else if (this.hookState === 'extend') {
      this.hookLen += 420 * dt;
      const tip = this.getHookTip();

      // Check collision with pond items
      for (const it of this.items) {
        if (it.caught) continue;
        if (Math.hypot(tip.x - it.x, tip.y - it.y) <= it.r + 12) {
          it.caught = true;
          this.caughtItem = it;
          this.hookState = 'retract';
          this.engine.audio.playSfx(it.value <= 5 ? 'error' : 'pop');
          this.particles.emitLiquidSplash(tip.x, tip.y, '#90e0ef', 8);
          break;
        }
      }

      // Hit pond boundary
      if (tip.x < 30 || tip.x > 930 || tip.y > 520) {
        this.hookState = 'retract';
      }
    } else if (this.hookState === 'retract') {
      const pullSpeed = this.caughtItem ? clamp(390 / this.caughtItem.weight, 105, 420) : 490;
      this.hookLen -= pullSpeed * dt;

      if (this.hookLen <= 42) {
        this.hookLen = 42;
        this.hookState = 'swing';

        if (this.caughtItem) {
          const it = this.caughtItem;
          this.caughtItem = null;
          this.moneyEarned += it.value;

          if (it.givesDrink) {
            this.drinksCaught++;
            this.engine.audio.playSfx('perfect');
            this.particles.emitStarburst(this.pivotX, this.pivotY, '#7dd3fc', 16);
            this.particles.emitFloatingText(this.pivotX, this.pivotY - 24, `+1 🧋 ${it.label}!`, '#7dd3fc', 18);
          } else if (it.value <= 5) {
            this.junkCaught++;
            this.engine.audio.playSfx('error');
            this.particles.emitFloatingText(this.pivotX, this.pivotY - 22, `${it.label} (+${it.value}đ 😅)`, '#cbd5e1', 15);
          } else {
            this.engine.audio.playSfx('coin');
            this.particles.emitStarburst(this.pivotX, this.pivotY, '#ffd166', 16);
            this.particles.emitFloatingText(this.pivotX, this.pivotY - 24, `+${formatMoney(it.value)} 🐟!`, '#ffd166', 20);
          }

          // Check if pond cleared of all valuable items!
          const valuableLeft = this.items.some((x) => !x.caught && (x.value >= 15 || x.givesDrink));
          if (!valuableLeft) {
            this.finishFishing();
          }
        }
      }
    }
  }

  private finishFishing(): void {
    this.phase = 'summary';
    this.elapsed = 0;
    if (this.moneyEarned > 0) this.engine.save.addMoney(this.moneyEarned);
    if (this.drinksCaught > 0) this.engine.save.addTeaDrinks(this.drinksCaught);
    this.engine.audio.playSfx('win');
    this.engine.audio.playCatVoice('both');
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;

    // 1. Shimmering 16-bit Vietnamese Lotus Pond & Riverbed Background!
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_fishing_pond')) {
      ctx.drawImage(this.engine.assets.getImage('bg_fishing_pond'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0e4466';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Wooden Sampan Boat + Vằn Bếp Trưởng fishing at top-center!
    const boatBob = Math.sin(this.elapsed * 3) * 3;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.pivotX, 166 + boatBob, 78, 18, 0, 0, Math.PI);
    ctx.fillStyle = '#7f4f24';
    ctx.fill();
    ctx.strokeStyle = '#3d281c';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (this.engine.assets.hasImage('npc_cat_boss')) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage('npc_cat_boss');
      const dh = 92;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, this.pivotX - dw / 2, 78 + boatBob, dw, dh);
    }
    ctx.restore();

    // 3. Underwater items (fish, tea/soda drinks, treasure, heavy junk!)
    ctx.imageSmoothingEnabled = false;
    for (const it of this.items) {
      if (it.caught) continue;
      const bob = Math.sin(this.elapsed * 3.5 + it.x * 0.02) * 3;
      const size = it.r * 2.1;

      ctx.save();
      ctx.translate(it.x, it.y + bob);
      if (it.givesDrink) {
        // Sparkling cyan halo around patience-boost drinks!
        ctx.beginPath();
        ctx.arc(0, 0, it.r + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (it.vx < 0) ctx.scale(-1, 1);
      if (this.engine.assets.hasImage(it.spriteKey)) {
        ctx.drawImage(this.engine.assets.getImage(it.spriteKey), -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }

    // 4. Fishing Line, Hook & Reeled-in Item!
    const tip = this.getHookTip();
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.pivotX, this.pivotY);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Curved steel fishhook
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(-this.hookAngle);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0, Math.PI * 1.15);
    ctx.stroke();

    if (this.caughtItem && this.engine.assets.hasImage(this.caughtItem.spriteKey)) {
      ctx.imageSmoothingEnabled = false;
      const sz = this.caughtItem.r * 2;
      ctx.drawImage(this.engine.assets.getImage(this.caughtItem.spriteKey), -sz / 2, 4, sz, sz);
    }
    ctx.restore();
    ctx.restore();

    // 5. Top HUD Bar
    ctx.fillStyle = 'rgba(10, 12, 24, 0.78)';
    ctx.fillRect(0, 0, W, 52);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🎣 CÂU CÁ NGHỈ TRƯA (ĐÀO VÀNG)', 18, 26, '#FCA311');

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    drawTextShadow(ctx, `💰 +${formatMoney(this.moneyEarned)}   •   🧋 Trà/Nước: +${this.drinksCaught}`, 525, 26, '#7dd3fc');

    ctx.textAlign = 'right';
    ctx.font = 'bold 21px monospace';
    drawTextShadow(ctx, `⏱ ${Math.ceil(this.timeRemaining)}s`, W - 18, 26, this.timeRemaining < 6 ? '#E63946' : '#fff');

    // Bottom drop hook hint button while swinging
    if (this.phase === 'playing') {
      const db = this.dropBtn;
      roundRect(ctx, db.x, db.y, db.width, db.height, 14);
      ctx.fillStyle = this.hookState === 'swing' ? 'rgba(232, 93, 4, 0.92)' : 'rgba(30, 41, 59, 0.75)';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        this.hookState === 'swing' ? '🎣 THẢ CÂU NGAY!' : '⏳ Đang kéo cần...',
        db.x + db.width / 2,
        db.y + db.height / 2,
        '#fff',
      );
    }

    this.particles.render(ctx);

    if (this.phase === 'intro') {
      this.renderModal(
        ctx,
        '🎣 NGHỈ TRƯA CÂU CÁ — KIỂU ĐÀO VÀNG!',
        '#2A9D8F',
        '👑 Vằn Bếp Trưởng: "Trưa vắng khách mình ra bờ ao thư giãn câu cá nha! Chạm màn hình thả câu kéo Cá Vàng 🐟, Rương Báu 🎁 và đặc biệt là Trà Đá / Nước Ngọt 🧋 (dùng mời khách tăng ngay +50% kiên nhẫn)! Nhớ né Đá Nặng 🪨 & Ủng Rách 🥾 kẻo kéo chậm rì!"',
        '🎣 THẢ CẦN NGAY!',
      );
    } else if (this.phase === 'summary') {
      this.renderModal(
        ctx,
        '🎉 HẾT GIỜ NGHỈ TRƯA — THU HOẠCH ĐẦY GIỎ!',
        '#2d9348',
        `🐾 Mèo Vàng: "Quá đã luôn anh Vằn ơi! Tụi mình kiếm thêm +${formatMoney(this.moneyEarned)} và gom được +${this.drinksCaught} ly Trà Đá / Nước Ngọt (hiện có ${this.engine.save.current.teaDrinks ?? 0} ly trên quầy để mời khách tăng kiên nhẫn)!"${this.junkCaught > 0 ? ` (Trúng ${this.junkCaught} món rác nhẹ 😅)` : ''}`,
        '🍜 QUAY LẠI BÁN CA CHIỀU!',
      );
    }
  }

  private renderModal(ctx: CanvasRenderingContext2D, title: string, accent: string, text: string, cta: string): void {
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, 960, 540);
    roundRect(ctx, 150, 96, 660, 326, 20);
    ctx.fillStyle = '#1b1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 23px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, 480, 144, '#FCA311');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '15.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    const words = text.split(' ');
    let line = '';
    let cy = 188;
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
