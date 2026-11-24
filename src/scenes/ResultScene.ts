// ============================================================
// ResultScene — Dopamine Reward Screen with Both Cat NPCs,
// Reward Chest, New Dish Unlock Showcase & Shop Upgrade Link
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Recipe } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { formatMoney, randFloat } from '../utils/math';
import { TweenManager } from '../utils/animation';
import { getRecipe } from '../data/recipes';
import { getNewlyUnlockedRecipes, getLevel } from '../data/levels';
import { GameScene } from './GameScene';
import { MapScene } from './MapScene';
import { ShopScene, SHOP_ITEMS, getShopItemCost } from './ShopScene';
import { StoryScene } from './StoryScene';
import { MarketRunnerScene } from './MarketRunnerScene';
import { GangsterBattleScene } from './GangsterBattleScene';

export interface ResultData {
  levelId: number;
  dayName: string;
  customersServed: number;
  targetCustomers: number;
  moneyEarned: number;
  rewardBonus: number;
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

  private moneyDisplay = { value: 0 };
  private bonusDisplay = { value: 0 };

  private starAnims: StarAnim[] = [];
  private starRevealTimer = 0;
  private starsRevealed = 0;

  private confetti: ConfettiParticle[] = [];
  private showConfetti = false;
  private unlockedNextRecipes: Recipe[] = [];
  private canAffordUpgrade = false;

  private buttons: { label: string; rect: Rect; color: string; action: string; badge?: string }[] = [];
  private removeClick?: () => void;
  private elapsed = 0;

  constructor(engine: Engine, data: ResultData) {
    this.engine = engine;
    this.data = data;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('menu');
    this.engine.audio.playSfx(this.data.stars > 0 ? 'win' : 'lose');
    this.elapsed = 0;
    this.starsRevealed = 0;
    this.starRevealTimer = 0.45;
    this.confetti = [];
    this.showConfetti = this.data.stars >= 2;
    if (this.showConfetti) this.spawnConfetti(36);

    // Check newly unlocked dishes for the next level!
    this.unlockedNextRecipes = [];
    if (this.data.stars > 0 && this.data.levelId < 50) {
      const nextIds = getNewlyUnlockedRecipes(this.data.levelId + 1);
      for (const rid of nextIds) {
        const r = getRecipe(rid);
        if (r) {
          this.unlockedNextRecipes.push(r);
          this.engine.save.unlockRecipe(r.id);
        }
      }
    }

    // Check if player can afford any Shop upgrade right now!
    const money = this.engine.save.current.money;
    this.canAffordUpgrade = SHOP_ITEMS.some((item) => {
      const lv = this.engine.save.getUpgradeLevel(item.id);
      return lv < item.maxLevel && money >= getShopItemCost(item, lv);
    });

    this.starAnims = [];
    for (let i = 0; i < 3; i++) {
      this.starAnims.push({ scale: 0, alpha: 0, revealed: false });
    }

    this.tweens.to(this.moneyDisplay, { value: this.data.moneyEarned }, 900, 'easeOutQuad');
    this.tweens.to(this.bonusDisplay, { value: this.data.rewardBonus }, 1100, 'easeOutQuad');

    // 4 crisp touch-friendly buttons
    const btnW = 192;
    const btnH = 50;
    const gap = 14;
    const totalW = 4 * btnW + 3 * gap;
    const startX = (960 - totalW) / 2;
    const btnY = 456;

    this.buttons = [
      {
        label: '🔄 Chơi lại',
        rect: { x: startX, y: btnY, width: btnW, height: btnH },
        color: '#6C757D',
        action: 'retry',
      },
      {
        label: '🏪 Nâng cấp',
        rect: { x: startX + (btnW + gap), y: btnY, width: btnW, height: btnH },
        color: '#D97706',
        action: 'shop',
        badge: this.canAffordUpgrade ? 'MỚI!' : undefined,
      },
      {
        label: this.data.levelId < 50 ? '▶ Màn tiếp!' : '👑 Hoàn thành!',
        rect: { x: startX + 2 * (btnW + gap), y: btnY, width: btnW, height: btnH },
        color: this.data.stars > 0 ? '#2d9348' : '#475569',
        action: 'next',
      },
      {
        label: '🗺 Bản đồ VN',
        rect: { x: startX + 3 * (btnW + gap), y: btnY, width: btnW, height: btnH },
        color: '#2A9D8F',
        action: 'map',
      },
    ];

    this.removeClick = this.engine.input.onClick((pos) => {
      for (const btn of this.buttons) {
        if (InputManager.hitTest(pos, btn.rect, 6)) {
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
      case 'retry':
        this.engine.scenes.replace(new GameScene(this.engine, this.data.levelId));
        break;
      case 'shop':
        this.engine.scenes.replace(new ShopScene(this.engine, 'map'));
        break;
      case 'next': {
        if (this.data.stars <= 0) {
          this.engine.scenes.replace(new GameScene(this.engine, this.data.levelId));
          return;
        }
        const nextId = Math.min(50, this.data.levelId + 1);
        const startLevel = (bonusStock = 0): void => {
          const nextLevel = getLevel(nextId);
          const seen = this.engine.save.current.seenChapters ?? [];
          if (nextLevel && !seen.includes(nextLevel.chapter)) {
            this.engine.save.update({ seenChapters: [...seen, nextLevel.chapter] });
            this.engine.scenes.replace(
              new StoryScene(this.engine, nextLevel.chapter, () => {
                this.engine.scenes.replace(new GameScene(this.engine, nextId, false, bonusStock));
              }),
            );
          } else {
            this.engine.scenes.replace(new GameScene(this.engine, nextId, false, bonusStock));
          }
        };

        // Exciting between-level random events!
        // Guaranteed early preview: Lv 1→2 runs Market Runner, Lv 2→3 runs Gangster Cat Raid!
        const roll = Math.random();
        if (this.data.levelId === 1 || (this.data.levelId >= 3 && roll < 0.35)) {
          this.engine.scenes.replace(
            new MarketRunnerScene(this.engine, (bonusStock) => startLevel(bonusStock)),
          );
        } else if (this.data.levelId === 2 || (this.data.levelId >= 3 && roll < 0.65)) {
          this.engine.scenes.replace(
            new GangsterBattleScene(this.engine, () => startLevel(0)),
          );
        } else {
          startLevel(0);
        }
        break;
      }
      case 'map':
        this.engine.scenes.replace(new MapScene(this.engine));
        break;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.tweens.update(dt);

    // Staggered star pop-in
    this.starRevealTimer -= dt;
    if (this.starRevealTimer <= 0 && this.starsRevealed < this.data.stars) {
      const idx = this.starsRevealed;
      this.starAnims[idx].revealed = true;
      this.engine.audio.playSfx('coin');
      this.tweens.to(this.starAnims[idx] as unknown as Record<string, number>, { scale: 1, alpha: 1 }, 420, 'easeOutBack');
      this.starsRevealed++;
      this.starRevealTimer = 0.28;
    }

    // Update confetti
    if (this.showConfetti) {
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const p = this.confetti[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 170 * dt;
        p.rotation += p.rotSpeed * dt;
        p.alpha -= 0.28 * dt;
        if (p.alpha <= 0 || p.y > 580) this.confetti.splice(i, 1);
      }
      if (this.confetti.length < 45 && this.elapsed < 5) {
        this.spawnConfetti(4);
      }
    }
  }

  private spawnConfetti(count = 24): void {
    const colors = ['#E63946', '#F4A261', '#2A9D8F', '#E9C46A', '#457B9D', '#FCA311'];
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: randFloat(180, 780),
        y: randFloat(-20, 80),
        vx: randFloat(-110, 110),
        vy: randFloat(-180, -40),
        size: randFloat(5, 10),
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
    grad.addColorStop(0, '#16152c');
    grad.addColorStop(1, '#1e1c3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Both Cat NPCs celebrating on Left & Right!
    const bobA = Math.sin(this.elapsed * 3.5) * 6;
    const bobB = Math.sin(this.elapsed * 3.5 + 1.4) * 6;
    ctx.imageSmoothingEnabled = true;

    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const img = this.engine.assets.getImage('npc_cat_boss');
      const dh = 195;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, 24, 232 + bobA, dw, dh);
    }
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const dh = 175;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, W - dw - 24, 248 + bobB, dw, dh);
    }

    // Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px "Segoe UI", system-ui, sans-serif';
    const headline =
      this.data.stars >= 3 ? `🎉 ${this.data.dayName} — XUẤT SẮC!`
      : this.data.stars >= 1 ? `🍜 ${this.data.dayName} — QUA MÀN!`
      : `😿 ${this.data.dayName} — THỬ LẠI NÀO!`;
    drawTextShadow(ctx, headline, W / 2, 46, '#FCA311');

    // 3 Stars
    const starY = 104;
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 68;
      ctx.font = '46px "Segoe UI"';
      ctx.fillStyle = '#334155';
      ctx.fillText('☆', x, starY);

      const anim = this.starAnims[i];
      if (anim.revealed) {
        ctx.save();
        ctx.translate(x, starY);
        ctx.scale(anim.scale, anim.scale);
        ctx.globalAlpha = anim.alpha;
        ctx.fillText('⭐', 0, 0);
        ctx.restore();
      }
    }

    // Center Rewards Card
    const cardW = 470;
    const cardH = this.unlockedNextRecipes.length > 0 ? 226 : 196;
    const cardX = (W - cardW) / 2;
    const cardY = 148;

    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(15, 18, 36, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const rows = [
      { label: '👥 Khách đã phục vụ:', val: `${this.data.customersServed} / ${this.data.targetCustomers}`, col: '#fff' },
      { label: '💰 Tiền bán hàng:', val: formatMoney(Math.floor(this.moneyDisplay.value)), col: '#80ed99' },
      { label: '🎁 Rương thưởng qua màn:', val: `+${formatMoney(Math.floor(this.bonusDisplay.value))}`, col: '#ffd166' },
      { label: '🔥 Combo cao nhất:', val: `x${this.data.maxCombo}`, col: '#f4a261' },
    ];

    for (let i = 0; i < rows.length; i++) {
      const ry = cardY + 30 + i * 32;
      ctx.textAlign = 'left';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(rows[i].label, cardX + 24, ry);

      ctx.textAlign = 'right';
      ctx.font = 'bold 18px monospace';
      drawTextShadow(ctx, rows[i].val, cardX + cardW - 24, ry, rows[i].col);
    }

    // Newly Unlocked Dish Showcase Banner right inside the Reward Card!
    if (this.unlockedNextRecipes.length > 0) {
      const dish = this.unlockedNextRecipes[0];
      const uY = cardY + 152;
      roundRect(ctx, cardX + 16, uY, cardW - 32, 60, 12);
      ctx.fillStyle = 'rgba(42, 157, 143, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const foodKey = `food_${dish.id}`;
      if (this.engine.assets.hasImage(foodKey)) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.engine.assets.getImage(foodKey), cardX + 26, uY + 6, 48, 48);
      }

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#80ed99';
      ctx.fillText('🆕 MỞ KHÓA MÓN MỚI CHO MÀN TIẾP THEO!', cardX + 84, uY + 20);

      ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, `${dish.name} (${dish.nameEn})`, cardX + 84, uY + 42, '#fff');
    }

    // Cat Duo Reaction Strip below card
    const reactY = cardY + cardH + 26;
    const catReaction =
      this.data.stars >= 3
        ? '👑 Vằn & 🐾 Mèo Vàng: "Tuyệt đỉnh 3 sao!! Vào tiệm nâng cấp hoặc qua màn mới chinh phục tiếp thôi!!"'
        : this.data.stars >= 1
          ? '🐾 Mèo Vàng: "Qua màn ngon lành rồi! Nâng cấp thêm đồ nghề là lần sau gom trọn 3 sao ngay!"'
          : '👑 Vằn Bếp Trưởng: "Chưa đủ khách rồi! Bình tĩnh làm lại cùng ta nhé, nhất định thắng!"';

    ctx.textAlign = 'center';
    ctx.font = 'italic 14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(catReaction, W / 2, reactY);

    // 4 Action Buttons
    for (const btn of this.buttons) {
      const hover = InputManager.hitTest(this.engine.input.pointer, btn.rect);
      roundRect(ctx, btn.rect.x, btn.rect.y, btn.rect.width, btn.rect.height, 12);
      ctx.fillStyle = hover ? btn.color : this.darken(btn.color, 0.16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, btn.label, btn.rect.x + btn.rect.width / 2, btn.rect.y + btn.rect.height / 2, '#fff');

      // Pulsing "MỚI!" badge on Shop button if player can afford an upgrade!
      if (btn.badge) {
        const bx = btn.rect.x + btn.rect.width - 42;
        const by = btn.rect.y - 10;
        roundRect(ctx, bx, by, 48, 22, 11);
        ctx.fillStyle = '#e63946';
        ctx.fill();
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(btn.badge, bx + 24, by + 11);
      }
    }

    // Confetti
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
