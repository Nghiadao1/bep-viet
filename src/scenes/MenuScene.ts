// ============================================================
// MenuScene — Main menu with animated steam particles
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { randFloat, randInt } from '../utils/math';
import { MapScene } from './MapScene';
import { RecipeBookScene } from './RecipeBookScene';

interface SteamParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  drift: number;
}

interface MenuButton {
  label: string;
  rect: Rect;
  color: string;
  hoverColor: string;
}

export class MenuScene implements Scene {
  private engine: Engine;
  private particles: SteamParticle[] = [];
  private buttons: MenuButton[] = [];
  private removeClick?: () => void;
  private glowPhase = 0;
  private soundEnabled: boolean;

  constructor(engine: Engine) {
    this.engine = engine;
    this.soundEnabled = !engine.audio.muted;
  }

  enter(): void {
    this.engine.input.clear();
    this.soundEnabled = !this.engine.audio.muted;

    // Initialize steam particles
    this.particles = [];
    for (let i = 0; i < 30; i++) {
      this.particles.push(this.createParticle(true));
    }

    // Create buttons
    const cx = 480;
    const btnW = 240;
    const btnH = 50;
    const btnGap = 16;
    const startY = 310;

    this.buttons = [
      {
        label: '▶ Chơi',
        rect: { x: cx - btnW / 2, y: startY, width: btnW, height: btnH },
        color: '#E85D04',
        hoverColor: '#F48C06',
      },
      {
        label: '📖 Công Thức',
        rect: { x: cx - btnW / 2, y: startY + btnH + btnGap, width: btnW, height: btnH },
        color: '#2A9D8F',
        hoverColor: '#3AC4B4',
      },
      {
        label: this.soundEnabled ? '🔊 Âm thanh: BẬT' : '🔇 Âm thanh: TẮT',
        rect: { x: cx - btnW / 2, y: startY + (btnH + btnGap) * 2, width: btnW, height: btnH },
        color: '#6C757D',
        hoverColor: '#868E96',
      },
    ];

    // Input handling
    this.removeClick = this.engine.input.onClick((pos) => {
      // Play button → MapScene
      if (InputManager.hitTest(pos, this.buttons[0].rect)) {
        this.engine.audio.init(); // init audio on first user gesture
        this.engine.scenes.replace(new MapScene(this.engine));
        return;
      }
      // Recipe book button → RecipeBookScene
      if (InputManager.hitTest(pos, this.buttons[1].rect)) {
        this.engine.scenes.replace(new RecipeBookScene(this.engine));
        return;
      }
      // Settings button → toggle sound
      if (InputManager.hitTest(pos, this.buttons[2].rect)) {
        this.engine.audio.toggleMute();
        this.soundEnabled = !this.engine.audio.muted;
        this.buttons[2].label = this.soundEnabled ? '🔊 Âm thanh: BẬT' : '🔇 Âm thanh: TẮT';
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  private createParticle(randomY: boolean): SteamParticle {
    return {
      x: randFloat(100, 860),
      y: randomY ? randFloat(100, 540) : randFloat(520, 540),
      size: randFloat(3, 10),
      speed: randFloat(20, 60),
      alpha: randFloat(0.1, 0.4),
      drift: randFloat(-15, 15),
    };
  }

  update(dt: number): void {
    this.glowPhase += dt;

    // Update steam particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.y -= p.speed * dt;
      p.x += p.drift * dt;
      p.alpha -= 0.08 * dt;

      if (p.alpha <= 0 || p.y < -10) {
        this.particles[i] = this.createParticle(false);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;

    // --- Background gradient ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // --- Steam particles ---
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
    }

    // --- Title with glow ---
    const glowAlpha = 0.3 + 0.2 * Math.sin(this.glowPhase * 2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow
    ctx.shadowColor = '#FCA311';
    ctx.shadowBlur = 30 + 10 * Math.sin(this.glowPhase * 2);
    ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('🍜 Bếp Việt', W / 2, 160);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Subtitle
    ctx.font = '24px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + 0.1 * Math.sin(this.glowPhase * 1.5)})`;
    ctx.fillText('Vietnamese Street Kitchen', W / 2, 220);

    // Decorative line
    ctx.strokeStyle = `rgba(252, 163, 17, ${glowAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 120, 250);
    ctx.lineTo(W / 2 + 120, 250);
    ctx.stroke();

    ctx.restore();

    // --- Buttons ---
    for (const btn of this.buttons) {
      const { rect } = btn;
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);
      const color = hover ? btn.hoverColor : btn.color;

      // Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.restore();

      // Border
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        btn.label,
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        '#fff',
        'rgba(0,0,0,0.3)',
        1,
      );
    }

    // --- Version text ---
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('v1.0', W - 16, H - 10);
  }
}
