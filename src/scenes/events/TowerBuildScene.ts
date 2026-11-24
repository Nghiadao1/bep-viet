// ============================================================
// TowerBuildScene — 🏗️ Xây / Nâng Cấp Nhà Hàng (Tower Bloxx Style!)
// Triggered when expanding the restaurant in Shop (or Event Hub):
// Swing each Vietnamese restaurant floor on a crane rope and tap
// at the exact moment to stack 5 floors into a grand restaurant!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow } from '../../utils/draw';
import { formatMoney } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

interface PlacedFloor {
  x: number;
  y: number; // world Y (ground = 468, grows upward)
  spriteKey: string;
  perfect: boolean;
}

export class TowerBuildScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private targetName: string;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'won' | 'failed' = 'intro';
  private elapsed = 0;

  private readonly floorW = 164;
  private readonly floorH = 68;
  private readonly targetFloors = 5;
  private readonly groundY = 464;

  private placed: PlacedFloor[] = [];
  private lives = 3;
  private cameraY = 0; // scrolls up smoothly as tower grows!
  private targetCameraY = 0;
  private perfectCount = 0;
  private bonusMoney = 0;

  // Swinging / Falling Floor State
  private craneState: 'swing' | 'drop' | 'tumble' = 'swing';
  private swingAngle = 0;
  private activeX = 480;
  private activeY = 128;
  private dropVy = 0;
  private tumbleVx = 0;
  private tumbleRot = 0;

  private actionBtn: Rect = { x: 340, y: 434, width: 280, height: 54 };
  private removeClick?: () => void;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(engine: Engine, targetName = 'Nhà Hàng Bếp Việt Mới', onComplete: () => void) {
    this.engine = engine;
    this.targetName = targetName;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('kitchen');
    this.engine.audio.playCatVoice('boss');
    this.phase = 'intro';
    this.elapsed = 0;
    this.placed = [];
    this.lives = 3;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.perfectCount = 0;
    this.bonusMoney = 0;
    this.craneState = 'swing';
    this.swingAngle = 0;
    this.particles.clear();

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.engine.audio.playSfx('click');
          this.phase = 'playing';
        }
        return;
      }

      if (this.phase === 'won' || this.phase === 'failed') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.4) {
          this.engine.audio.playSfx('click');
          this.onComplete();
        }
        return;
      }

      // Drop hanging floor on tap anywhere!
      if (this.craneState === 'swing') {
        this.releaseFloor();
      }
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        if (this.phase === 'intro') this.phase = 'playing';
        else if (this.phase === 'playing' && this.craneState === 'swing') this.releaseFloor();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  exit(): void {
    this.removeClick?.();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  private getCurrentSpriteKey(): string {
    const idx = this.placed.length;
    if (idx === this.targetFloors - 1) return 'floor_roof';
    if (idx % 3 === 0) return 'floor_1';
    if (idx % 3 === 1) return 'floor_2';
    return 'floor_3';
  }

  private releaseFloor(): void {
    this.craneState = 'drop';
    this.dropVy = 40;
    this.engine.audio.playSfx('pop');
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * 6);

    if (this.phase !== 'playing') return;

    const pivotWorldY = 58 - this.cameraY;
    const ropeLen = 112;

    if (this.craneState === 'swing') {
      const speed = 2.1 + this.placed.length * 0.25;
      this.swingAngle = Math.sin(this.elapsed * speed) * 0.68;
      this.activeX = 480 + Math.sin(this.swingAngle) * ropeLen * 2.1;
      this.activeY = pivotWorldY + Math.cos(this.swingAngle) * ropeLen;
    } else if (this.craneState === 'drop') {
      this.dropVy += 1150 * dt;
      this.activeY += this.dropVy * dt;

      const topFloor = this.placed[this.placed.length - 1];
      const landingY = topFloor ? topFloor.y - this.floorH : this.groundY - this.floorH;
      const targetCenterX = topFloor ? topFloor.x : 480;

      if (this.activeY >= landingY) {
        const dx = this.activeX - targetCenterX;
        if (Math.abs(dx) <= this.floorW * 0.52) {
          // Landed cleanly on stack!
          const isPerfect = Math.abs(dx) <= 18;
          const snappedX = isPerfect ? targetCenterX : this.activeX;
          this.placed.push({
            x: snappedX,
            y: landingY,
            spriteKey: this.getCurrentSpriteKey(),
            perfect: isPerfect,
          });

          const screenY = landingY + this.cameraY + this.floorH / 2;
          if (isPerfect) {
            this.perfectCount++;
            this.bonusMoney += 30;
            this.engine.audio.playSfx('perfect');
            this.particles.emitStarburst(snappedX, screenY, '#ffd166', 20);
            this.particles.emitFloatingText(snappedX, screenY - 24, '⭐ XẾP CHUẨN +30đ!', '#ffd166', 20);
          } else {
            this.bonusMoney += 15;
            this.engine.audio.playSfx('punch');
            this.particles.emitSliceSparks(snappedX, screenY + 26, '#e9c46a', 10);
            this.particles.emitFloatingText(snappedX, screenY - 20, '👍 Khớp tầng! +15đ', '#80ed99', 16);
          }

          // Scroll camera smoothly up after floor 2!
          if (this.placed.length >= 2) {
            this.targetCameraY = (this.placed.length - 1) * this.floorH;
          }

          if (this.placed.length >= this.targetFloors) {
            this.phase = 'won';
            this.elapsed = 0;
            this.bonusMoney += 50;
            this.engine.save.addMoney(this.bonusMoney);
            this.engine.audio.playSfx('win');
            this.engine.audio.playCatVoice('both');
            this.particles.emitStarburst(480, 220, '#ffd166', 36);
            return;
          }

          this.craneState = 'swing';
        } else {
          // Missed completely — tumbles off!
          this.craneState = 'tumble';
          this.tumbleVx = dx > 0 ? 150 : -150;
          this.tumbleRot = 0;
          this.lives--;
          this.engine.audio.playSfx('error');
          this.particles.shake(7, 0.25);
          this.particles.emitAngryPuff(this.activeX, landingY + this.cameraY);
        }
      }
    } else if (this.craneState === 'tumble') {
      this.dropVy += 980 * dt;
      this.activeX += this.tumbleVx * dt;
      this.activeY += this.dropVy * dt;
      this.tumbleRot += (this.tumbleVx > 0 ? 4 : -4) * dt;

      if (this.activeY + this.cameraY > 620) {
        if (this.lives <= 0) {
          this.phase = 'failed';
          this.elapsed = 0;
          if (this.bonusMoney > 0) this.engine.save.addMoney(this.bonusMoney);
          this.engine.audio.playSfx('lose');
        } else {
          this.craneState = 'swing';
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Sunset Saigon Construction Sky Background
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_tower_build')) {
      ctx.drawImage(this.engine.assets.getImage('bg_tower_build'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#2a1b3d';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. World-space stacked tower & concrete foundation (scrolled by cameraY!)
    ctx.save();
    ctx.translate(0, this.cameraY);

    // Concrete foundation pad
    roundRect(ctx, 480 - this.floorW / 2 - 14, this.groundY, this.floorW + 28, 26, 6);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stacked Vietnamese restaurant floors!
    for (const fl of this.placed) {
      if (this.engine.assets.hasImage(fl.spriteKey)) {
        ctx.drawImage(
          this.engine.assets.getImage(fl.spriteKey),
          fl.x - this.floorW / 2,
          fl.y,
          this.floorW,
          this.floorH,
        );
      }
    }

    // Active swinging / dropping floor + crane cable
    if (this.phase === 'playing') {
      const pivotWorldY = 58 - this.cameraY;
      if (this.craneState === 'swing') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(480, pivotWorldY);
        ctx.lineTo(this.activeX, this.activeY);
        ctx.stroke();

        // Crane hook circle
        ctx.beginPath();
        ctx.arc(this.activeX, this.activeY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#e85d04';
        ctx.fill();
      }

      const spr = this.getCurrentSpriteKey();
      ctx.save();
      ctx.translate(this.activeX, this.activeY + this.floorH / 2);
      if (this.craneState === 'tumble') ctx.rotate(this.tumbleRot);
      if (this.engine.assets.hasImage(spr)) {
        ctx.drawImage(this.engine.assets.getImage(spr), -this.floorW / 2, -this.floorH / 2, this.floorW, this.floorH);
      }
      ctx.restore();
    }
    ctx.restore();

    // 3. Top HUD Bar
    ctx.fillStyle = 'rgba(10, 12, 24, 0.8)';
    ctx.fillRect(0, 0, W, 52);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `🏗️ XÂY ${this.targetName.toUpperCase()}`, 18, 26, '#FCA311');

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    drawTextShadow(ctx, `🏢 Tầng: ${this.placed.length} / ${this.targetFloors}  •  ⭐ Chuẩn: ${this.perfectCount}`, 540, 26, '#80ed99');

    ctx.textAlign = 'right';
    ctx.font = '19px "Segoe UI"';
    ctx.fillText('❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives), W - 20, 26);

    // Bottom hint pill
    if (this.phase === 'playing' && this.craneState === 'swing') {
      roundRect(ctx, 330, 482, 300, 42, 12);
      ctx.fillStyle = 'rgba(232, 93, 4, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '🏗️ CHẠM MÀN HÌNH ĐỂ THẢ TẦNG!', 480, 503, '#fff');
    }

    this.particles.render(ctx);

    if (this.phase === 'intro') {
      this.renderModal(
        ctx,
        `🏗️ KHỞI CÔNG XÂY ${this.targetName.toUpperCase()}!`,
        '#E85D04',
        '👑 Vằn Bếp Trưởng: "Tới lúc mở rộng cơ ngơi rồi! Từng tầng nhà hàng sẽ đung đưa trên dây cần cẩu — hãy chạm đúng nhịp để thả chồng khít lên nhau đủ 5 tầng nhé!"',
        '🏗️ KÉO CẦN CẨU XÂY NGAY!',
      );
    } else if (this.phase === 'won') {
      this.renderModal(
        ctx,
        '🎉 KHÁNH THÀNH NHÀ HÀNG MỚI HOÀNH TRÁNG!!',
        '#2d9348',
        `🐾 Mèo Vàng: "Hoàn thành cả ${this.targetFloors} tầng nhà hàng rực rỡ đèn lồng (${this.perfectCount} tầng cân chuẩn ⭐)!! Nhận thưởng khánh thành +${formatMoney(this.bonusMoney)}!"`,
        '🍜 KHAI TRƯƠNG QUÁN MỚI!',
      );
    } else if (this.phase === 'failed') {
      this.renderModal(
        ctx,
        '😅 HƠI LỆCH MỘT CHÚT — VẪN MỞ QUÁN ĐƯỢC!',
        '#D97706',
        `👑 Vằn Bếp Trưởng: "Xây được ${this.placed.length} tầng rồi đó! Thợ mèo tạm hoàn thiện mặt bằng (+${formatMoney(this.bonusMoney)}) để kịp đón khách nào!"`,
        '🍜 VÀO QUÁN BÁN TIẾP!',
      );
    }

    ctx.restore();
  }

  private renderModal(ctx: CanvasRenderingContext2D, title: string, accent: string, text: string, cta: string): void {
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, 960, 540);
    roundRect(ctx, 150, 108, 660, 310, 20);
    ctx.fillStyle = '#1b1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 23px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, 480, 154, '#FCA311');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    const words = text.split(' ');
    let line = '';
    let cy = 204;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > 580 && line) {
        ctx.fillText(line.trim(), 190, cy);
        line = w + ' ';
        cy += 26;
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
