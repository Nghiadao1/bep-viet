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
import { GameScene } from './GameScene';
import { ShopScene } from './ShopScene';
import { isFullscreen, supportsFullscreen, toggleFullscreen } from '../utils/mobile';

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
  private fullscreenBtn: Rect = { x: 800, y: 16, width: 144, height: 42 };
  private muteBtn: Rect = { x: 18, y: 16, width: 126, height: 42 };
  private removeClick?: () => void;
  private glowPhase = 0;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('menu');

    // Initialize steam particles
    this.particles = [];
    for (let i = 0; i < 30; i++) {
      this.particles.push(this.createParticle(true));
    }

    // Create large mobile-friendly touch buttons
    const cx = 480;
    const btnW = 280;
    const btnH = 48;
    const btnGap = 12;
    const startY = 276;

    this.buttons = [
      {
        label: '▶ Chơi (Bản đồ VN)',
        rect: { x: cx - btnW / 2, y: startY, width: btnW, height: btnH },
        color: '#E85D04',
        hoverColor: '#F48C06',
      },
      {
        label: '🐾 Hướng dẫn cùng Mèo',
        rect: { x: cx - btnW / 2, y: startY + btnH + btnGap, width: btnW, height: btnH },
        color: '#D97706',
        hoverColor: '#F59E0B',
      },
      {
        label: '🏪 Tiệm Nâng Cấp',
        rect: { x: cx - btnW / 2, y: startY + (btnH + btnGap) * 2, width: btnW, height: btnH },
        color: '#2d9348',
        hoverColor: '#4CAF50',
      },
      {
        label: '📖 Công Thức',
        rect: { x: cx - btnW / 2, y: startY + (btnH + btnGap) * 3, width: btnW, height: btnH },
        color: '#2A9D8F',
        hoverColor: '#3AC4B4',
      },
    ];

    // Input handling
    this.removeClick = this.engine.input.onClick((pos) => {
      // Mute / Sound toggle button top-left
      if (InputManager.hitTest(pos, this.muteBtn, 8)) {
        this.engine.audio.toggleMute();
        return;
      }
      // Fullscreen toggle (mobile convenience)
      if (supportsFullscreen() && InputManager.hitTest(pos, this.fullscreenBtn, 8)) {
        this.engine.audio.playSfx('click');
        void toggleFullscreen();
        return;
      }
      // Play button → Vietnam MapScene
      if (InputManager.hitTest(pos, this.buttons[0].rect, 4)) {
        this.engine.audio.unlock();
        this.engine.audio.playSfx('click');
        this.engine.scenes.replace(new MapScene(this.engine));
        return;
      }
      // Tutorial button → Level 1 with 2-Cat NPC Tutorial
      if (InputManager.hitTest(pos, this.buttons[1].rect, 4)) {
        this.engine.audio.unlock();
        this.engine.audio.playSfx('meow');
        this.engine.scenes.replace(new GameScene(this.engine, 1, true));
        return;
      }
      // Shop button → ShopScene
      if (InputManager.hitTest(pos, this.buttons[2].rect, 4)) {
        this.engine.audio.playSfx('click');
        this.engine.scenes.replace(new ShopScene(this.engine, 'menu'));
        return;
      }
      // Recipe book button → RecipeBookScene
      if (InputManager.hitTest(pos, this.buttons[3].rect, 4)) {
        this.engine.audio.playSfx('click');
        this.engine.scenes.replace(new RecipeBookScene(this.engine));
        return;
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

    // --- Pixel art Sài Gòn background ---
    if (this.engine.assets.hasImage('bg_saigon')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.engine.assets.getImage('bg_saigon'), 0, 0, W, H);
      // Warm atmospheric dark vignette so menu title & buttons pop clearly
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(17, 19, 38, 0.55)');
      grad.addColorStop(0.5, 'rgba(22, 24, 48, 0.45)');
      grad.addColorStop(1, 'rgba(15, 16, 30, 0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1a1a2e');
      grad.addColorStop(0.5, '#16213e');
      grad.addColorStop(1, '#0f3460');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // --- Showcase floating pixel art Vietnamese dishes flanking the menu ---
    const showcaseDishes: Array<{ key: string; x: number; y: number; phase: number }> = [
      { key: 'food_pho_bo', x: 110, y: 170, phase: 0 },
      { key: 'food_banh_mi_thit', x: 170, y: 315, phase: 1.2 },
      { key: 'food_ca_phe_sua_da', x: 95, y: 420, phase: 2.4 },
      { key: 'food_com_tam', x: 770, y: 175, phase: 0.7 },
      { key: 'food_bun_bo_hue', x: 715, y: 315, phase: 1.9 },
      { key: 'food_che_ba_mau', x: 790, y: 420, phase: 3.1 },
    ];
    ctx.imageSmoothingEnabled = false;
    for (const item of showcaseDishes) {
      if (!this.engine.assets.hasImage(item.key)) continue;
      const bobY = Math.sin(this.glowPhase * 2 + item.phase) * 6;
      ctx.drawImage(this.engine.assets.getImage(item.key), item.x, item.y + bobY, 80, 80);
    }

    // --- Steam particles ---
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
    }

    // --- Title with crisp zero-blur layered glow (60fps mobile safe!) ---
    const glowAlpha = 0.3 + 0.2 * Math.sin(this.glowPhase * 2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232, 93, 4, 0.35)';
    ctx.fillText('🍜 Bếp Việt', W / 2, 164);
    ctx.fillStyle = '#FCA311';
    ctx.fillText('🍜 Bếp Việt', W / 2, 160);

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

    // --- Buttons (fast offset shadow instead of shadowBlur!) ---
    for (const btn of this.buttons) {
      const { rect } = btn;
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);
      const color = hover ? btn.hoverColor : btn.color;

      roundRect(ctx, rect.x, rect.y + 4, rect.width, rect.height, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
      ctx.fillStyle = color;
      ctx.fill();

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

    // --- Sound Mute Toggle (top-left) ---
    const mb = this.muteBtn;
    const mbHover = InputManager.hitTest(this.engine.input.pointer, mb);
    roundRect(ctx, mb.x, mb.y, mb.width, mb.height, 10);
    ctx.fillStyle = mbHover ? 'rgba(252,163,17,0.3)' : 'rgba(17,19,38,0.68)';
    ctx.fill();
    ctx.strokeStyle = this.engine.audio.muted ? 'rgba(230,57,70,0.6)' : 'rgba(252,163,17,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.engine.audio.muted ? '🔇 Tắt tiếng' : '🔊 Âm thanh',
      mb.x + mb.width / 2,
      mb.y + mb.height / 2,
      '#fff',
    );

    // --- Fullscreen button (top-right for mobile landscape play) ---
    if (supportsFullscreen()) {
      const fs = this.fullscreenBtn;
      const fsHover = InputManager.hitTest(this.engine.input.pointer, fs);
      roundRect(ctx, fs.x, fs.y, fs.width, fs.height, 10);
      ctx.fillStyle = fsHover ? 'rgba(252,163,17,0.3)' : 'rgba(17,19,38,0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(252,163,17,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        isFullscreen() ? '⛶ Thu nhỏ' : '⛶ Toàn màn hình',
        fs.x + fs.width / 2,
        fs.y + fs.height / 2,
        '#fff',
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
