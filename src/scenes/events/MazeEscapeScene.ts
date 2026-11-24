// ============================================================
// MazeEscapeScene — 🧭 Tìm Đường Thoát Khỏi Mê Cung Di Dời Quán!
// Appears when relocating the food stall to a new neighborhood/city.
// 4 big mobile D-Pad directional buttons (+ Arrow/WASD keys) to push
// the street cart through winding Vietnamese alleys to the new spot!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow } from '../../utils/draw';
import { formatMoney, randPick } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

// 13x9 guaranteed-solvable Vietnamese alley mazes (1 = wall/shophouse, 0 = road, 2 = coin, 3 = goal)
const MAZES: number[][][] = [
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,2,0,0,0,1,2,0,1],
    [1,0,1,0,1,0,1,1,0,1,1,0,1],
    [1,2,1,0,0,0,1,2,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,0,1,1,1],
    [1,2,0,0,0,0,0,0,1,0,0,2,1],
    [1,0,1,1,1,1,1,0,1,1,1,0,1],
    [1,0,0,2,0,0,1,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,2,0,1,0,0,2,0,0,0,1],
    [1,1,1,1,0,1,0,1,1,1,1,0,1],
    [1,2,0,0,0,0,0,1,2,0,0,0,1],
    [1,0,1,1,1,1,0,1,0,1,1,1,1],
    [1,0,0,0,2,1,0,0,0,1,2,0,1],
    [1,1,1,0,1,1,1,1,0,1,0,0,1],
    [1,2,0,0,0,0,0,1,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

export class MazeEscapeScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private destinationName: string;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'won' = 'intro';
  private elapsed = 0;
  private grid: number[][] = [];
  private px = 1;
  private py = 1;
  private visualX = 1;
  private visualY = 1;
  private moves = 0;
  private coinsCollected = 0;
  private bonusMoney = 0;

  // Maze board geometry (left side of 960x540, leaving right side for big 4-way D-Pad!)
  private readonly cellSize = 46;
  private readonly originX = 28;
  private readonly originY = 78;

  // 4 Big Touch-Friendly Directional Buttons on right panel!
  private dpadUp: Rect = { x: 750, y: 274, width: 78, height: 70 };
  private dpadDown: Rect = { x: 750, y: 422, width: 78, height: 70 };
  private dpadLeft: Rect = { x: 664, y: 348, width: 78, height: 70 };
  private dpadRight: Rect = { x: 836, y: 348, width: 78, height: 70 };
  private actionBtn: Rect = { x: 340, y: 434, width: 280, height: 54 };

  private removeClick?: () => void;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(engine: Engine, destinationName = 'Bến Quán Mới', onComplete: () => void) {
    this.engine = engine;
    this.destinationName = destinationName;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('kitchen');
    this.engine.audio.playCatVoice('boss');
    this.phase = 'intro';
    this.elapsed = 0;
    this.moves = 0;
    this.coinsCollected = 0;
    this.bonusMoney = 0;
    this.particles.clear();

    // Clone maze
    const template = randPick(MAZES);
    this.grid = template.map((row) => [...row]);
    this.px = 1;
    this.py = 1;
    this.visualX = 1;
    this.visualY = 1;

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.engine.audio.playSfx('click');
          this.phase = 'playing';
        }
        return;
      }

      if (this.phase === 'won') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.4) {
          this.engine.audio.playSfx('click');
          this.onComplete();
        }
        return;
      }

      if (InputManager.hitTest(pos, this.dpadUp, 10)) this.tryMove(0, -1);
      else if (InputManager.hitTest(pos, this.dpadDown, 10)) this.tryMove(0, 1);
      else if (InputManager.hitTest(pos, this.dpadLeft, 10)) this.tryMove(-1, 0);
      else if (InputManager.hitTest(pos, this.dpadRight, 10)) this.tryMove(1, 0);
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        this.phase = 'playing';
        return;
      }
      if (this.phase !== 'playing') return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.tryMove(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.tryMove(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.tryMove(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.tryMove(1, 0);
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  exit(): void {
    this.removeClick?.();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  private tryMove(dx: number, dy: number): void {
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (ny < 0 || ny >= this.grid.length || nx < 0 || nx >= this.grid[0].length) return;
    if (this.grid[ny][nx] === 1) {
      this.engine.audio.playSfx('error');
      this.particles.shake(3.5, 0.12);
      return;
    }

    this.px = nx;
    this.py = ny;
    this.moves++;
    this.engine.audio.playSfx('pop');

    const cell = this.grid[ny][nx];
    const cx = this.originX + nx * this.cellSize + this.cellSize / 2;
    const cy = this.originY + ny * this.cellSize + this.cellSize / 2;

    if (cell === 2) {
      this.grid[ny][nx] = 0;
      this.coinsCollected++;
      this.engine.audio.playSfx('coin');
      this.particles.emitStarburst(cx, cy, '#ffd166', 10);
      this.particles.emitFloatingText(cx, cy - 12, '+15đ 🪙', '#ffd166', 15);
    } else if (cell === 3) {
      this.phase = 'won';
      this.elapsed = 0;
      this.bonusMoney = 45 + this.coinsCollected * 15;
      this.engine.save.addMoney(this.bonusMoney);
      this.engine.audio.playSfx('win');
      this.engine.audio.playCatVoice('both');
      this.particles.emitStarburst(cx, cy, '#4CAF50', 26);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
    this.visualX += (this.px - this.visualX) * Math.min(1, dt * 18);
    this.visualY += (this.py - this.visualY) * Math.min(1, dt * 18);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Warm dark evening alley backdrop
    ctx.fillStyle = '#14172b';
    ctx.fillRect(0, 0, W, H);

    // Top bar
    ctx.fillStyle = 'rgba(10, 11, 22, 0.85)';
    ctx.fillRect(0, 0, W, 56);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 21px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `🧭 DI DỜI QUÁN: THOÁT MÊ CUNG TỚI ${this.destinationName.toUpperCase()}`, 22, 28, '#FCA311');
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px monospace';
    drawTextShadow(ctx, `🪙 Xu gom: ${this.coinsCollected}  •  Bước: ${this.moves}`, W - 22, 28, '#80ed99');

    // Maze Frame
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    const mw = cols * this.cellSize;
    const mh = rows * this.cellSize;
    roundRect(ctx, this.originX - 8, this.originY - 8, mw + 16, mh + 16, 14);
    ctx.fillStyle = '#232842';
    ctx.fill();
    ctx.strokeStyle = '#FCA311';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Maze Cells
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.originX + c * this.cellSize;
        const y = this.originY + r * this.cellSize;
        const val = this.grid[r][c];
        if (val === 1) {
          // Warm Vietnamese shophouse roof tile wall
          ctx.fillStyle = (r + c) % 2 === 0 ? '#5c3422' : '#6c3e29';
          ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
          ctx.fillStyle = '#8b4d32';
          ctx.fillRect(x + 4, y + 4, this.cellSize - 8, 8);
        } else {
          // Cobblestone alley floor
          ctx.fillStyle = (r + c) % 2 === 0 ? '#2b314d' : '#313858';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);

          if (val === 2) {
            const bob = Math.sin(this.elapsed * 5 + c + r) * 3;
            ctx.beginPath();
            ctx.arc(x + this.cellSize / 2, y + this.cellSize / 2 + bob, 11, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd166';
            ctx.fill();
            ctx.strokeStyle = '#e85d04';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#7f4f24';
            ctx.fillText('₫', x + this.cellSize / 2, y + this.cellSize / 2 + bob + 1);
          } else if (val === 3) {
            // Glowing exit destination flag!
            const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 6);
            ctx.fillStyle = `rgba(76, 175, 80, ${pulse * 0.45})`;
            ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
            if (this.engine.assets.hasImage('maze_flag')) {
              ctx.drawImage(this.engine.assets.getImage('maze_flag'), x + 5, y + 3, this.cellSize - 10, this.cellSize - 6);
            }
          }
        }
      }
    }

    // Player Pushcart Sprite moving smoothly along alleys!
    const heroX = this.originX + this.visualX * this.cellSize;
    const heroY = this.originY + this.visualY * this.cellSize;
    if (this.engine.assets.hasImage('cart_mini')) {
      ctx.drawImage(this.engine.assets.getImage('cart_mini'), heroX + 3, heroY + 3, this.cellSize - 6, this.cellSize - 6);
    }

    // Right Control Panel: Cats Guide + 4 Big D-Pad Directional Buttons!
    const panelX = 648;
    roundRect(ctx, panelX, 78, 286, 174, 16);
    ctx.fillStyle = 'rgba(22, 26, 48, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.imageSmoothingEnabled = true;
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const dh = 96;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, panelX + 12, 102 + Math.sin(this.elapsed * 3.5) * 3, dw, dh);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#F4A261';
    ctx.fillText('🐾 Mèo Vàng dẫn đường:', panelX + 114, 94);
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    this.wrapText(
      ctx,
      'Dùng 4 nút mũi tên bên dưới (hoặc phím ↑↓←→) đẩy xe phở ra khỏi mê cung hẻm tới cờ đỏ nha!',
      panelX + 114,
      118,
      160,
      19,
    );

    // 4 Directional Buttons
    const ptr = this.engine.input.pointer;
    const dirs: Array<[Rect, string]> = [
      [this.dpadUp, '⬆️'],
      [this.dpadDown, '⬇️'],
      [this.dpadLeft, '⬅️'],
      [this.dpadRight, '➡️'],
    ];
    for (const [r, arrow] of dirs) {
      const hov = InputManager.hitTest(ptr, r);
      roundRect(ctx, r.x, r.y + 3, r.width, r.height, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      roundRect(ctx, r.x, r.y, r.width, r.height, 14);
      ctx.fillStyle = hov ? '#f48c06' : '#e85d04';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '32px "Segoe UI"';
      ctx.fillText(arrow, r.x + r.width / 2, r.y + r.height / 2);
    }

    this.particles.render(ctx);

    if (this.phase === 'intro') {
      this.renderModal(
        ctx,
        `🧭 DI DỜI XE ĐẨY TỚI ${this.destinationName.toUpperCase()}!`,
        '#E85D04',
        '👑 Vằn Bếp Trưởng: "Khu phố mới đông khách lắm! Dùng 4 nút điều hướng đẩy xe phở luồn hẻm thoát mê cung tới điểm cắm cờ đỏ nhé!"',
        '🧭 BẮT ĐẦU TÌM ĐƯỜNG!',
      );
    } else if (this.phase === 'won') {
      this.renderModal(
        ctx,
        `🎉 ĐẾN ${this.destinationName.toUpperCase()} AN TOÀN!`,
        '#2d9348',
        `🐾 Mèo Vàng: "Tới nơi rồi!! Trên đường đi tụi mình còn nhặt thêm ${this.coinsCollected} xu, tổng thưởng +${formatMoney(this.bonusMoney)} luôn đó! Mở quán thôi!"`,
        '🍜 MỞ QUÁN TẠI BẾN MỚI!',
      );
    }

    ctx.restore();
  }

  private renderModal(ctx: CanvasRenderingContext2D, title: string, accent: string, text: string, cta: string): void {
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, 960, 540);
    roundRect(ctx, 160, 108, 640, 310, 20);
    ctx.fillStyle = '#1b1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, 480, 154, '#FCA311');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapText(ctx, text, 200, 205, 560, 26);

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

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > maxW && line) {
        ctx.fillText(line.trim(), x, cy);
        line = w + ' ';
        cy += lh;
      } else line = t;
    }
    if (line.trim()) ctx.fillText(line.trim(), x, cy);
  }
}
