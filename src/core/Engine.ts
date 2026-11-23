// ============================================================
// Engine — Canvas setup, game loop, global managers
// ============================================================

import { InputManager } from './InputManager';
import { SceneManager } from './SceneManager';
import { AssetLoader } from './AssetLoader';
import { AudioManager } from './AudioManager';
import { SaveManager } from './SaveManager';
import { calculateCanvasSize } from '../utils/responsive';

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

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.resume();
    });
  }

  private handleResize(): void {
    const { width, height, scale } = calculateCanvasSize(
      this.gameWidth,
      this.gameHeight,
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
    );

    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width / window.devicePixelRatio}px`;
    this.canvas.style.height = `${height / window.devicePixelRatio}px`;
    this.scale = scale;

    // Pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;

    // Notify current scene
    this.scenes.current?.onResize?.(this.gameWidth, this.gameHeight);
  }

  start(): void {
    if (this.running) return;
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
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

    // Update
    this.scenes.current?.update(dt);

    // Render
    this.ctx.save();
    this.ctx.scale(this.scale, this.scale);
    this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
    this.scenes.current?.render(this.ctx);
    this.ctx.restore();

    this.rafId = requestAnimationFrame(this.loop);
  };
}
