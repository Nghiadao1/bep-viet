// ============================================================
// ShopScene — Interactive Restaurant Upgrade Shop
// Hosted by Mèo Vàng Phụ Bếp & Vằn Bếp Trưởng!
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, SaveData } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { formatMoney } from '../utils/math';
import { ParticleSystem } from '../systems/ParticleSystem';
import { MapScene } from './MapScene';
import { MenuScene } from './MenuScene';

export interface ShopItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  baseCost: number;
  maxLevel: number;
  color: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'mo_rong_quan',
    icon: '🏪',
    name: 'Mở Rộng Quán (Xe Đẩy → 5 Sao)',
    desc: 'Nâng cấp không gian quán, +2 phần nguyên liệu sơ chế & +15% giá bán!',
    baseCost: 120,
    maxLevel: 3,
    color: '#38BDF8',
  },
  {
    id: 'thuong_meo_vang',
    icon: '🐾',
    name: 'Mèo Vàng Chiêu Tài',
    desc: '+20% tiền Tips & thưởng Rương mỗi cấp',
    baseCost: 100,
    maxLevel: 5,
    color: '#F4A261',
  },
  {
    id: 'quay_am_cung',
    icon: '🏮',
    name: 'Đèn Lồng Ấm Cúng',
    desc: '+25% kiên nhẫn khách hàng mỗi cấp',
    baseCost: 110,
    maxLevel: 5,
    color: '#E76F51',
  },
  {
    id: 'gia_vi_hoang_gia',
    icon: '🌶️',
    name: 'Gia Vị Thượng Hạng',
    desc: '+20% giá bán tất cả món ăn mỗi cấp',
    baseCost: 130,
    maxLevel: 5,
    color: '#E63946',
  },
  {
    id: 'dao_bep_truong',
    icon: '👑',
    name: 'Bí Kíp Vằn Bếp Trưởng',
    desc: '+10% điểm chất lượng & +1 phần sơ chế mỗi cấp',
    baseCost: 160,
    maxLevel: 3,
    color: '#FCA311',
  },
  {
    id: 'phu_bep_sieu_toc',
    icon: '⚡',
    name: 'Phụ Bếp Thần Tốc',
    desc: 'Mèo Vàng tự tiếp tế nhanh & giảm số bước sơ chế!',
    baseCost: 190,
    maxLevel: 3,
    color: '#2A9D8F',
  },
];

export interface StallTierInfo {
  tier: 1 | 2 | 3 | 4;
  name: string;
  icon: string;
  bgKey: string;
  stockBonus: number;
  priceBonus: number;
}

export const STALL_TIERS: StallTierInfo[] = [
  {
    tier: 1,
    name: 'Xe Đẩy Vỉa Hè',
    icon: '🛒',
    bgKey: 'bg_stall_1',
    stockBonus: 0,
    priceBonus: 0,
  },
  {
    tier: 2,
    name: 'Quán Vỉa Hè Mái Hiên',
    icon: '⛺',
    bgKey: 'bg_stall_2',
    stockBonus: 2,
    priceBonus: 0.15,
  },
  {
    tier: 3,
    name: 'Quán Gia Truyền Phố Cổ',
    icon: '🏮',
    bgKey: 'bg_stall_3',
    stockBonus: 4,
    priceBonus: 0.3,
  },
  {
    tier: 4,
    name: 'Nhà Hàng Bếp Việt 5 Sao',
    icon: '👑',
    bgKey: 'bg_stall_4',
    stockBonus: 6,
    priceBonus: 0.5,
  },
];

/**
 * Determine the player's current Stall Tier (1 = Humble Pushcart → 4 = 5-Star Restaurant).
 * Players can expand early by buying `mo_rong_quan` in Shop, OR naturally expand as they
 * reach new chapters!
 */
export function getStallTier(save: Readonly<SaveData>, levelId?: number): StallTierInfo {
  const shopLv = save.upgrades['mo_rong_quan'] ?? 0;
  const lv = levelId ?? save.currentLevel;
  const progressTier = lv >= 31 ? 3 : lv >= 21 ? 2 : lv >= 11 ? 1 : 0;
  const idx = Math.min(3, Math.max(shopLv, progressTier));
  return STALL_TIERS[idx];
}

export interface ActiveUpgradeBonuses {
  priceMultiplier: number;
  tipMultiplier: number;
  patienceMultiplier: number;
  minigameQualityBonus: number;
  autoSkipStepBonus: number;
  prepStockBonus: number;
}

/** Calculate active gameplay bonuses from purchased Shop upgrades */
export function getUpgradeBonuses(save: Readonly<SaveData>, levelId?: number): ActiveUpgradeBonuses {
  const tipLv = save.upgrades['thuong_meo_vang'] ?? 0;
  const patLv = save.upgrades['quay_am_cung'] ?? 0;
  const priceLv = save.upgrades['gia_vi_hoang_gia'] ?? 0;
  const qualLv = save.upgrades['dao_bep_truong'] ?? 0;
  const speedLv = save.upgrades['phu_bep_sieu_toc'] ?? 0;
  const stall = getStallTier(save, levelId);

  return {
    priceMultiplier: 1 + priceLv * 0.2 + stall.priceBonus,
    tipMultiplier: 1 + tipLv * 0.2,
    patienceMultiplier: 1 + patLv * 0.25,
    minigameQualityBonus: qualLv * 10,
    autoSkipStepBonus: speedLv,
    prepStockBonus: stall.stockBonus + qualLv,
  };
}

export function getShopItemCost(item: ShopItem, currentLevel: number): number {
  return Math.round((item.baseCost * Math.pow(1.45, currentLevel)) / 10) * 10;
}

export class ShopScene implements Scene {
  private engine: Engine;
  private returnTo: 'map' | 'menu';
  private particles = new ParticleSystem();
  private elapsed = 0;

  private backBtn: Rect = { x: 20, y: 14, width: 128, height: 42 };
  private buyBtns: Array<{ item: ShopItem; rect: Rect }> = [];
  private catQuote = 'Chào mừng tới tiệm nâng cấp của Mèo Vàng! Mua đồ xịn để nấu siêu tốc và nhận thật nhiều Tips nha~ 🐾';
  private removeClick?: () => void;

  constructor(engine: Engine, returnTo: 'map' | 'menu' = 'map') {
    this.engine = engine;
    this.returnTo = returnTo;
  }

  enter(): void {
    this.engine.input.clear();
    this.elapsed = 0;
    this.particles.clear();

    // Build 6 item cards cleanly on the right
    this.buyBtns = [];
    const listX = 290;
    const listW = 640;
    const rowH = 66;
    const gap = 8;
    const startY = 76;

    SHOP_ITEMS.forEach((item, idx) => {
      const y = startY + idx * (rowH + gap);
      this.buyBtns.push({
        item,
        rect: { x: listX + listW - 144, y: y + 12, width: 130, height: 42 },
      });
    });

    this.removeClick = this.engine.input.onClick((pos) => {
      if (InputManager.hitTest(pos, this.backBtn, 6)) {
        this.engine.scenes.replace(
          this.returnTo === 'menu' ? new MenuScene(this.engine) : new MapScene(this.engine),
        );
        return;
      }

      for (const { item, rect } of this.buyBtns) {
        if (InputManager.hitTest(pos, rect, 6)) {
          this.tryBuy(item, rect);
          return;
        }
      }
    });
  }

  private tryBuy(item: ShopItem, rect: Rect): void {
    const lv = this.engine.save.getUpgradeLevel(item.id);
    if (lv >= item.maxLevel) {
      this.catQuote = `${item.name} đã đạt cấp TỐI ĐA rồi đó! Quá đỉnh luôn! ⭐`;
      return;
    }

    const cost = getShopItemCost(item, lv);
    if (!this.engine.save.spendMoney(cost)) {
      this.engine.audio.playSfx('error');
      this.catQuote = `Chưa đủ tiền rồi! Cần ${formatMoney(cost)} — chơi thêm 1 màn nhận Rương Thưởng là đủ ngay! 🪙`;
      this.particles.emitAngryPuff(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return;
    }

    this.engine.save.buyUpgrade(item.id);
    this.engine.audio.playSfx('perfect');
    this.particles.emitStarburst(rect.x + rect.width / 2, rect.y + rect.height / 2, '#ffd166', 24);
    this.particles.emitFloatingText(
      rect.x + rect.width / 2,
      rect.y,
      `⬆️ Lv.${lv + 1}!`,
      '#4CAF50',
      20,
    );
    this.catQuote = `Chốt đơn ${item.name} Lv.${lv + 1}!! Vằn Bếp Trưởng chắc chắn sẽ rất hài lòng! 🎉`;
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const save = this.engine.save.current;

    // Warm dark shop background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#18142b');
    bg.addColorStop(1, '#241b35');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Back button
    const backHover = InputManager.hitTest(this.engine.input.pointer, this.backBtn);
    roundRect(ctx, this.backBtn.x, this.backBtn.y, this.backBtn.width, this.backBtn.height, 10);
    ctx.fillStyle = backHover ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '← Quay lại', this.backBtn.x + this.backBtn.width / 2, this.backBtn.y + this.backBtn.height / 2);

    // Title
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🏪 Tiệm Nâng Cấp Quán Bếp Việt', W / 2, 34, '#FCA311');

    // Money counter pill top-right
    roundRect(ctx, W - 188, 14, 168, 42, 12);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 18px monospace';
    drawTextShadow(ctx, `💰 ${formatMoney(save.money)}`, W - 104, 35, '#80ed99');

    // Left Shopkeeper Card (Mèo Vàng Phụ Bếp + Current Stall Tier preview!)
    const stall = getStallTier(save);
    const leftRect: Rect = { x: 24, y: 76, width: 244, height: 438 };
    roundRect(ctx, leftRect.x, leftRect.y, leftRect.width, leftRect.height, 16);
    ctx.fillStyle = 'rgba(15, 16, 30, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Current Stall Tier Pill on top of left card
    roundRect(ctx, leftRect.x + 12, leftRect.y + 12, leftRect.width - 24, 34, 10);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `${stall.icon} Cấp ${stall.tier}: ${stall.name}`, leftRect.x + leftRect.width / 2, leftRect.y + 29, '#7dd3fc');

    const bob = Math.sin(this.elapsed * 3) * 4;
    ctx.imageSmoothingEnabled = true;
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const dh = 148;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, leftRect.x + (leftRect.width - dw) / 2, leftRect.y + 52 + bob, dw, dh);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🐾 Tiệm Mèo Vàng', leftRect.x + leftRect.width / 2, leftRect.y + 216, '#F4A261');

    // Shopkeeper speech bubble
    roundRect(ctx, leftRect.x + 14, leftRect.y + 238, leftRect.width - 28, 186, 12);
    ctx.fillStyle = 'rgba(255, 252, 245, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 162, 97, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapText(ctx, this.catQuote, leftRect.x + 26, leftRect.y + 252, leftRect.width - 52, 21);

    // Right: 6 Upgrade Cards
    const listX = 290;
    const listW = 640;
    const rowH = 66;
    const gap = 8;
    const startY = 76;

    SHOP_ITEMS.forEach((item, idx) => {
      const y = startY + idx * (rowH + gap);
      const lv = this.engine.save.getUpgradeLevel(item.id);
      const isMax = lv >= item.maxLevel;
      const cost = getShopItemCost(item, lv);
      const canAfford = !isMax && save.money >= cost;

      roundRect(ctx, listX, y, listW, rowH, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = canAfford ? item.color : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = canAfford ? 2 : 1;
      ctx.stroke();

      // Icon badge
      roundRect(ctx, listX + 10, y + 9, 48, 48, 10);
      ctx.fillStyle = `${item.color}33`;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '25px "Segoe UI"';
      ctx.fillText(item.icon, listX + 34, y + 33);

      // Name & desc
      ctx.textAlign = 'left';
      ctx.font = 'bold 15.5px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, item.name, listX + 68, y + 20, '#fff');

      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.fillText(item.desc, listX + 68, y + 39);

      // Level dots
      for (let p = 0; p < item.maxLevel; p++) {
        ctx.beginPath();
        ctx.arc(listX + 74 + p * 15, y + 55, 4, 0, Math.PI * 2);
        ctx.fillStyle = p < lv ? '#FCA311' : 'rgba(255, 255, 255, 0.18)';
        ctx.fill();
      }

      // Buy button
      const btn = this.buyBtns[idx].rect;
      const hover = InputManager.hitTest(this.engine.input.pointer, btn);
      roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 10);
      if (isMax) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.35)';
      } else if (canAfford) {
        ctx.fillStyle = hover ? '#4CAF50' : '#2d9348';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      }
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        isMax ? '⭐ TỐI ĐA' : `🪙 ${formatMoney(cost)}`,
        btn.x + btn.width / 2,
        btn.y + btn.height / 2,
        isMax ? '#80ed99' : canAfford ? '#fff' : '#94a3b8',
      );
    });

    // Particles on top!
    this.particles.render(ctx);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, cy);
        line = word + ' ';
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), x, cy);
  }
}
