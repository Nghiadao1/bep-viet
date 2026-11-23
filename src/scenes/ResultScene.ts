// ============================================================
// ResultScene — End-of-day results with star animation
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { formatMoney, randFloat } from '../utils/math';
import { TweenManager, Tween } from '../utils/animation';
import { GameScene } from './GameScene';
import { MapScene } from './MapScene';

export interface ResultData {
  levelId: number;
  dayName: string;
  customersServed: number;
  moneyEarned: number;
  stars: number;
  maxCombo: number;
  targetScore: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  alpha: number;
}

interface StarAnim {
  scale: number;
  alpha: number;
  revealed: boolean;
}

export class ResultScene implements Scene {
  private engine: Engine;
  private data: ResultData;
  private tweens = new TweenManager();

  // Animated values
  private moneyDisplay = { value: 0 };
  private servedDisplay = { value: 0 };
  private comboDisplay = { value: 0 };

  // Stars
  private starAnims: StarAnim[] = [];
  private starRevealTimer = 0;
  private starsRevealed = 0;

  // Confetti
  private confetti: ConfettiParticle[] = [];
  private showConfetti = false;

  // Buttons
  private buttons: { label: string; rect: Rect; color: string; action: string }[] = [];
  private removeClick?: () => void;

  // Timing
  private elapsed = 0;

  constructor(engine: Engine, data: ResultData) {
    this.engine = engine;
    this.data = data;
  }

  enter(): void {
    this.engine.input.clear();
    this.elapsed = 0;
    this.starsRevealed = 0;
    this.starRevealTimer = 0.8; // delay before first star

    // Prepare star animations
    this.starAnims = [];
    for (let i = 0; i < 3; i++) {
      this.starAnims.push({ scale: 0, alpha: 0, revealed: false });
    }

    // Animate numbers
    this.tweens.to(this.moneyDisplay, { value: this.data.moneyEarned }, 1200, 'easeOutQuad');
    this.tweens.to(this.servedDisplay, { value: this.data.customersServed }, 800, 'easeOutQuad');
    this.tweens.to(this.comboDisplay, { value: this.data.maxCombo }, 600, 'easeOutQuad');

    // Setup touch-friendly buttons
    const cx = 480;
    const btnW = 200;
    const btnH = 52;
    const btnGap = 18;
    const totalW = 3 * btnW + 2 * btnGap;
    const startX = cx - totalW / 2;
    const btnY = 434;

    this.buttons = [
      {
        label: '🔄 Chơi lại',
        rect: { x: startX, y: btnY, width: btnW, height: btnH },
        color: '#E85D04',
        action: 'retry',
      },
      {
        label: '▶ Level tiếp',
        rect: { x: startX + btnW + btnGap, y: btnY, width: btnW, height: btnH },
        color: '#4CAF50',
        action: 'next',
      },
      {
        label: '🗺 Bản đồ',
        rect: { x: startX + 2 * (btnW + btnGap), y: btnY, width: btnW, height: btnH },
        color: '#457B9D',
        action: 'map',
      },
    ];

    this.removeClick = this.engine.input.onClick((pos) => {
      for (const btn of this.buttons) {
        if (InputManager.hitTest(pos, btn.rect)) {
          this.handleAction(btn.action);
          return;
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
    this.tweens.clear();
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'retry': {
        this.engine.scenes.replace(new GameScene(this.engine, this.data.levelId));
        break;
      }
      case 'next': {
        this.engine.scenes.replace(new GameScene(this.engine, this.data.levelId + 1));
        break;
      }
      case 'map': {
        this.engine.scenes.replace(new MapScene(this.engine));
        break;
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.tweens.update(dt);

    // Star reveal sequence
    this.starRevealTimer -= dt;
    if (this.starRevealTimer <= 0 && this.starsRevealed < this.data.stars) {
      const idx = this.starsRevealed;
      this.starAnims[idx].revealed = true;

      // Bounce-in tween
      this.tweens.to(this.starAnims[idx] as any, { scale: 1, alpha: 1 }, 500, 'easeOutBack');

      this.starsRevealed++;
      this.starRevealTimer = 0.4;

      // If last star and 3 stars → start confetti
      if (this.starsRevealed === 3 && this.data.stars === 3) {
        this.showConfetti = true;
        this.spawnConfetti();
      }
    }

    // Update confetti
    if (this.showConfetti) {
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const p = this.confetti[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt; // gravity
        p.rotation += p.rotSpeed * dt;
        p.alpha -= 0.3 * dt;
        if (p.alpha <= 0 || p.y > 600) {
          this.confetti.splice(i, 1);
        }
      }
      // Keep spawning for a bit
      if (this.confetti.length < 60 && this.elapsed < 6) {
        this.spawnConfetti(5);
      }
    }
  }

  private spawnConfetti(count = 30): void {
    const colors = ['#E63946', '#F4A261', '#2A9D8F', '#E9C46A', '#457B9D', '#FCA311'];
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: randFloat(200, 760),
        y: randFloat(-20, 100),
        vx: randFloat(-120, 120),
        vy: randFloat(-200, -50),
        size: randFloat(4, 10),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: randFloat(0, Math.PI * 2),
        rotSpeed: randFloat(-5, 5),
        alpha: 1,
      });
    }
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

    // --- Title ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `${this.data.dayName} — Kết thúc!`, W / 2, 60, '#FCA311');

    // --- Stars ---
    const starCx = W / 2;
    const starY = 130;
    const starGap = 70;

    for (let i = 0; i < 3; i++) {
      const anim = this.starAnims[i];
      const x = starCx + (i - 1) * starGap;

      ctx.save();
      ctx.translate(x, starY);
      ctx.scale(anim.scale, anim.scale);
      ctx.globalAlpha = anim.alpha;

      ctx.font = '48px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (anim.revealed) {
        ctx.fillText('⭐', 0, 0);
      } else {
        ctx.fillStyle = '#333';
        ctx.fillText('☆', 0, 0);
      }

      ctx.restore();
    }

    // Show empty stars behind
    for (let i = 0; i < 3; i++) {
      if (!this.starAnims[i].revealed) {
        const x = starCx + (i - 1) * starGap;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '48px "Segoe UI"';
        ctx.fillStyle = '#333';
        ctx.fillText('☆', x, starY);
      }
    }

    // --- Stats card ---
    const cardX = W / 2 - 200;
    const cardY = 190;
    const cardW = 400;
    const cardH = 200;

    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const lines = [
      { label: '👥 Khách phục vụ:', value: `${Math.floor(this.servedDisplay.value)}` },
      { label: '💰 Tiền kiếm được:', value: formatMoney(Math.floor(this.moneyDisplay.value)) },
      { label: '🎯 Mục tiêu:', value: formatMoney(this.data.targetScore) },
      { label: '🔥 Combo cao nhất:', value: `x${Math.floor(this.comboDisplay.value)}` },
    ];

    for (let i = 0; i < lines.length; i++) {
      const ly = cardY + 40 + i * 42;
      ctx.textAlign = 'left';
      ctx.font = '18px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(lines[i].label, cardX + 30, ly);

      ctx.textAlign = 'right';
      ctx.font = 'bold 20px monospace';
      drawTextShadow(ctx, lines[i].value, cardX + cardW - 30, ly, '#FCA311');
    }

    // --- Buttons ---
    for (const btn of this.buttons) {
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, btn.rect);

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      roundRect(ctx, btn.rect.x, btn.rect.y, btn.rect.width, btn.rect.height, 10);
      ctx.fillStyle = hover ? btn.color : this.darken(btn.color, 0.2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();

      roundRect(ctx, btn.rect.x, btn.rect.y, btn.rect.width, btn.rect.height, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, btn.label, btn.rect.x + btn.rect.width / 2, btn.rect.y + btn.rect.height / 2);
    }

    // --- Confetti ---
    for (const p of this.confetti) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
  }

  private darken(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - amount))}, ${Math.floor(g * (1 - amount))}, ${Math.floor(b * (1 - amount))})`;
  }
}
