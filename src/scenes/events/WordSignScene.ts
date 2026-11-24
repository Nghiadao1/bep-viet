// ============================================================
// WordSignScene — 🔤 Ghép Chữ Làm Biển Hiệu & Slogan Quán!
// Appears when creating a new glowing Vietnamese street-food signboard
// or marketing slogan: tap floating letters in order to spell iconic
// Vietnamese dish names & slogans! Rewards +20% tip marketing boost!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow } from '../../utils/draw';
import { formatMoney, randFloat, shuffle } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

interface SloganPuzzle {
  letters: string[];
  display: string;
  hint: string;
  decoys: string[];
}

const PUZZLES: SloganPuzzle[] = [
  {
    letters: ['P', 'H', 'Ở', 'B', 'Ò'],
    display: 'PHỞ BÒ',
    hint: 'Món nước quốc hồn quốc túy mở đầu hành trình Sài Gòn!',
    decoys: ['A', 'M', 'T'],
  },
  {
    letters: ['B', 'Á', 'N', 'H', 'M', 'Ì'],
    display: 'BÁNH MÌ',
    hint: 'Ổ bánh vỏ giòn kẹp pate, thịt chả, đồ chua nức tiếng thế giới!',
    decoys: ['C', 'Ở', 'G'],
  },
  {
    letters: ['B', 'Ế', 'P', 'V', 'I', 'Ệ', 'T'],
    display: 'BẾP VIỆT',
    hint: 'Tên thương hiệu nhà hàng trứ danh của Vằn & Mèo Vàng!',
    decoys: ['N', 'A', 'M'],
  },
  {
    letters: ['C', 'Ơ', 'M', 'T', 'Ấ', 'M'],
    display: 'CƠM TẤM',
    hint: 'Sườn bì chả nướng thơm lừng với nước mắm chua ngọt!',
    decoys: ['P', 'H', 'Ở'],
  },
  {
    letters: ['N', 'G', 'O', 'N', 'B', 'Ổ', 'R', 'Ẻ'],
    display: 'NGON BỔ RẺ',
    hint: 'Khẩu hiệu 3 chữ vàng thu hút khách vỉa hè nườm nượp!',
    decoys: ['T', 'A', 'K'],
  },
  {
    letters: ['Đ', 'Ậ', 'M', 'Đ', 'À'],
    display: 'ĐẬM ĐÀ',
    hint: 'Hai chữ miêu tả hương vị nước dùng ninh xương chuẩn Việt!',
    decoys: ['B', 'É', 'O'],
  },
];

interface FloatingTile {
  id: number;
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  picked: boolean;
  phase: number;
  color: string;
}

export class WordSignScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'won' = 'intro';
  private elapsed = 0;
  private queue: SloganPuzzle[] = [];
  private roundIdx = 0;
  private current!: SloganPuzzle;
  private tiles: FloatingTile[] = [];
  private pickedTileIds: number[] = [];
  private mistakes = 0;
  private rewardMoney = 0;

  private undoBtn: Rect = { x: 744, y: 108, width: 122, height: 42 };
  private actionBtn: Rect = { x: 340, y: 434, width: 280, height: 54 };
  private removeClick?: () => void;

  constructor(engine: Engine, onComplete: () => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('kitchen');
    this.engine.audio.playCatVoice('golden');
    this.phase = 'intro';
    this.elapsed = 0;
    this.mistakes = 0;
    this.roundIdx = 0;
    this.particles.clear();

    this.queue = shuffle([...PUZZLES]).slice(0, 2); // 2 brisk, fun slogan boards!
    this.loadPuzzle(0);

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

      // Undo last picked letter
      if (InputManager.hitTest(pos, this.undoBtn, 8)) {
        const lastId = this.pickedTileIds.pop();
        if (lastId !== undefined) {
          const t = this.tiles.find((x) => x.id === lastId);
          if (t) t.picked = false;
          this.engine.audio.playSfx('click');
        }
        return;
      }

      // Tap a floating letter tile!
      for (const tile of this.tiles) {
        if (tile.picked) continue;
        if (Math.hypot(pos.x - tile.x, pos.y - tile.y) <= tile.r + 12) {
          this.handleTileTap(tile);
          return;
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
  }

  private loadPuzzle(idx: number): void {
    this.roundIdx = idx;
    this.current = this.queue[idx];
    this.pickedTileIds = [];

    const allChars = shuffle([...this.current.letters, ...this.current.decoys]);
    const palette = ['#e85d04', '#2a9d8f', '#d97706', '#e63946', '#3b82f6', '#9333ea'];
    this.tiles = allChars.map((char, i) => ({
      id: i,
      char,
      x: 110 + ((i * 117) % 740),
      y: 245 + Math.floor(i / 5) * 110 + randFloat(-18, 18),
      vx: randFloat(-58, 58) || 35,
      vy: randFloat(-44, 44) || 28,
      r: 34,
      picked: false,
      phase: i * 0.9,
      color: palette[i % palette.length],
    }));
  }

  private handleTileTap(tile: FloatingTile): void {
    const nextIdx = this.pickedTileIds.length;
    const expected = this.current.letters[nextIdx];

    if (tile.char === expected) {
      tile.picked = true;
      this.pickedTileIds.push(tile.id);
      this.engine.audio.playSfx('pop');
      this.particles.emitStarburst(tile.x, tile.y, '#ffd166', 12);

      if (this.pickedTileIds.length >= this.current.letters.length) {
        // Signboard completed!
        this.engine.audio.playSfx('perfect');
        this.particles.emitStarburst(480, 145, '#4CAF50', 26);

        if (this.roundIdx + 1 < this.queue.length) {
          this.engine.audio.playCatVoice('golden');
          this.loadPuzzle(this.roundIdx + 1);
        } else {
          this.phase = 'won';
          this.elapsed = 0;
          this.rewardMoney = Math.max(40, 80 - this.mistakes * 8);
          this.engine.save.addMoney(this.rewardMoney);
          this.engine.save.addSloganBonus(2);
          this.engine.audio.playSfx('win');
          this.engine.audio.playCatVoice('both');
        }
      }
    } else {
      this.mistakes++;
      this.engine.audio.playSfx('error');
      this.particles.emitAngryPuff(tile.x, tile.y);
      this.particles.shake(4, 0.14);
      this.particles.emitFloatingText(tile.x, tile.y - 20, `Cần chữ "${expected}"!`, '#E63946', 16);
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
    if (this.phase !== 'playing') return;

    // Drift floating letter tiles smoothly inside the playfield bounds!
    const minX = 68;
    const maxX = 892;
    const minY = 224;
    const maxY = 486;

    for (const t of this.tiles) {
      if (t.picked) continue;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < minX) { t.x = minX; t.vx = Math.abs(t.vx); }
      if (t.x > maxX) { t.x = maxX; t.vx = -Math.abs(t.vx); }
      if (t.y < minY) { t.y = minY; t.vy = Math.abs(t.vy); }
      if (t.y > maxY) { t.y = maxY; t.vy = -Math.abs(t.vy); }
    }

    // Gentle elastic separation so floating letters never overlap each other!
    for (let i = 0; i < this.tiles.length; i++) {
      const a = this.tiles[i];
      if (a.picked) continue;
      for (let j = i + 1; j < this.tiles.length; j++) {
        const b = this.tiles[j];
        if (b.picked) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r + 10;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.01 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.52;
          a.x = Math.max(minX, Math.min(maxX, a.x - nx * overlap));
          a.y = Math.max(minY, Math.min(maxY, a.y - ny * overlap));
          b.x = Math.max(minX, Math.min(maxX, b.x + nx * overlap));
          b.y = Math.max(minY, Math.min(maxY, b.y + ny * overlap));
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const rel = dvx * nx + dvy * ny;
          if (rel > 0) {
            a.vx -= rel * nx;
            a.vy -= rel * ny;
            b.vx += rel * nx;
            b.vy += rel * ny;
          }
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

    // Warm night lantern workshop backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#181430');
    bg.addColorStop(1, '#2a1a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Top bar
    ctx.fillStyle = 'rgba(10, 11, 22, 0.85)';
    ctx.fillRect(0, 0, W, 54);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `🔤 GHÉP BIỂN HIỆU QUÁN (${this.roundIdx + 1}/${this.queue.length})`, 22, 27, '#FCA311');
    ctx.textAlign = 'right';
    ctx.font = 'bold 14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`💡 Gợi ý: ${this.current.hint}`, W - 22, 27);

    // Glowing Neon Wooden Signboard Frame at Top!
    roundRect(ctx, 76, 72, 808, 114, 18);
    ctx.fillStyle = '#3b1f14';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Letter Slots on Signboard
    const n = this.current.letters.length;
    const slotW = 64;
    const gap = 12;
    const totalW = n * slotW + (n - 1) * gap;
    const startX = (W - totalW) / 2 - 48;

    for (let i = 0; i < n; i++) {
      const sx = startX + i * (slotW + gap);
      const sy = 96;
      const filled = i < this.pickedTileIds.length;
      const isNext = i === this.pickedTileIds.length;

      roundRect(ctx, sx, sy, slotW, 66, 12);
      ctx.fillStyle = filled ? '#2d9348' : isNext ? 'rgba(252, 163, 17, 0.25)' : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = filled ? '#80ed99' : isNext ? '#ffd166' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = isNext ? 3 : 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        filled ? this.current.letters[i] : '?',
        sx + slotW / 2,
        sy + 34,
        filled ? '#fff' : 'rgba(255,255,255,0.3)',
      );
    }

    // Undo button
    const ub = this.undoBtn;
    roundRect(ctx, ub.x, ub.y, ub.width, ub.height, 12);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.78)';
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '↩ Hoàn tác', ub.x + ub.width / 2, ub.y + ub.height / 2, '#fff');

    // Floating Lantern Letter Bubbles!
    for (const t of this.tiles) {
      if (t.picked) continue;
      const bob = Math.sin(this.elapsed * 3.5 + t.phase) * 4;

      ctx.beginPath();
      ctx.arc(t.x, t.y + bob + 4, t.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y + bob, t.r, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, t.char, t.x, t.y + bob + 1, '#fff');
    }

    this.particles.render(ctx);

    if (this.phase === 'intro') {
      this.renderModal(
        ctx,
        '🏮 TREO BIỂN HIỆU & SLOGAN KÊU GỌI KHÁCH!',
        '#E85D04',
        '🐾 Mèo Vàng: "Treo biển hiệu phát sáng cho khách nhìn từ đầu ngõ là ghé liền! Chạm lần lượt các chữ cái đang trôi nổi để ghép thành từ có nghĩa nhé!"',
        '🔤 GHÉP BIỂN HIỆU NGAY!',
      );
    } else if (this.phase === 'won') {
      this.renderModal(
        ctx,
        '✨ BIỂN HIỆU ĐẸP LUNG LINH!!',
        '#2d9348',
        `👑 Vằn Bếp Trưởng: "Biển hiệu sáng trưng cả con phố!! Thưởng +${formatMoney(this.rewardMoney)} và hiệu ứng Hút Khách (+20% Tips) cho 2 màn tiếp theo!"`,
        '🍜 QUAY LẠI BÁN HÀNG!',
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
    const words = text.split(' ');
    let line = '';
    let cy = 205;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > 560 && line) {
        ctx.fillText(line.trim(), 200, cy);
        line = w + ' ';
        cy += 26;
      } else line = t;
    }
    if (line.trim()) ctx.fillText(line.trim(), 200, cy);

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
