// ============================================================
// Engine — Canvas setup, mobile orientation gate, tap ripples
// ============================================================

import { InputManager } from './InputManager';
import { SceneManager } from './SceneManager';
import { AssetLoader } from './AssetLoader';
import { AudioManager } from './AudioManager';
import { SaveManager } from './SaveManager';
import { calculateCanvasSize } from '../utils/responsive';
import {
  getViewportSize,
  shouldPromptLandscape,
  requestLandscapeFullscreen,
} from '../utils/mobile';

interface TapRipple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input: InputManager;
  readonly scenes: SceneManager;
  readonly assets: AssetLoader;
  readonly audio: AudioManager;
  readonly save: SaveManager;

  /** Logical game resolution (always 960×540, scaled to fit screen) */
  gameWidth = 960;
  gameHeight = 540;

  /** Scale factor from game coords → canvas pixels */
  scale = 1;

  private lastTime = 0;
  private running = false;
  private rafId = 0;
  private orientationBlocked = false;
  private ripples: TapRipple[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;

    this.input = new InputManager(this);
    this.scenes = new SceneManager();
    this.assets = new AssetLoader();
    this.audio = new AudioManager();
    this.save = new SaveManager();

    // Crisp tap ripple feedback for every touch/click
    this.input.onTapVisual((pos) => {
      this.ripples.push({ x: pos.x, y: pos.y, radius: 6, alpha: 0.7 });
    });

    // Wire fullscreen + landscape lock button in rotate overlay
    const fsBtn = document.getElementById('rotate-fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        void requestLandscapeFullscreen().then(() => {
          setTimeout(() => this.handleResize(), 150);
        });
      });
    }

    this.handleResize();

    const onViewportChange = () => this.handleResize();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', () => {
      setTimeout(onViewportChange, 120);
    });
    window.visualViewport?.addEventListener('resize', onViewportChange);

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else if (!this.orientationBlocked) this.resume();
    });
  }

  private updateOrientationGate(): void {
    const mustRotate = shouldPromptLandscape();
    this.orientationBlocked = mustRotate;

    const overlay = document.getElementById('rotate-overlay');
    if (overlay) {
      overlay.classList.toggle('visible', mustRotate);
    }

    // Freeze game loop cleanly while waiting for player to rotate to landscape
    if (mustRotate && this.running) {
      this.pause();
    } else if (!mustRotate && !this.running && !document.hidden && this.scenes.current) {
      this.resume();
    }
  }

  private handleResize(): void {
    this.updateOrientationGate();

    const { width: vw, height: vh } = getViewportSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const { width, height, scale } = calculateCanvasSize(
      this.gameWidth,
      this.gameHeight,
      vw,
      vh,
      dpr,
    );

    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width / dpr}px`;
    this.canvas.style.height = `${height / dpr}px`;
    this.scale = scale;

    // Pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;

    // Notify current scene
    this.scenes.current?.onResize?.(this.gameWidth, this.gameHeight);
  }

  start(): void {
    this.updateOrientationGate();
    if (this.orientationBlocked || this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  pause(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  resume(): void {
    if (this.orientationBlocked || this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

    // Update scene & tap ripples
    this.scenes.update(dt);
    this.updateRipples(dt);

    // Render
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
    this.scenes.render(this.ctx);
    this.renderRipples(this.ctx);
    this.ctx.restore();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateRipples(dt: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 120 * dt;
      r.alpha -= 2.4 * dt;
      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  private renderRipples(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(252, 163, 17, ${r.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }
}
