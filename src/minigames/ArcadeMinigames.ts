// ============================================================
// ArcadeMinigames — High-Energy Reflex & Fruit-Ninja Prep Games!
// 15. WormCatchVeggieMinigame (🐛 Nhặt rau tươi & nhanh tay bắt sâu trốn cực nhanh!)
// 16. FruitSliceMinigame      (🍉 Chém gia vị hành tỏi & hoa quả kiểu Fruit Ninja!)
// ============================================================

import type { Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { clamp, lerp, randFloat, randPick, shuffle } from '../utils/math';
import {
  BOARD_RECT,
  gradeFromScore,
  renderMinigameFrame,
  renderResultStamp,
  type CookingMinigame,
  type MinigameContext,
  type MinigameResult,
} from './types';

// ============================================================
// 15. WormCatchVeggieMinigame — 🐛 Nhặt rau tươi & bắt sâu xuất hiện bất ngờ!
// ============================================================

interface LeafSpot {
  x: number;
  y: number;
  r: number;
  emoji: string;
  picked: boolean;
  phase: number;
}

interface ActiveWorm {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  wiggle: number;
}

export class WormCatchVeggieMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Nhặt sạch rau xanh — thấy SÂU 🐛 nhô ra phải CHẠM BẮT NGAY trước khi nó trốn!';
  readonly catSpeaker = 'golden' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private leaves: LeafSpot[] = [];
  private activeWorm: ActiveWorm | null = null;
  private nextWormTimer = 0.75;
  private wormsSpawned = 0;
  private wormsCaught = 0;
  private wormsEscaped = 0;
  private minWormsToSpawn: number;
  private wormDuration: number;
  private popups: Array<{ text: string; color: string; x: number; y: number; alpha: number }> = [];
  private catQuote = 'Nhặt rau xanh mướt nào — coi chừng sâu lá bất ngờ chui ra đó, bắt lẹ tay nha!! 🐛';

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    this.title = `🐛 Nhặt Rau & Bắt Sâu — ${ctx.recipe.name}`;
    this.minWormsToSpawn = d > 0.45 ? 3 : 2;
    this.wormDuration = lerp(1.55, 0.92, d); // Vanishes very fast at higher levels!

    const leafCount = d < 0.2 ? 6 : d < 0.6 ? 7 : 8;
    const slots = shuffle([
      { x: 318, y: 215 }, { x: 416, y: 194 }, { x: 522, y: 194 }, { x: 626, y: 215 },
      { x: 344, y: 294 }, { x: 432, y: 274 }, { x: 528, y: 274 }, { x: 616, y: 294 },
      { x: 480, y: 334 },
    ]);
    const emojis = ['🥬', '🌿', '🌱', '🥒', '🥬', '🌿', '🌱', '🥬'];
    for (let i = 0; i < leafCount; i++) {
      this.leaves.push({
        x: slots[i].x + randFloat(-8, 8),
        y: slots[i].y + randFloat(-6, 6),
        r: 32,
        emoji: emojis[i % emojis.length],
        picked: false,
        phase: i * 1.15,
      });
    }
  }

  private spawnWorm(): void {
    // Pick a spot near remaining leaves (or inside basket)
    const remaining = this.leaves.filter((l) => !l.picked);
    const anchor =
      remaining.length > 0
        ? randPick(remaining)
        : { x: randFloat(340, 620), y: randFloat(200, 320) };

    this.activeWorm = {
      x: clamp(anchor.x + randFloat(-26, 26), 310, 650),
      y: clamp(anchor.y + randFloat(-22, 22), 186, 340),
      r: 34,
      life: this.wormDuration,
      maxLife: this.wormDuration,
      wiggle: 0,
    };
    this.wormsSpawned++;
    this.ctx.particles.emitLeafBurst(this.activeWorm.x, this.activeWorm.y);
    this.catQuote = 'Á!! CÓ SÂU BÒ RA KÌA!! CHẠM BẮT NHANH TRƯỚC KHI NÓ TRỐN!! 🐛⚡';
  }

  onDown(pos: Vec2): void {
    if (this.result) return;

    // 1. Prioritize catching an active sneaky worm!
    if (this.activeWorm) {
      const w = this.activeWorm;
      if (Math.hypot(pos.x - w.x, pos.y - w.y) <= w.r + 16) {
        this.wormsCaught++;
        this.ctx.engine.audio.playSfx('worm');
        this.ctx.particles.emitStarburst(w.x, w.y, '#ffd166', 18);
        this.popups.push({ text: '⚡ BẮT GỌN SÂU!', color: '#ffd166', x: w.x, y: w.y - 12, alpha: 1 });
        this.catQuote = 'Phản xạ siêu đỉnh!! Tóm gọn bé sâu luôn rồi! ⭐';
        this.activeWorm = null;
        this.nextWormTimer = randFloat(0.65, 1.35);
        this.checkComplete();
        return;
      }
    }

    // 2. Otherwise pick fresh herbs
    for (const leaf of this.leaves) {
      if (leaf.picked) continue;
      if (Math.hypot(pos.x - leaf.x, pos.y - leaf.y) <= leaf.r + 10) {
        leaf.picked = true;
        this.ctx.engine.audio.playSfx('pop');
        this.ctx.particles.emitLeafBurst(leaf.x, leaf.y);
        this.popups.push({ text: '🌿 Sạch!', color: '#80ed99', x: leaf.x, y: leaf.y - 10, alpha: 1 });

        // Surprise worm ambush chance right when uncovering a leaf!
        const left = this.leaves.filter((l) => !l.picked).length;
        if (!this.activeWorm && this.wormsSpawned < this.minWormsToSpawn && (Math.random() < 0.45 || left <= 1)) {
          this.spawnWorm();
        } else if (!this.activeWorm) {
          this.catQuote =
            left > 0
              ? `Tươi xanh quá! Còn ${left} bó rau nữa — vẫn nhớ cảnh giác sâu nha!`
              : 'Rau sạch bóng rồi!';
        }

        this.checkComplete();
        return;
      }
    }
  }

  private checkComplete(): void {
    const remainingLeaves = this.leaves.filter((l) => !l.picked).length;
    if (remainingLeaves === 0 && !this.activeWorm) {
      const score = clamp(100 - this.wormsEscaped * 18 + this.wormsCaught * 4, 48, 100);
      const grade = gradeFromScore(score);
      this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 260, '#52b788', 24);
      this.result = {
        score,
        grade,
        catSpeaker: 'golden',
        catComment:
          this.wormsEscaped === 0
            ? `Sạch bong không một bóng sâu! Bắt gọn ${this.wormsCaught} con sâu siêu nhanh! ⭐`
            : `Nhặt xong rau rồi! Có ${this.wormsEscaped} con sâu chạy thoát, lần sau nhanh tay hơn nha~`,
      };
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].y -= 42 * dt;
      this.popups[i].alpha -= 1.45 * dt;
      if (this.popups[i].alpha <= 0) this.popups.splice(i, 1);
    }

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    // Update active vanishing worm!
    if (this.activeWorm) {
      this.activeWorm.life -= dt;
      this.activeWorm.wiggle += dt * 22;
      if (this.activeWorm.life <= 0) {
        const w = this.activeWorm;
        this.activeWorm = null;
        this.wormsEscaped++;
        this.ctx.engine.audio.playSfx('error');
        this.ctx.particles.emitAngryPuff(w.x, w.y);
        this.ctx.particles.shake(4.5, 0.18);
        this.popups.push({ text: '💨 Sâu trốn mất!', color: '#E63946', x: w.x, y: w.y, alpha: 1 });
        this.catQuote = 'Á!! Con sâu chui biến mất nhanh quá rồi!! Lần tới thấy là chụp liền nha! 🙀';
        this.nextWormTimer = randFloat(0.7, 1.4);
        this.checkComplete();
      }
    } else {
      this.nextWormTimer -= dt;
      const remaining = this.leaves.filter((l) => !l.picked).length;
      if (this.nextWormTimer <= 0 && remaining > 0) {
        this.spawnWorm();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;

    ctx.save();
    // Large woven bamboo basket
    ctx.beginPath();
    ctx.ellipse(cx, 268, 246, 130, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7f4f24';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, 264, 232, 118, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#b07d4f';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, 262, 212, 104, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#264334';
    ctx.fill();

    // Fresh leaves
    for (const leaf of this.leaves) {
      if (leaf.picked) continue;
      const bob = Math.sin(this.elapsed * 4 + leaf.phase) * 3;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y + bob, leaf.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(76, 175, 80, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#80ed99';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '34px "Segoe UI"';
      ctx.fillText(leaf.emoji, leaf.x, leaf.y + bob);
    }

    // Sneaky fast-vanishing Worm sprite with shrinking urgent timer ring!
    if (this.activeWorm) {
      const w = this.activeWorm;
      const frac = clamp(w.life / w.maxLife, 0, 1);
      const scale = frac < 0.25 ? frac / 0.25 : 1 + Math.sin(w.wiggle) * 0.08;

      ctx.save();
      ctx.translate(w.x, w.y);

      // Urgent countdown arc around worm!
      ctx.beginPath();
      ctx.arc(0, 0, w.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = frac < 0.35 ? '#ef233c' : '#ffd166';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Red alert glow
      ctx.beginPath();
      ctx.arc(0, 0, w.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230, 57, 70, 0.38)';
      ctx.fill();

      ctx.scale(scale, scale);
      ctx.rotate(Math.sin(w.wiggle) * 0.18);
      if (this.ctx.engine.assets.hasImage('prop_worm')) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.ctx.engine.assets.getImage('prop_worm'), -32, -32, 64, 64);
      } else {
        ctx.font = '38px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐛', 0, 0);
      }

      // Flashing "BẮT!" alert tag above worm
      ctx.rotate(-Math.sin(w.wiggle) * 0.18);
      roundRect(ctx, -28, -46, 56, 20, 8);
      ctx.fillStyle = '#e63946';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⚡ BẮT!', 0, -36);
      ctx.restore();
    }

    // Top stats strip
    const picked = this.leaves.filter((l) => l.picked).length;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      `🥬 Rau sạch: ${picked}/${this.leaves.length}   •   🐛 Sâu đã bắt: ${this.wormsCaught}`,
      cx,
      138,
      '#80ed99',
    );

    // Floating popups
    for (const p of this.popups) {
      ctx.save();
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, p.text, p.x, p.y, p.color);
      ctx.restore();
    }

    ctx.restore();
    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}

// ============================================================
// 16. FruitSliceMinigame — 🍉 Chém Gia Vị Hành Tỏi & Hoa Quả (Fruit Ninja!)
// ============================================================

interface FlyingItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
  spriteKey: string;
  juiceColor: string;
  isBomb: boolean;
  sliced: boolean;
}

interface SlicedHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  spriteKey: string;
  side: 'left' | 'right';
  alpha: number;
}

const SLICE_CATALOG = [
  { spriteKey: 'prop_onion', juiceColor: '#c77dff', label: 'Hành tím' },
  { spriteKey: 'prop_garlic', juiceColor: '#f8f4e8', label: 'Tỏi' },
  { spriteKey: 'prop_chili', juiceColor: '#e63946', label: 'Ớt đỏ' },
  { spriteKey: 'prop_lime', juiceColor: '#80ed99', label: 'Chanh' },
  { spriteKey: 'prop_carrot', juiceColor: '#f48c06', label: 'Cà rốt' },
  { spriteKey: 'prop_mango', juiceColor: '#ffba08', label: 'Xoài' },
];

export class FruitSliceMinigame implements CookingMinigame {
  readonly title: string;
  readonly instruction = 'Vuốt nhanh tay chém đôi hành tỏi, ớt, chanh, hoa quả — né than nóng 💣!';
  readonly catSpeaker = 'boss' as const;

  done = false;
  result: MinigameResult | null = null;

  private ctx: MinigameContext;
  private elapsed = 0;
  private finishTimer = 0;

  private items: FlyingItem[] = [];
  private halves: SlicedHalf[] = [];
  private nextId = 1;
  private spawnTimer = 0.25;
  private slicing = false;
  private bladeTrail: Array<{ x: number; y: number; life: number }> = [];
  private lastBladePos: Vec2 | null = null;
  private swipeComboCount = 0;

  private slicedCount = 0;
  private targetSlices: number;
  private bombHits = 0;
  private comboBonus = 0;
  private popups: Array<{ text: string; color: string; x: number; y: number; alpha: number }> = [];
  private catQuote = 'Vung dao chém ngọt hành tỏi, ớt chanh đang bay lên! Nhớ né cục than nóng 💣 nhé!';

  constructor(ctx: MinigameContext) {
    this.ctx = ctx;
    const d = clamp(ctx.difficulty, 0, 1);
    this.title = `🍉 Chém Gia Vị & Hoa Quả — ${ctx.recipe.name}`;
    this.targetSlices = Math.round(lerp(8, 13, d));
    this.spawnWave();
  }

  private spawnWave(): void {
    const d = clamp(this.ctx.difficulty, 0, 1);
    const waveSize = Math.random() < 0.55 ? 2 : 3;
    const bombChance = lerp(0.14, 0.28, d);

    for (let i = 0; i < waveSize; i++) {
      const isBomb = i === waveSize - 1 && Math.random() < bombChance;
      const spec = randPick(SLICE_CATALOG);
      const startX = randFloat(BOARD_RECT.x + 110, BOARD_RECT.x + BOARD_RECT.width - 110);
      const towardCenter = (BOARD_RECT.x + BOARD_RECT.width / 2 - startX) * randFloat(0.45, 1.05);

      this.items.push({
        id: this.nextId++,
        x: startX,
        y: BOARD_RECT.y + BOARD_RECT.height - 56,
        vx: towardCenter + randFloat(-50, 50),
        vy: -randFloat(395, 470),
        rot: randFloat(0, Math.PI * 2),
        vrot: randFloat(-5, 5),
        r: isBomb ? 28 : 32,
        spriteKey: isBomb ? 'prop_bomb_coal' : spec.spriteKey,
        juiceColor: isBomb ? '#e63946' : spec.juiceColor,
        isBomb,
        sliced: false,
      });
    }
  }

  onDown(pos: Vec2): void {
    if (this.result) return;
    if (InputManager.hitTest(pos, BOARD_RECT)) {
      this.slicing = true;
      this.swipeComboCount = 0;
      this.lastBladePos = pos;
      this.bladeTrail.push({ x: pos.x, y: pos.y, life: 0.22 });
      this.checkSliceSegment(pos, pos);
    }
  }

  onMove(pos: Vec2): void {
    if (!this.slicing || this.result) return;
    const prev = this.lastBladePos ?? pos;
    this.bladeTrail.push({ x: pos.x, y: pos.y, life: 0.22 });
    if (this.bladeTrail.length > 26) this.bladeTrail.shift();
    this.checkSliceSegment(prev, pos);
    this.lastBladePos = pos;
  }

  onUp(): void {
    this.slicing = false;
    this.lastBladePos = null;
    this.swipeComboCount = 0;
  }

  private checkSliceSegment(a: Vec2, b: Vec2): void {
    let hitInStep = 0;
    for (const item of this.items) {
      if (item.sliced) continue;
      if (this.segmentCircleHit(a, b, item.x, item.y, item.r + 12)) {
        item.sliced = true;
        if (item.isBomb) {
          this.bombHits++;
          this.ctx.engine.audio.playSfx('error');
          this.ctx.particles.emitFireSparks(item.x, item.y, 24);
          this.ctx.particles.emitAngryPuff(item.x, item.y);
          this.ctx.particles.shake(8, 0.26);
          this.popups.push({ text: '💥 THAN NÓNG!', color: '#E63946', x: item.x, y: item.y, alpha: 1 });
          this.catQuote = 'Á!! Chém trúng cục than nóng rồi!! Mẻ dao bếp trưởng luôn!! 🙀💣';
        } else {
          this.slicedCount++;
          this.swipeComboCount++;
          hitInStep++;
          this.ctx.engine.audio.playSfx(this.swipeComboCount >= 2 ? 'perfect' : 'slice');

          // Split into 2 spinning halves!
          this.halves.push(
            {
              x: item.x - 10,
              y: item.y,
              vx: item.vx - 95,
              vy: item.vy - 45,
              rot: item.rot,
              vrot: -6.5,
              spriteKey: item.spriteKey,
              side: 'left',
              alpha: 1,
            },
            {
              x: item.x + 10,
              y: item.y,
              vx: item.vx + 95,
              vy: item.vy - 45,
              rot: item.rot,
              vrot: 6.5,
              spriteKey: item.spriteKey,
              side: 'right',
              alpha: 1,
            },
          );

          this.ctx.particles.emitLiquidSplash(item.x, item.y, item.juiceColor, 10);
          this.ctx.particles.emitSliceSparks(item.x, item.y, '#ffffff', 8);

          if (this.swipeComboCount >= 2) {
            this.comboBonus += 4;
            this.ctx.particles.emitStarburst(item.x, item.y, '#ffd166', 14);
            this.popups.push({
              text: `⚡ COMBO x${this.swipeComboCount}!`,
              color: '#ffd166',
              x: item.x,
              y: item.y - 24,
              alpha: 1.2,
            });
            this.catQuote = `Đao pháp thần sầu!! Chém liên hoàn COMBO x${this.swipeComboCount}!! 🔥🍉`;
          } else {
            this.catQuote = `Xoẹt!! Ngọt lịm (${this.slicedCount}/${this.targetSlices})! Chém tiếp nào! 🔪`;
          }
        }
      }
    }

    if (hitInStep > 0 && this.slicedCount >= this.targetSlices && !this.result) {
      const score = clamp(100 - this.bombHits * 22 + Math.min(10, this.comboBonus), 45, 100);
      const grade = gradeFromScore(score);
      this.ctx.particles.emitStarburst(BOARD_RECT.x + BOARD_RECT.width / 2, 240, '#ffd166', 28);
      this.result = {
        score,
        grade,
        catSpeaker: 'boss',
        catComment:
          this.bombHits === 0
            ? 'Đao pháp như Ninja ẩm thực!! Hành tỏi hoa quả thái đều tăm tắp! ⭐🔪'
            : 'Chém xong mẻ gia vị rồi — lần sau nhớ né than nóng nha!',
      };
    }
  }

  private segmentCircleHit(a: Vec2, b: Vec2, cx: number, cy: number, r: number): boolean {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSq = vx * vx + vy * vy;
    if (lenSq < 1) return Math.hypot(cx - a.x, cy - a.y) <= r;
    const t = clamp(((cx - a.x) * vx + (cy - a.y) * vy) / lenSq, 0, 1);
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    return Math.hypot(cx - px, cy - py) <= r;
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Fade blade trail
    for (let i = this.bladeTrail.length - 1; i >= 0; i--) {
      this.bladeTrail[i].life -= dt;
      if (this.bladeTrail[i].life <= 0) this.bladeTrail.splice(i, 1);
    }

    // Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].y -= 48 * dt;
      this.popups[i].alpha -= 1.35 * dt;
      if (this.popups[i].alpha <= 0) this.popups.splice(i, 1);
    }

    // Flying split halves
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const h = this.halves[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 680 * dt;
      h.rot += h.vrot * dt;
      h.alpha -= 1.1 * dt;
      if (h.alpha <= 0 || h.y > BOARD_RECT.y + BOARD_RECT.height) {
        this.halves.splice(i, 1);
      }
    }

    if (this.result) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.48) this.done = true;
      return;
    }

    // Launch waves continuously
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.length < 6) {
      this.spawnWave();
      this.spawnTimer = lerp(1.15, 0.78, this.ctx.difficulty);
    }

    // Physics for flying ingredients
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.sliced) {
        this.items.splice(i, 1);
        continue;
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vy += 540 * dt;
      it.rot += it.vrot * dt;

      if (it.isBomb && Math.random() < dt * 16) {
        this.ctx.particles.emitFireSparks(it.x + 12, it.y - 18, 1);
      }
      if (it.y > BOARD_RECT.y + BOARD_RECT.height - 24 && it.vy > 0) {
        this.items.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const b = BOARD_RECT;
    renderMinigameFrame(ctx, this.ctx.engine, {
      title: this.title,
      instruction: this.instruction,
      catSpeaker: this.catSpeaker,
      catQuote: this.result ? this.result.catComment : this.catQuote,
      elapsed: this.elapsed,
      result: this.result,
    });

    const cx = b.x + b.width / 2;

    // Warm dark dojo wooden chopping backdrop clipped neatly inside board
    ctx.save();
    roundRect(ctx, b.x + 16, b.y + 60, b.width - 32, b.height - 114, 14);
    const wood = ctx.createLinearGradient(0, b.y + 60, 0, b.y + b.height - 54);
    wood.addColorStop(0, '#3a2314');
    wood.addColorStop(1, '#24150c');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Clip flying items & trails neatly inside chopping arena
    roundRect(ctx, b.x + 16, b.y + 60, b.width - 32, b.height - 114, 14);
    ctx.clip();

    // Subtle wood plank seams
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (let y = b.y + 110; y < b.y + b.height - 54; y += 52) {
      ctx.beginPath();
      ctx.moveTo(b.x + 16, y);
      ctx.lineTo(b.x + b.width - 16, y);
      ctx.stroke();
    }

    // Sliced spinning halves
    ctx.imageSmoothingEnabled = false;
    for (const h of this.halves) {
      ctx.save();
      ctx.globalAlpha = clamp(h.alpha, 0, 1);
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.beginPath();
      if (h.side === 'left') ctx.rect(-36, -36, 36, 72);
      else ctx.rect(0, -36, 36, 72);
      ctx.clip();
      if (this.ctx.engine.assets.hasImage(h.spriteKey)) {
        ctx.drawImage(this.ctx.engine.assets.getImage(h.spriteKey), -32, -32, 64, 64);
      }
      ctx.restore();
    }

    // Whole flying aromatics / produce / hot coal bombs
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      if (it.isBomb) {
        ctx.beginPath();
        ctx.arc(0, 0, it.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230, 57, 70, 0.28)';
        ctx.fill();
      }
      if (this.ctx.engine.assets.hasImage(it.spriteKey)) {
        ctx.drawImage(this.ctx.engine.assets.getImage(it.spriteKey), -34, -34, 68, 68);
      }
      ctx.restore();
    }

    // Gleaming Fruit-Ninja katana swipe trail!
    if (this.bladeTrail.length > 1) {
      for (let i = 1; i < this.bladeTrail.length; i++) {
        const p0 = this.bladeTrail[i - 1];
        const p1 = this.bladeTrail[i];
        const frac = i / this.bladeTrail.length;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(186, 230, 253, ${frac * 0.9})`;
        ctx.lineWidth = 2 + frac * 9;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${frac})`;
        ctx.lineWidth = 1 + frac * 4;
        ctx.stroke();
      }
    }

    // Popups
    for (const p of this.popups) {
      ctx.save();
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, p.text, p.x, p.y, p.color);
      ctx.restore();
    }

    // Top progress bar inside chopping dojo
    drawProgressBar(ctx, cx - 150, b.y + 72, 300, 14, this.slicedCount / this.targetSlices, '#FCA311');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11.5px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`ĐÃ CHÉM: ${this.slicedCount} / ${this.targetSlices}`, cx, b.y + 79);

    ctx.restore();
    if (this.result) renderResultStamp(ctx, this.result, this.finishTimer);
  }
}
