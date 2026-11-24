// ============================================================
// GameScene — 2-Phase Vietnamese Street Food Cooking Loop!
//   🌅 PHASE 1 (PREP): Challenging moving-target minigames to
//      prepare stock trays (broth, meat, worm-catching herbs,
//      Fruit-Ninja aromatics, bread, grill, etc.).
//   🏮 PHASE 2 (SERVICE — Cooking Fever Style Pick & Mix!):
//      • Customers order 1–3 stacked dishes simultaneously on
//        vertical white order cards with side patience bars!
//      • 3 parallel serving plates on a wooden counter ledge —
//        pick prepped ingredients + toppings to assemble dishes!
//      • Patience-boost Iced Tea dispenser (from Fishing minigame)!
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Recipe, LevelConfig, CookingStep } from '../types';
import { StationType, CustomerMood, CustomerType } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { formatMoney, formatTime, clamp, lerp, randFloat, randPick } from '../utils/math';
import { RECIPES, getRecipe } from '../data/recipes';
import { getLevel } from '../data/levels';
import { CUSTOMERS } from '../data/customers';
import { ResultScene } from './ResultScene';
import { MapScene } from './MapScene';
import {
  getUpgradeBonuses,
  getStallTier,
  type ActiveUpgradeBonuses,
  type StallTierInfo,
} from './ShopScene';
import { isTouchDevice, supportsFullscreen, toggleFullscreen } from '../utils/mobile';
import { TutorialSystem, type TutorialTarget } from '../systems/TutorialSystem';
import { CatCompanionSystem } from '../systems/CatCompanionSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import {
  generateCustomerTaste,
  getToppingPoolForRecipe,
  formatTasteSpeech,
  type CustomerTasteOrder,
  type ToppingOption,
} from '../data/tastes';
import { createMinigameForStep } from '../minigames/MinigameFactory';
import type { CookingMinigame } from '../minigames/types';

// ---- Data Structures ----

type ShiftPhase = 'prep' | 'service';

interface PrepTray {
  type: StationType;
  label: string;
  shortName: string;
  sampleRecipe: Recipe;
  sampleStep: CookingStep;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  prepped: boolean;
  needsPlayerPrep: boolean;
  stock: number;
  maxStock: number;
  quality: number; // 0..100 from prep minigame!
  flashTimer: number;
}

interface CustomerOrderItem {
  recipe: Recipe;
  taste: CustomerTasteOrder;
  served: boolean;
}

interface InlineCustomer {
  id: number;
  customerType: CustomerType;
  x: number;
  y: number;
  targetX: number;
  width: number;
  height: number;
  patience: number;
  maxPatience: number;
  orderItems: CustomerOrderItem[]; // 1 to 3 dishes per customer!
  mood: CustomerMood;
  served: boolean;
  leaving: boolean;
  warnedImpatient: boolean;
  speechText: string;
  speechTimer: number;
  orderBubbleAlpha: number;
}

interface ServingPlate {
  targetRecipe: Recipe | null;
  bases: StationType[];
  toppings: Set<string>;
  readyRecipe: Recipe | null;
  flashTimer: number;
}

const STATION_COLORS: Record<StationType, string> = {
  [StationType.BROTH]: '#B5651D',
  [StationType.NOODLE]: '#E9C46A',
  [StationType.MEAT]: '#CD5C5C',
  [StationType.VEGGIE]: '#4CAF50',
  [StationType.SAUCE]: '#F48C06',
  [StationType.BREAD]: '#DEB887',
  [StationType.GRILL]: '#D00000',
  [StationType.WOK]: '#64748B',
  [StationType.DRINK]: '#3B82F6',
  [StationType.DESSERT]: '#C084FC',
};

const STATION_META: Record<StationType, { icon: string; name: string; prepHint: string }> = {
  [StationType.BROTH]: { icon: '🍲', name: 'Nước dùng', prepHint: 'Ninh lửa bám vùng' },
  [StationType.NOODLE]: { icon: '🍜', name: 'Bánh phở', prepHint: 'Cắt / Trụng sợi' },
  [StationType.MEAT]: { icon: '🥩', name: 'Thịt thái', prepHint: 'Thái góc biến hóa' },
  [StationType.VEGGIE]: { icon: '🥬', name: 'Rau thơm', prepHint: 'Nhặt rau bắt sâu 🐛' },
  [StationType.SAUCE]: { icon: '🍉', name: 'Hành tỏi & Sốt', prepHint: 'Chém gia vị Ninja!' },
  [StationType.BREAD]: { icon: '🥖', name: 'Bánh mì', prepHint: 'Xẻ ổ bánh giòn' },
  [StationType.GRILL]: { icon: '🔥', name: 'Đồ nướng', prepHint: 'Nướng than 2 mặt' },
  [StationType.WOK]: { icon: '🍳', name: 'Nhân xào', prepHint: 'Hất chảo lửa lớn' },
  [StationType.DRINK]: { icon: '☕', name: 'Đồ uống', prepHint: 'Rót tầng / Đập đá' },
  [StationType.DESSERT]: { icon: '🍮', name: 'Chè & Tráng miệng', prepHint: 'Rót tầng / Đập đá' },
};

export class GameScene implements Scene {
  private engine: Engine;
  private levelId: number;
  private forceTutorial: boolean;
  private marketBonusStock: number;
  private shiftDelaySec: number;

  private levelConfig!: LevelConfig;
  private bonuses!: ActiveUpgradeBonuses;
  private stallTier!: StallTierInfo;
  private sloganTipMult = 1;

  // 2-Phase Gameplay State
  private phase: ShiftPhase = 'prep';
  private phaseBannerText = '';
  private phaseBannerTimer = 0;

  // Economy & Progress
  private timeRemaining = 0;
  private paused = false;
  private gameOver = false;
  private money = 0;
  private customersServed = 0;
  private targetCustomers = 3;
  private minigameCounter = 0;
  private difficulty = 0; // Smooth 0.0 (Lv 1) -> 1.0 (Lv 50)
  private combo = 0;
  private maxCombo = 0;
  private winDelayTimer = 0;
  private reachedThreeStars = false;

  // Pre-Level Briefing
  private briefingOpen = false;
  private briefingElapsed = 0;
  private startBriefingBtn: Rect = { x: 350, y: 446, width: 260, height: 54 };

  // Entities
  private recipes: Recipe[] = [];
  private trays: PrepTray[] = [];
  private seasoningQuality = 88;
  private customers: InlineCustomer[] = [];
  private spawnTimer = 0;
  private nextCustomerId = 0;

  // Phase 2: Ref-Style 3 Parallel Serving Plates + Multi-Dish Selection!
  private selectedCustomerId: number | null = null;
  private selectedItemIdx = 0;
  private plates: ServingPlate[] = [];
  private activePlateIdx = 0;
  private plateRects: Rect[] = [
    { x: 316, y: 198, width: 138, height: 78 },
    { x: 462, y: 198, width: 138, height: 78 },
    { x: 608, y: 198, width: 138, height: 78 },
  ];
  private teaBtn: Rect = { x: 758, y: 198, width: 100, height: 78 };
  private trashBtn: Rect = { x: 866, y: 198, width: 76, height: 78 };
  private toppingJarRects: Array<{ option: ToppingOption; rect: Rect }> = [];

  // UI Rects
  private pauseBtn: Rect = { x: 896, y: 6, width: 52, height: 40 };
  private fullscreenBtn: Rect = { x: 838, y: 6, width: 50, height: 40 };
  private muteBtn: Rect = { x: 786, y: 6, width: 44, height: 40 };
  private finishEarlyBtn: Rect = { x: 562, y: 8, width: 112, height: 36 };
  private openShopNowBtn: Rect = { x: 350, y: 432, width: 260, height: 54 };
  private resumeBtn: Rect = { x: 318, y: 290, width: 156, height: 52 };
  private exitMapBtn: Rect = { x: 486, y: 290, width: 156, height: 52 };

  // Systems
  private tutorial: TutorialSystem;
  private cats: CatCompanionSystem;
  private particles = new ParticleSystem();
  private activeMinigame: CookingMinigame | null = null;
  private activePrepTrayIndex = -1;

  // Input listeners
  private removeClick?: () => void;
  private removeDown?: () => void;
  private removeMove?: () => void;
  private removeUp?: () => void;

  // Feedback
  private feedbackText = '';
  private feedbackTimer = 0;
  private feedbackColor = '#fff';
  private elapsed = 0;

  constructor(
    engine: Engine,
    levelId: number,
    forceTutorial = false,
    marketBonusStock = 0,
    shiftDelaySec = 0,
  ) {
    this.engine = engine;
    this.levelId = levelId;
    this.forceTutorial = forceTutorial;
    this.marketBonusStock = marketBonusStock;
    this.shiftDelaySec = Math.max(0, shiftDelaySec);
    this.tutorial = new TutorialSystem(engine);
    this.cats = new CatCompanionSystem(engine);
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('kitchen');
    this.elapsed = 0;

    const cfg = getLevel(this.levelId);
    this.levelConfig = cfg ?? {
      id: this.levelId,
      chapter: 1,
      dayName: `Ngày ${this.levelId}`,
      targetScore: 200,
      minScore: 100,
      timeLimit: 90,
      availableRecipes: ['pho_bo'],
      customerSpawnRate: 6000,
      maxCustomers: 4,
      customerTypes: [],
    };

    this.bonuses = getUpgradeBonuses(this.engine.save.current, this.levelId);
    this.stallTier = getStallTier(this.engine.save.current, this.levelId);
    this.sloganTipMult = this.engine.save.consumeSloganBonus() ? 1.2 : 1.0;

    // Apply Tiến Lên rematch opening delay if Vằn got salty!
    this.timeRemaining = Math.max(32, this.levelConfig.timeLimit - this.shiftDelaySec);
    this.targetCustomers = this.levelConfig.targetCustomers ?? 3;

    // Smooth difficulty curve 0.0 (Lv 1) -> 1.0 (Lv 50) + mission modifier
    const baseDiff = clamp((this.levelId - 1) / 49, 0, 1);
    const missionBoost =
      this.levelConfig.missionType === 'vip_critic' ? 0.12
      : this.levelConfig.missionType === 'rush' ? 0.06
      : this.levelConfig.missionType === 'picky' ? 0.04
      : 0;
    this.difficulty = clamp(baseDiff + missionBoost, 0, 1);

    this.phase = 'prep';
    this.phaseBannerText = '🌅 PHA 1: SƠ CHẾ NGUYÊN LIỆU!';
    this.phaseBannerTimer = 2.0;
    this.money = 0;
    this.customersServed = 0;
    this.minigameCounter = this.levelId;
    this.combo = 0;
    this.maxCombo = 0;
    this.winDelayTimer = 0;
    this.paused = false;
    this.gameOver = false;
    this.reachedThreeStars = false;
    this.activeMinigame = null;
    this.activePrepTrayIndex = -1;
    this.seasoningQuality = 88;
    this.selectedCustomerId = null;
    this.selectedItemIdx = 0;
    this.activePlateIdx = 0;
    this.plates = [this.createEmptyPlate(), this.createEmptyPlate(), this.createEmptyPlate()];
    this.particles.clear();
    this.customers = [];
    this.nextCustomerId = 0;
    this.spawnTimer = 450;
    this.briefingElapsed = 0;

    // Resolve level recipes
    this.recipes = [];
    for (const rid of this.levelConfig.availableRecipes) {
      const r = getRecipe(rid);
      if (r) this.recipes.push(r);
    }
    if (this.recipes.length === 0 && RECIPES[0]) {
      this.recipes.push(RECIPES[0]);
    }

    // Build all ingredient trays needed for today's menu
    this.buildPrepTrays();

    // Tutorial or Pre-Level Briefing
    const willRunTutorial =
      this.forceTutorial || (this.levelId === 1 && !this.engine.save.current.tutorialCompleted);

    if (willRunTutorial) {
      this.briefingOpen = false;
      this.tutorial.start();
    } else {
      this.briefingOpen = true;
    }

    if (this.shiftDelaySec > 0) {
      this.cats.say(
        'golden',
        `Anh Vằn cay cú đánh Tiến Lên làm mở quán trễ mất ${this.shiftDelaySec} giây rồi kìa!! 🃏🙀`,
        5.0,
      );
    } else if (this.marketBonusStock > 0) {
      this.cats.say(
        'golden',
        `Hàng chợ về tới rồi!! Cộng thêm +${this.marketBonusStock} phần nguyên liệu cho mọi khay! 🧺✨`,
        4.5,
      );
    } else if (this.sloganTipMult > 1) {
      this.cats.say(
        'both',
        'Biển hiệu mới hút khách cực đỉnh!! Hôm nay được +20% tiền Tips toàn quán nha!! 📣✨',
        4.5,
      );
    } else {
      this.cats.say(
        'boss',
        `Pha 1 Sơ Chế tại ${this.stallTier.icon} ${this.stallTier.name}! Chuẩn bị nguyên liệu trước khi mở quán nhé! 🔥`,
        4.5,
      );
    }

    // Wire Pointer Input
    this.removeDown = this.engine.input.onDown((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) this.activeMinigame.onDown?.(pos);
    });
    this.removeMove = this.engine.input.onMove((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) this.activeMinigame.onMove?.(pos);
    });
    this.removeUp = this.engine.input.onUp((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) this.activeMinigame.onUp?.(pos);
    });
    this.removeClick = this.engine.input.onClick((pos) => this.handleClick(pos));
  }

  exit(): void {
    this.removeClick?.();
    this.removeDown?.();
    this.removeMove?.();
    this.removeUp?.();
    this.removeClick = undefined;
    this.removeDown = undefined;
    this.removeMove = undefined;
    this.removeUp = undefined;
  }

  private createEmptyPlate(): ServingPlate {
    return {
      targetRecipe: null,
      bases: [],
      toppings: new Set<string>(),
      readyRecipe: null,
      flashTimer: 0,
    };
  }

  /** Build ingredient trays for Phase 1 Prep & Phase 2 Service */
  private buildPrepTrays(): void {
    const stationStepMap = new Map<StationType, { recipe: Recipe; step: CookingStep }>();
    for (const r of this.recipes) {
      for (const s of r.steps) {
        if (!stationStepMap.has(s.stationType)) {
          stationStepMap.set(s.stationType, { recipe: r, step: s });
        }
      }
    }

    if (!stationStepMap.has(StationType.SAUCE) && this.recipes[0]) {
      stationStepMap.set(StationType.SAUCE, {
        recipe: this.recipes[0],
        step: {
          stationType: StationType.SAUCE,
          action: 'Chém hành tỏi & gia vị',
          duration: 1000,
          ingredient: 'Hành, tỏi, ớt, chanh',
        },
      });
    }

    const entries = Array.from(stationStepMap.entries());
    const maxManualPrep = this.bonuses.autoSkipStepBonus >= 2 ? 3 : 4;
    const priorityOrder: StationType[] = [
      StationType.BROTH,
      StationType.VEGGIE,
      StationType.SAUCE,
      StationType.MEAT,
      StationType.BREAD,
      StationType.GRILL,
      StationType.WOK,
      StationType.NOODLE,
      StationType.DRINK,
      StationType.DESSERT,
    ];
    const sortedForPrep = [...entries].sort(
      (a, b) => priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]),
    );
    const manualSet = new Set<StationType>(
      sortedForPrep.slice(0, Math.min(maxManualPrep, entries.length)).map((e) => e[0]),
    );

    const baseStock = 6 + this.bonuses.prepStockBonus + this.marketBonusStock;
    this.trays = entries.map(([type, info]) => {
      const meta = STATION_META[type];
      const needsPlayerPrep = manualSet.has(type);
      return {
        type,
        label: `${meta.icon} ${meta.name}`,
        shortName: meta.name,
        sampleRecipe: info.recipe,
        sampleStep: info.step,
        x: 0,
        y: 228,
        width: 110,
        height: 98,
        color: STATION_COLORS[type] ?? '#FCA311',
        prepped: !needsPlayerPrep,
        needsPlayerPrep,
        stock: needsPlayerPrep ? 0 : baseStock,
        maxStock: baseStock + 4,
        quality: needsPlayerPrep ? 0 : 90,
        flashTimer: 0,
      };
    });

    this.layoutTrays();
  }

  /** Position trays cleanly based on active phase (Ref-style lower workbench in Phase 2!) */
  private layoutTrays(): void {
    const visible = this.getVisibleTrays();
    const count = Math.max(1, visible.length);
    const gap = count > 6 ? 8 : 14;
    const trayW = Math.min(138, Math.floor((916 - (count - 1) * gap) / count));
    const trayH = this.phase === 'prep' ? 128 : 96;
    const trayY = this.phase === 'prep' ? 228 : 292;
    const totalW = count * trayW + (count - 1) * gap;
    const startX = (960 - totalW) / 2;

    visible.forEach((tr, i) => {
      tr.x = startX + i * (trayW + gap);
      tr.y = trayY;
      tr.width = trayW;
      tr.height = trayH;
    });
  }

  private getVisibleTrays(): PrepTray[] {
    if (this.phase === 'prep') return this.trays;
    const nonSauce = this.trays.filter((t) => t.type !== StationType.SAUCE);
    return nonSauce.length > 0 ? nonSauce : this.trays;
  }

  private getRequiredBases(recipe: Recipe): StationType[] {
    const uniq: StationType[] = [];
    for (const s of recipe.steps) {
      if (s.stationType === StationType.SAUCE) continue;
      if (!uniq.includes(s.stationType)) uniq.push(s.stationType);
    }
    return uniq.length > 0 ? uniq : [recipe.steps[0].stationType];
  }

  private getSelectedCustomer(): InlineCustomer | null {
    const waiting = this.customers.filter((c) => !c.served && !c.leaving);
    if (waiting.length === 0) {
      this.selectedCustomerId = null;
      return null;
    }
    const found = waiting.find((c) => c.id === this.selectedCustomerId);
    if (found) return found;
    this.selectedCustomerId = waiting[0].id;
    this.selectedItemIdx = this.firstUnservedIdx(waiting[0]);
    return waiting[0];
  }

  private firstUnservedIdx(c: InlineCustomer): number {
    const idx = c.orderItems.findIndex((it) => !it.served);
    return idx >= 0 ? idx : 0;
  }

  private getSelectedOrderItem(): { customer: InlineCustomer; item: CustomerOrderItem; itemIdx: number } | null {
    const cust = this.getSelectedCustomer();
    if (!cust) return null;
    let idx = this.selectedItemIdx;
    if (idx < 0 || idx >= cust.orderItems.length || cust.orderItems[idx].served) {
      idx = this.firstUnservedIdx(cust);
      this.selectedItemIdx = idx;
    }
    const item = cust.orderItems[idx];
    if (!item || item.served) return null;
    return { customer: cust, item, itemIdx: idx };
  }

  private getActivePlate(): ServingPlate {
    return this.plates[this.activePlateIdx] ?? this.plates[0];
  }

  private refreshToppingBar(): void {
    const activePlate = this.getActivePlate();
    const sel = this.getSelectedOrderItem();
    const recipe = activePlate?.targetRecipe ?? sel?.item.recipe ?? this.recipes[0];
    if (!recipe) {
      this.toppingJarRects = [];
      return;
    }
    const pool =
      sel && sel.item.recipe.id === recipe.id
        ? sel.item.taste.tray
        : getToppingPoolForRecipe(recipe);
    const jarW = 136;
    const jarH = 84;
    const gap = 12;
    const totalW = pool.length * jarW + (pool.length - 1) * gap;
    const startX = (960 - totalW) / 2;
    this.toppingJarRects = pool.map((option, i) => ({
      option,
      rect: { x: startX + i * (jarW + gap), y: 428, width: jarW, height: jarH },
    }));
  }

  /** Compute the Ref-Style vertical white order card geometry for a customer */
  private getCustomerCardRect(c: InlineCustomer): { bx: number; by: number; bw: number; bh: number; itemH: number } {
    const count = c.orderItems.length;
    const itemH = count >= 3 ? 34 : count === 2 ? 38 : 48;
    const bh = count * itemH + 14;
    const bw = 96;
    const bx = c.x + c.width - 2;
    const by = Math.max(54, 178 - bh);
    return { bx, by, bw, bh, itemH };
  }

  // ============================================================
  // Input Handling
  // ============================================================

  private handleClick(pos: { x: number; y: number }): void {
    if (this.gameOver) return;

    // Tutorial modal has top priority
    if (this.tutorial.isModalBlocking && !this.activeMinigame && this.tutorial.handleClick(pos)) {
      return;
    }

    // Top-right Mute, Fullscreen & Pause
    if (InputManager.hitTest(pos, this.muteBtn, 6)) {
      this.engine.audio.toggleMute();
      return;
    }
    if (supportsFullscreen() && InputManager.hitTest(pos, this.fullscreenBtn, 6)) {
      this.engine.audio.playSfx('click');
      void toggleFullscreen();
      return;
    }
    if (InputManager.hitTest(pos, this.pauseBtn, 6)) {
      this.engine.audio.playSfx('click');
      this.paused = !this.paused;
      return;
    }

    if (this.paused) {
      if (InputManager.hitTest(pos, this.resumeBtn, 6)) {
        this.paused = false;
        return;
      }
      if (InputManager.hitTest(pos, this.exitMapBtn, 6)) {
        this.engine.scenes.replace(new MapScene(this.engine));
        return;
      }
      return;
    }

    // Briefing card
    if (this.briefingOpen) {
      if (InputManager.hitTest(pos, this.startBriefingBtn, 16) || this.briefingElapsed > 0.35) {
        this.briefingOpen = false;
        this.engine.audio.playSfx('click');
        this.particles.emitStarburst(480, 270, '#ffd166', 18);
        this.cats.say('boss', 'Pha 1 Sơ Chế bắt đầu! Chạm từng khay phát sáng để chuẩn bị nguyên liệu nhé! 🔥', 4.0);
      }
      return;
    }

    // Early finish button once 3 stars reached in Service Phase
    if (
      this.phase === 'service' &&
      this.reachedThreeStars &&
      !this.activeMinigame &&
      InputManager.hitTest(pos, this.finishEarlyBtn, 6)
    ) {
      this.endGame();
      return;
    }

    // Active cooking minigame consumes clicks
    if (this.activeMinigame) {
      this.activeMinigame.onClick?.(pos);
      return;
    }

    // Tutorial skip button
    if (this.tutorial.handleClick(pos)) return;

    // Pet the live Cat Booth
    if (this.cats.handleClick(pos)) return;

    // ---- PHASE 1: PREP CLICK HANDLING ----
    if (this.phase === 'prep') {
      const visible = this.getVisibleTrays();
      for (const tr of visible) {
        const rect: Rect = { x: tr.x, y: tr.y, width: tr.width, height: tr.height };
        if (InputManager.hitTest(pos, rect, 6)) {
          this.launchPrepMinigame(this.trays.indexOf(tr));
          return;
        }
      }
      if (this.allRequiredPrepped() && InputManager.hitTest(pos, this.openShopNowBtn, 10)) {
        this.beginServicePhase();
      }
      return;
    }

    // ---- PHASE 2: REF-STYLE MULTI-DISH SERVICE CLICK HANDLING ----

    // 1. Tap a Customer OR specific Dish Row on their Vertical Order Card!
    for (const c of this.customers) {
      if (c.served || c.leaving) continue;
      const card = this.getCustomerCardRect(c);

      // Check individual dish rows inside vertical white order card first!
      for (let i = 0; i < c.orderItems.length; i++) {
        const it = c.orderItems[i];
        if (it.served) continue;
        const rowRect: Rect = {
          x: card.bx,
          y: card.by + 7 + i * card.itemH,
          width: card.bw,
          height: card.itemH,
        };
        if (InputManager.hitTest(pos, rowRect, 3)) {
          // If ANY ready plate matches this exact dish, serve it IMMEDIATELY!
          const matchingPlateIdx = this.plates.findIndex(
            (p) => p.readyRecipe && p.readyRecipe.id === it.recipe.id,
          );
          if (matchingPlateIdx >= 0) {
            this.servePlateToCustomerItem(matchingPlateIdx, c, i);
            return;
          }
          this.selectedCustomerId = c.id;
          this.selectedItemIdx = i;
          this.refreshToppingBar();
          this.engine.audio.playSfx('click');
          this.showFeedback(`🎯 Chọn món: ${it.recipe.name}`, '#FCA311');
          this.cats.say('golden', formatTasteSpeech(it.recipe, it.taste), 4.0);
          return;
        }
      }

      // Check clicking the customer body itself
      const bodyRect: Rect = { x: c.x - 4, y: c.y - 6, width: c.width + 8, height: c.height + 12 };
      if (InputManager.hitTest(pos, bodyRect, 4)) {
        // Try delivering ANY ready plate that matches ANY unserved item on this customer!
        for (let pi = 0; pi < this.plates.length; pi++) {
          const p = this.plates[pi];
          if (!p.readyRecipe) continue;
          const matchItemIdx = c.orderItems.findIndex(
            (it) => !it.served && it.recipe.id === p.readyRecipe!.id,
          );
          if (matchItemIdx >= 0) {
            this.servePlateToCustomerItem(pi, c, matchItemIdx);
            return;
          }
        }
        // Otherwise select this customer's first unserved dish
        this.selectedCustomerId = c.id;
        this.selectedItemIdx = this.firstUnservedIdx(c);
        this.refreshToppingBar();
        const item = c.orderItems[this.selectedItemIdx];
        if (item) {
          this.engine.audio.playSfx('click');
          this.showFeedback(`🎯 Đang làm món ${item.recipe.name}!`, '#FCA311');
          this.cats.say('golden', formatTasteSpeech(item.recipe, item.taste), 4.0);
        }
        return;
      }
    }

    // 2. Tap one of the 3 Parallel Serving Plates!
    for (let i = 0; i < this.plateRects.length; i++) {
      if (InputManager.hitTest(pos, this.plateRects[i], 5)) {
        const plate = this.plates[i];
        if (plate.readyRecipe) {
          // One-tap smart delivery to matching customer!
          if (this.tryAutoServePlate(i)) return;
        }
        this.activePlateIdx = i;
        this.engine.audio.playSfx('click');
        this.refreshToppingBar();
        this.showFeedback(`🍽️ Đang chọn Đĩa #${i + 1}`, '#ffd166');
        return;
      }
    }

    // 3. Tap Patience-Boost Iced Tea Dispenser (`🧋 Trà Đá`)!
    if (InputManager.hitTest(pos, this.teaBtn, 6)) {
      this.usePatienceTeaDrink();
      return;
    }

    // 4. Tap Trash Plate Button (`🗑 Bỏ đĩa`)!
    if (InputManager.hitTest(pos, this.trashBtn, 6)) {
      this.clearPlate(this.activePlateIdx, true);
      return;
    }

    // 5. Tap a Prepped Ingredient Tray on the Workbench to add into Active Plate!
    for (const tr of this.getVisibleTrays()) {
      const rect: Rect = { x: tr.x, y: tr.y, width: tr.width, height: tr.height };
      if (InputManager.hitTest(pos, rect, 6)) {
        this.pickIngredientFromTray(tr);
        return;
      }
    }

    // 6. Tap a Topping Jar on the Bottom Shelf!
    for (const { option, rect } of this.toppingJarRects) {
      if (InputManager.hitTest(pos, rect, 6)) {
        this.toggleTopping(option);
        return;
      }
    }
  }

  // ============================================================
  // Phase 1 — Prep Minigame Launch & Completion
  // ============================================================

  private launchPrepMinigame(trayIdx: number): void {
    const tr = this.trays[trayIdx];
    if (!tr || this.activeMinigame) return;

    this.engine.audio.playSfx('click');
    this.activePrepTrayIndex = trayIdx;
    this.minigameCounter++;

    this.activeMinigame = createMinigameForStep(
      {
        engine: this.engine,
        recipe: tr.sampleRecipe,
        step: tr.sampleStep,
        taste: null,
        particles: this.particles,
        difficulty: clamp(this.difficulty + 0.08, 0, 1),
        variationSeed: this.minigameCounter,
      },
      false,
    );
  }

  private completeActiveMinigame(): void {
    const mg = this.activeMinigame;
    if (!mg) return;

    const res = mg.result;
    const idx = this.activePrepTrayIndex;
    this.activeMinigame = null;
    this.activePrepTrayIndex = -1;

    const tr = this.trays[idx];
    if (tr && res) {
      const boostedScore = Math.min(100, res.score + this.bonuses.minigameQualityBonus);
      const earnedPortions =
        boostedScore >= 85 ? 7
        : boostedScore >= 55 ? 6
        : 5;
      const totalPortions = earnedPortions + this.bonuses.prepStockBonus + this.marketBonusStock;

      tr.prepped = true;
      tr.quality = boostedScore;
      tr.stock = Math.min(tr.maxStock + 6, tr.stock + totalPortions);
      tr.flashTimer = 0.85;

      if (tr.type === StationType.SAUCE) {
        this.seasoningQuality = boostedScore;
      }

      const cx = tr.x + tr.width / 2;
      const cy = tr.y + tr.height / 2;
      this.engine.audio.playSfx(boostedScore >= 85 ? 'perfect' : 'pop');
      this.particles.emitStarburst(cx, cy, boostedScore >= 85 ? '#ffd166' : '#4CAF50', 20);
      this.particles.emitFloatingText(
        cx,
        cy - 20,
        `+${totalPortions} phần${boostedScore >= 85 ? ' ⭐' : ''}`,
        '#80ed99',
        18,
      );
      this.cats.say(res.catSpeaker, res.catComment, 4.0);
    }

    if (this.phase === 'prep' && this.allRequiredPrepped()) {
      this.beginServicePhase();
    }
  }

  private allRequiredPrepped(): boolean {
    return this.trays.every((t) => t.prepped);
  }

  private beginServicePhase(): void {
    if (this.phase === 'service') return;
    this.phase = 'service';
    this.layoutTrays();
    this.engine.audio.playSfx('win');
    this.phaseBannerText = `🔔 MỞ ${this.stallTier.name.toUpperCase()} — 3 ĐĨA PICK & MIX!`;
    this.phaseBannerTimer = 2.4;
    this.spawnTimer = 180;
    this.particles.emitStarburst(480, 220, '#ffd166', 30);
    this.cats.say(
      'both',
      'Mở quán rồi!! Ghép tối đa 3 đĩa song song, chạm đĩa xanh hoặc chạm khách để giao siêu tốc!! 🍽️✨',
      4.5,
    );
    this.tutorial.onServicePhaseStarted();
    this.refreshToppingBar();
  }

  // ============================================================
  // Phase 2 — 3-Plate Parallel Pick & Mix + Multi-Dish Serving
  // ============================================================

  private usePatienceTeaDrink(): void {
    const waiting = this.customers.filter((c) => !c.served && !c.leaving);
    if (waiting.length === 0) {
      this.showFeedback('⏳ Chưa có khách chờ để mời trà đá!', '#94a3b8');
      return;
    }
    if (!this.engine.save.useTeaDrink()) {
      this.engine.audio.playSfx('error');
      this.showFeedback('🧋 Hết Trà Đá! Chơi Câu Cá nghỉ trưa 🎣 để kiếm thêm!', '#FCA311');
      this.cats.say('golden', 'Hết Trà Đá rồi! Vào Mini Game Câu Cá Đào Vàng kiếm thêm trà giải nhiệt cho khách nhé! 🎣', 4.0);
      return;
    }

    // Give cold iced tea to the MOST impatient waiting customer!
    const urgent = [...waiting].sort(
      (a, b) => a.patience / a.maxPatience - b.patience / b.maxPatience,
    )[0];
    urgent.patience = Math.min(urgent.maxPatience, urgent.patience + urgent.maxPatience * 0.55);
    urgent.mood = CustomerMood.HAPPY;
    urgent.warnedImpatient = false;
    urgent.speechText = 'Trà đá mát lạnh quá!! Cảm ơn nha~ 🧋✨';
    urgent.speechTimer = 2.4;

    this.engine.audio.playSfx('splash');
    this.particles.emitStarburst(urgent.x + urgent.width / 2, urgent.y + 30, '#38BDF8', 22);
    this.particles.emitFloatingText(urgent.x + urgent.width / 2, urgent.y, '🧋 +55% Kiên nhẫn!', '#7dd3fc', 18);
    this.showFeedback('🧋 Đã mời Trà Đá! Khách hạ hỏa ngay lập tức!', '#7dd3fc');
    this.cats.say('golden', 'Ly trà đá mát lạnh cứu nguy kịp lúc!! Khách vui vẻ chờ tiếp rồi kìa~ 🧋😸', 3.4);
  }

  private pickIngredientFromTray(tr: PrepTray): void {
    const sel = this.getSelectedOrderItem();
    if (!sel && this.customers.filter((c) => !c.served && !c.leaving).length === 0) {
      this.showFeedback('⏳ Chờ khách vào gọi món nhé!', '#FCA311');
      return;
    }

    // If tray ran out of stock mid-shift, quick-refill via minigame!
    if (tr.stock <= 0) {
      this.cats.say('golden', `Hết ${tr.shortName} rồi! Làm nhanh mẻ mới bổ sung liền nhé! ⚡`, 3.0);
      this.launchPrepMinigame(this.trays.indexOf(tr));
      return;
    }

    // If current active plate is already READY, auto-jump to an empty plate so cooking stays lightning-fast!
    let plate = this.getActivePlate();
    if (plate.readyRecipe) {
      const emptyIdx = this.plates.findIndex((p) => !p.readyRecipe && p.bases.length === 0);
      if (emptyIdx >= 0) {
        this.activePlateIdx = emptyIdx;
        plate = this.plates[emptyIdx];
      } else {
        this.engine.audio.playSfx('error');
        this.showFeedback('🍽️ Cả 3 đĩa đang đầy! Chạm đĩa xanh để giao cho khách trước nhé!', '#FCA311');
        return;
      }
    }

    // Bind plate.targetRecipe on first ingredient pick
    if (!plate.targetRecipe) {
      // Prefer the currently selected order item if it uses this ingredient
      if (sel && this.getRequiredBases(sel.item.recipe).includes(tr.type)) {
        plate.targetRecipe = sel.item.recipe;
      } else {
        // Otherwise check ANY waiting customer's unserved order item that needs this ingredient!
        let foundRecipe: Recipe | null = null;
        for (const c of this.customers) {
          if (c.served || c.leaving) continue;
          for (const it of c.orderItems) {
            if (!it.served && this.getRequiredBases(it.recipe).includes(tr.type)) {
              foundRecipe = it.recipe;
              break;
            }
          }
          if (foundRecipe) break;
        }
        // Or fallback to any menu recipe that uses it
        if (!foundRecipe) {
          foundRecipe =
            this.recipes.find((r) => this.getRequiredBases(r).includes(tr.type)) ?? null;
        }
        if (!foundRecipe) {
          this.engine.audio.playSfx('error');
          this.showFeedback(`❌ Không có món nào cần ${tr.shortName}!`, '#E63946');
          return;
        }
        plate.targetRecipe = foundRecipe;
      }
      this.refreshToppingBar();
    }

    const reqBases = this.getRequiredBases(plate.targetRecipe);
    if (!reqBases.includes(tr.type)) {
      this.engine.audio.playSfx('error');
      this.showFeedback(
        `❌ Đĩa #${this.activePlateIdx + 1} đang làm ${plate.targetRecipe.name}, không dùng ${tr.shortName}!`,
        '#E63946',
      );
      this.particles.emitAngryPuff(tr.x + tr.width / 2, tr.y + 24);
      this.particles.shake(3.5, 0.12);
      return;
    }

    if (plate.bases.includes(tr.type)) {
      this.engine.audio.playSfx('click');
      this.showFeedback(`✅ Đĩa #${this.activePlateIdx + 1} đã có ${tr.shortName} rồi!`, '#80ed99');
      return;
    }

    // Consume 1 stock & place into active serving plate!
    tr.stock = Math.max(0, tr.stock - 1);
    tr.flashTimer = 0.35;
    plate.bases.push(tr.type);
    plate.flashTimer = 0.35;
    this.engine.audio.playSfx('pop');

    const pRect = this.plateRects[this.activePlateIdx];
    const pcx = pRect.x + pRect.width / 2;
    const pcy = pRect.y + pRect.height / 2;
    this.particles.emitStarburst(tr.x + tr.width / 2, tr.y + tr.height / 2, '#ffd166', 8);
    this.particles.emitStarburst(pcx, pcy, '#80ed99', 10);
    this.particles.emitFloatingText(pcx, pcy - 24, `+ ${tr.label}`, '#ffd166', 14);

    // Check if dish is complete!
    if (reqBases.every((st) => plate.bases.includes(st))) {
      plate.readyRecipe = plate.targetRecipe;
      this.engine.audio.playSfx('coin');
      this.particles.emitStarburst(pcx, pcy, '#ffd166', 18);
      this.tutorial.onDishReadyToServe();
      this.cats.say(
        'golden',
        `Xong ${plate.readyRecipe.name} ở Đĩa #${this.activePlateIdx + 1}! Rắc gia vị rồi chạm Đĩa xanh để giao!! 🍽️`,
        3.5,
      );
    }
  }

  private toggleTopping(option: ToppingOption): void {
    const plate = this.getActivePlate();
    const sel = this.getSelectedOrderItem();
    const pRect = this.plateRects[this.activePlateIdx];
    const pcx = pRect.x + pRect.width / 2;
    const pcy = pRect.y + pRect.height / 2;

    if (plate.toppings.has(option.id)) {
      plate.toppings.delete(option.id);
      this.engine.audio.playSfx('click');
      this.showFeedback(`Đã gắp ${option.label} khỏi Đĩa #${this.activePlateIdx + 1}`, '#cbd5e1');
      return;
    }

    plate.toppings.add(option.id);
    plate.flashTimer = 0.25;
    this.particles.emitSpiceRain(pcx, pcy, option.color);

    const taste = sel?.item.taste;
    if (taste?.forbidden && option.id === taste.forbidden.id) {
      this.engine.audio.playSfx('error');
      this.particles.emitAngryPuff(pcx, pcy);
      this.particles.shake(4, 0.14);
      this.showFeedback(`🚫 Khách kiêng ${option.label.toUpperCase()}! Chạm lại để gắp ra!`, '#E63946');
      this.cats.say('boss', `Á!! Khách dặn KHÔNG ${option.label} mà! Chạm lại hũ để gắp ra mau!! 🙀`, 3.4);
    } else if (taste?.wanted.some((w) => w.id === option.id)) {
      this.engine.audio.playSfx('spice');
      this.particles.emitStarburst(pcx, pcy, '#ffd166', 8);
      this.showFeedback(`✅ Đúng vị ${option.emoji} ${option.label}!`, '#4CAF50');
    } else {
      this.engine.audio.playSfx('spice');
      this.showFeedback(`Đã rắc ${option.emoji} ${option.label}`, '#FCA311');
    }
  }

  private clearPlate(plateIdx: number, feedback = false): void {
    this.plates[plateIdx] = this.createEmptyPlate();
    this.refreshToppingBar();
    if (feedback) {
      this.engine.audio.playSfx('click');
      this.showFeedback(`🗑 Đã dọn Đĩa #${plateIdx + 1}`, '#FCA311');
    }
  }

  /** One-tap smart delivery from a READY plate to the best matching waiting customer */
  private tryAutoServePlate(plateIdx: number): boolean {
    const plate = this.plates[plateIdx];
    if (!plate.readyRecipe) return false;
    const rid = plate.readyRecipe.id;

    // 1. Prefer the currently selected customer & selected item if it matches!
    const sel = this.getSelectedOrderItem();
    if (sel && sel.item.recipe.id === rid) {
      this.servePlateToCustomerItem(plateIdx, sel.customer, sel.itemIdx);
      return true;
    }
    if (sel) {
      const otherIdx = sel.customer.orderItems.findIndex((it) => !it.served && it.recipe.id === rid);
      if (otherIdx >= 0) {
        this.servePlateToCustomerItem(plateIdx, sel.customer, otherIdx);
        return true;
      }
    }

    // 2. Otherwise serve the MOST impatient waiting customer who ordered this dish!
    const candidates = this.customers
      .filter((c) => !c.served && !c.leaving)
      .sort((a, b) => a.patience / a.maxPatience - b.patience / b.maxPatience);

    for (const c of candidates) {
      const idx = c.orderItems.findIndex((it) => !it.served && it.recipe.id === rid);
      if (idx >= 0) {
        this.servePlateToCustomerItem(plateIdx, c, idx);
        return true;
      }
    }

    this.engine.audio.playSfx('error');
    this.showFeedback(`⏳ Hiện chưa có khách nào gọi ${plate.readyRecipe.name}!`, '#FCA311');
    return false;
  }

  private servePlateToCustomerItem(plateIdx: number, target: InlineCustomer, itemIdx: number): void {
    const plate = this.plates[plateIdx];
    const orderItem = target.orderItems[itemIdx];
    if (!plate.readyRecipe || !orderItem || orderItem.served) return;

    const reqBases = this.getRequiredBases(orderItem.recipe);

    // Score 1: Prep Quality
    let prepSum = this.seasoningQuality;
    let prepCnt = 1;
    for (const st of reqBases) {
      const tr = this.trays.find((t) => t.type === st);
      if (tr) {
        prepSum += tr.quality;
        prepCnt++;
      }
    }
    const prepAvg = prepSum / prepCnt;

    // Score 2: Topping accuracy
    let tasteScore = 100;
    let addedForbidden = false;
    for (const w of orderItem.taste.wanted) {
      if (!plate.toppings.has(w.id)) tasteScore -= 26;
    }
    if (orderItem.taste.forbidden && plate.toppings.has(orderItem.taste.forbidden.id)) {
      tasteScore -= 45;
      addedForbidden = true;
    }
    for (const tid of plate.toppings) {
      const isWanted = orderItem.taste.wanted.some((w) => w.id === tid);
      const isForb = orderItem.taste.forbidden?.id === tid;
      if (!isWanted && !isForb) tasteScore -= 8;
    }
    tasteScore = clamp(tasteScore, 25, 100);

    const finalQuality = Math.round(prepAvg * 0.45 + tasteScore * 0.55);
    const qualityMult = finalQuality >= 85 ? 1.45 : finalQuality >= 60 ? 1.12 : 0.78;

    const patienceRatio = target.patience / target.maxPatience;
    const baseTip = patienceRatio > 0.5 ? 1.45 : patienceRatio > 0.2 ? 1.12 : 0.85;
    const missionTip =
      this.levelConfig.missionType === 'picky' ? 1.25
      : this.levelConfig.missionType === 'vip_critic' ? 1.35
      : 1.0;

    // Mark this specific dish as SERVED!
    orderItem.served = true;

    // Check if ALL dishes on this customer's order card are now served!
    const allServed = target.orderItems.every((it) => it.served);
    const multiOrderBonus = allServed && target.orderItems.length >= 2 ? 1.25 : 1.0;

    const earned = Math.floor(
      orderItem.recipe.basePrice *
      this.bonuses.priceMultiplier *
      baseTip *
      this.bonuses.tipMultiplier *
      this.sloganTipMult *
      missionTip *
      qualityMult *
      multiOrderBonus,
    );

    this.money += earned;
    if (!addedForbidden) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    } else {
      this.combo = 0;
    }

    // Clear the delivered plate & auto-select next empty or useful plate
    this.plates[plateIdx] = this.createEmptyPlate();
    this.activePlateIdx = plateIdx;

    const custCx = target.x + target.width / 2;
    const custCy = target.y + 28;
    this.engine.audio.playSfx(finalQuality >= 85 ? 'perfect' : 'coin');
    this.particles.emitStarburst(custCx, custCy, finalQuality >= 85 ? '#ffd166' : '#4CAF50', 20);
    this.particles.emitCoinShower(custCx, custCy, 66, 26, finalQuality >= 85 ? 8 : 5);
    this.particles.emitFloatingText(
      custCx,
      custCy - 18,
      `+${formatMoney(earned)}${finalQuality >= 85 ? ' ⭐' : ''}`,
      finalQuality >= 85 ? '#ffd166' : '#4CAF50',
      20,
    );

    if (allServed) {
      target.served = true;
      target.leaving = true;
      target.mood = addedForbidden ? CustomerMood.NEUTRAL : CustomerMood.HAPPY;
      this.customersServed++;
      target.speechText = addedForbidden
        ? `Ôi dính ${orderItem.taste.forbidden?.shortLabel} rồi 😅`
        : target.orderItems.length >= 2
          ? 'Đủ combo quá đã!! 10 điểm ⭐'
          : finalQuality >= 85
            ? 'Ngon chuẩn vị 10 điểm!! ⭐'
            : 'Cảm ơn hai bé mèo nha!';
      target.speechTimer = 2.0;

      if (this.selectedCustomerId === target.id) {
        this.selectedCustomerId = null;
      }
    } else {
      // Customer still waiting for remaining dish(es): boost patience +22% for fast partial service!
      target.patience = Math.min(target.maxPatience, target.patience + target.maxPatience * 0.22);
      target.mood = CustomerMood.HAPPY;
      target.warnedImpatient = false;
      const rem = target.orderItems.filter((it) => !it.served).length;
      target.speechText = `Ngon quá! Còn ${rem} món nữa nha~ 😋`;
      target.speechTimer = 2.0;
      if (this.selectedCustomerId === target.id) {
        this.selectedItemIdx = this.firstUnservedIdx(target);
      }
    }

    this.refreshToppingBar();

    // Check wave completion / 3-star celebration!
    if (this.customersServed >= this.targetCustomers) {
      this.reachedThreeStars = true;
      this.winDelayTimer = 0.95;
      this.particles.emitStarburst(480, 180, '#ffd166', 34);
      this.particles.emitFloatingText(480, 170, '🎉 HOÀN THÀNH MÀN! MỞ RƯƠNG THƯỞNG!', '#ffd166', 24);
      this.cats.say('both', 'HOÀN THÀNH ĐỦ KHÁCH RỒI!! Nhận Rương Thưởng và nâng cấp quán thôi!! 🎉🎁', 4.5);
    } else if (!this.reachedThreeStars && this.money >= this.levelConfig.targetScore) {
      this.reachedThreeStars = true;
      this.particles.emitStarburst(480, 140, '#ffd166', 30);
      this.particles.emitFloatingText(480, 150, '⭐⭐⭐ ĐẠT 3 SAO!', '#ffd166', 22);
      this.cats.say('both', 'ĐẠT 3 SAO RỒI!! Phục vụ nốt khách cuối là nhận rương thưởng nha! 🎉⭐', 4.5);
    } else if (addedForbidden) {
      this.cats.say('boss', 'Khách nhăn mặt vì dính món kiêng rồi! Lần sau xem kỹ phiếu 🚫 nha! 😿', 3.4);
    } else if (this.combo >= 3) {
      this.cats.say('both', `COMBO x${this.combo}!! Ra món 3 đĩa liên hoàn đỉnh quá!! 🔥⭐`, 3.8);
    } else if (allServed && target.orderItems.length >= 2) {
      this.cats.say('boss', `Trọn combo ${target.orderItems.length} món!! Thưởng +25% tips siêu hời! 👑`, 3.5);
    }

    this.showFeedback(
      `💰 +${formatMoney(earned)}${finalQuality >= 85 ? ' ⭐' : ''} • Combo x${this.combo}`,
      addedForbidden ? '#FCA311' : '#4CAF50',
    );
    this.tutorial.onFirstCustomerServed();
  }

  // ============================================================
  // Customer Spawning (1–3 Stacked Dishes per Customer!)
  // ============================================================

  private spawnCustomer(): boolean {
    const activeCount = this.customers.filter((c) => !c.leaving).length;
    const maxSlots = Math.min(4, this.levelConfig.maxCustomers);
    if (activeCount >= maxSlots) return false;
    if (this.customersServed + activeCount >= this.targetCustomers) return false;
    if (this.recipes.length === 0) return false;

    // Multi-dish scaling: Lv 1–2 = 1 dish; Lv 3–7 = 1–2 dishes; Lv 8+ = 1–3 dishes!
    let itemCount = 1;
    if (this.levelId >= 14) {
      const r = Math.random();
      itemCount = r < 0.42 ? 3 : r < 0.88 ? 2 : 1;
    } else if (this.levelId >= 7) {
      const r = Math.random();
      itemCount = r < 0.25 ? 3 : r < 0.72 ? 2 : 1;
    } else if (this.levelId >= 3) {
      itemCount = Math.random() < 0.58 ? 2 : 1;
    }

    const orderItems: CustomerOrderItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      // Pick varied dishes when menu has 2+ recipes!
      let recipe = randPick(this.recipes);
      if (this.recipes.length > 1 && i > 0 && Math.random() < 0.72) {
        const others = this.recipes.filter((r) => r.id !== orderItems[i - 1].recipe.id);
        if (others.length > 0) recipe = randPick(others);
      }
      const taste = generateCustomerTaste(
        recipe,
        this.difficulty,
        this.levelConfig.missionType ?? 'classic',
      );
      orderItems.push({ recipe, taste, served: false });
    }

    const slot = this.getNextCustomerSlot();
    const basePatience = lerp(46, 25, this.difficulty);
    const multiPatienceScale = 1 + (itemCount - 1) * 0.32;
    const patience =
      basePatience * multiPatienceScale * randFloat(0.92, 1.08) * this.bonuses.patienceMultiplier;

    const pool =
      this.levelConfig.customerTypes && this.levelConfig.customerTypes.length > 0
        ? this.levelConfig.customerTypes
        : Object.values(CustomerType);
    const customerType = randPick(pool);
    const custCfg = CUSTOMERS.find((cfg) => cfg.type === customerType);
    const speechText =
      itemCount >= 2
        ? `Cho mình gọi combo ${itemCount} món luôn nha!`
        : custCfg
          ? randPick(custCfg.speechBubbles)
          : 'Cho mình một phần thật ngon nha!';

    const customer: InlineCustomer = {
      id: this.nextCustomerId++,
      customerType,
      x: 960 + 80,
      targetX: slot.x,
      y: slot.y,
      width: 68,
      height: 86,
      patience,
      maxPatience: patience,
      orderItems,
      mood: CustomerMood.HAPPY,
      served: false,
      leaving: false,
      warnedImpatient: false,
      speechText,
      speechTimer: 3.4,
      orderBubbleAlpha: 0,
    };

    this.customers.push(customer);
    if (this.selectedCustomerId === null) {
      this.selectedCustomerId = customer.id;
      this.selectedItemIdx = 0;
      this.refreshToppingBar();
    }
    if (!this.activeMinigame) {
      const custName = custCfg?.name ?? 'Khách';
      const first = orderItems[0];
      const msg =
        itemCount >= 2
          ? `${custName} gọi liền ${itemCount} món (${orderItems.map((it) => it.recipe.name).join(' + ')})! 🍽️`
          : `${custName}: "${speechText}" → ${formatTasteSpeech(first.recipe, first.taste)}`;
      this.cats.say('golden', msg, 4.4);
    }
    return true;
  }

  private getNextCustomerSlot(): { x: number; y: number } {
    // 4 clean slots on the left/center counter leaving generous margin before Cat Booth!
    const slots = [18, 194, 370, 546];
    const occupied = new Set(this.customers.filter((c) => !c.leaving).map((c) => c.targetX));
    for (const sx of slots) {
      if (!occupied.has(sx)) return { x: sx, y: 94 };
    }
    return { x: clamp(18 + occupied.size * 176, 18, 546), y: 94 };
  }

  private showFeedback(text: string, color: string): void {
    this.feedbackText = text;
    this.feedbackTimer = 2.0;
    this.feedbackColor = color;
  }

  // ============================================================
  // Update Loop
  // ============================================================

  update(dt: number): void {
    if (this.gameOver || this.paused) return;

    this.elapsed += dt;
    this.tutorial.update(dt);
    this.cats.update(dt);
    this.particles.update(dt);

    if (this.phaseBannerTimer > 0) this.phaseBannerTimer = Math.max(0, this.phaseBannerTimer - dt);
    if (this.feedbackTimer > 0) this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
    for (const tr of this.trays) {
      if (tr.flashTimer > 0) tr.flashTimer = Math.max(0, tr.flashTimer - dt);
    }
    for (const pl of this.plates) {
      if (pl.flashTimer > 0) pl.flashTimer = Math.max(0, pl.flashTimer - dt);
    }

    // Ambient lantern dust & hot tray steam (throttled lightly on mobile for 60fps!)
    if (!this.activeMinigame) {
      const ambScale = isTouchDevice() ? 0.45 : 1;
      if (Math.random() < dt * 3.8 * ambScale) {
        this.particles.emitLanternDust(randFloat(40, 920), randFloat(68, 165));
      }
      for (const tr of this.getVisibleTrays()) {
        if (
          tr.prepped &&
          (tr.type === StationType.BROTH || tr.type === StationType.GRILL || tr.type === StationType.WOK) &&
          Math.random() < dt * 2.0 * ambScale
        ) {
          this.particles.emitSteam(tr.x + tr.width / 2, tr.y + 12, 1);
        }
      }
    }

    if (this.briefingOpen) {
      this.briefingElapsed += dt;
      return;
    }

    if (this.tutorial.isModalBlocking) return;

    if (this.winDelayTimer > 0) {
      this.winDelayTimer -= dt;
      if (this.winDelayTimer <= 0) this.endGame();
      return;
    }

    if (this.activeMinigame) {
      this.activeMinigame.update(dt);
      if (this.activeMinigame.done) {
        this.completeActiveMinigame();
      }
    }

    if (this.phase === 'prep') return;

    // ---- PHASE 2: SERVICE TIMERS & CUSTOMERS ----
    const minigameTimeScale = lerp(0.38, 0.58, this.difficulty);
    const worldDt = this.activeMinigame ? dt * minigameTimeScale : dt;

    if (!this.tutorial.shouldFreezeTimers) {
      this.timeRemaining -= worldDt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.endGame();
        return;
      }
    }

    // Spawn customers
    this.spawnTimer -= worldDt * 1000;
    if (this.spawnTimer <= 0) {
      const spawned = this.spawnCustomer();
      this.spawnTimer = spawned ? this.levelConfig.customerSpawnRate : 950;
    }

    // Update customers
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.x > c.targetX) c.x = Math.max(c.targetX, c.x - 420 * dt);
      if (c.orderBubbleAlpha < 1 && !c.leaving) c.orderBubbleAlpha = Math.min(1, c.orderBubbleAlpha + 2 * dt);
      if (c.speechTimer > 0 && c.x <= c.targetX + 40) c.speechTimer -= dt;

      if (c.leaving) {
        c.x += 520 * dt;
        c.orderBubbleAlpha = Math.max(0, c.orderBubbleAlpha - 3 * dt);
        if (c.x > 1050) this.customers.splice(i, 1);
        continue;
      }

      if (c.x <= c.targetX && !this.tutorial.shouldFreezeTimers) {
        c.patience -= worldDt;
      }

      const ratio = c.patience / c.maxPatience;
      if (ratio > 0.5) c.mood = CustomerMood.HAPPY;
      else if (ratio > 0.22) c.mood = CustomerMood.NEUTRAL;
      else {
        c.mood = CustomerMood.ANGRY;
        if (!c.warnedImpatient) {
          c.warnedImpatient = true;
          const teaHint =
            (this.engine.save.current.teaDrinks ?? 0) > 0
              ? ' Bấm 🧋 Trà Đá bên phải để hạ hỏa ngay!!'
              : ' Nhanh tay giao món!!';
          this.cats.say('golden', `Á á có khách sắp hết kiên nhẫn rồi!!${teaHint} 💦`, 3.5);
        }
      }

      if (c.patience <= 0) {
        c.leaving = true;
        c.mood = CustomerMood.ANGRY;
        this.combo = 0;
        if (this.selectedCustomerId === c.id) {
          this.selectedCustomerId = null;
          this.refreshToppingBar();
        }
        this.engine.audio.playSfx('error');
        this.showFeedback('😡 Khách bỏ đi!', '#E63946');
        this.particles.emitAngryPuff(c.x + c.width / 2, c.y + 24);
        this.particles.shake(5, 0.2);
        this.cats.say('boss', 'Khách đợi lâu quá bỏ đi mất rồi! Ghép 3 đĩa song song nhanh tay hơn nhé! 😾', 3.5);
      }
    }
  }

  private endGame(): void {
    this.gameOver = true;

    const clearedWave = this.customersServed >= this.targetCustomers;
    const stars =
      this.money >= this.levelConfig.targetScore || (clearedWave && this.money >= this.levelConfig.minScore)
        ? (this.money >= this.levelConfig.targetScore ? 3 : 2)
        : this.money >= this.levelConfig.minScore ? 2
        : this.customersServed > 0 ? 1
        : 0;

    const rewardBonus =
      stars > 0
        ? Math.round((this.levelConfig.rewardBonus ?? 50) * this.bonuses.tipMultiplier)
        : 0;
    const totalAdded = this.money + rewardBonus;

    this.engine.save.setLevelStars(this.levelId, stars);
    this.engine.save.addMoney(totalAdded);
    this.engine.save.updateStats({
      totalCustomersServed:
        this.engine.save.current.stats.totalCustomersServed + this.customersServed,
      totalMoneyEarned:
        this.engine.save.current.stats.totalMoneyEarned + totalAdded,
    });

    if (this.levelId >= this.engine.save.current.currentLevel && stars > 0) {
      this.engine.save.update({ currentLevel: Math.min(50, this.levelId + 1) });
    }

    this.engine.scenes.replace(
      new ResultScene(this.engine, {
        levelId: this.levelId,
        dayName: this.levelConfig.dayName,
        customersServed: this.customersServed,
        targetCustomers: this.targetCustomers,
        moneyEarned: this.money,
        rewardBonus,
        stars,
        maxCombo: this.maxCombo,
        targetScore: this.levelConfig.targetScore,
      }),
    );
  }

  // ============================================================
  // Render Pipeline (Zero shadowBlur — Mobile 60fps Guaranteed!)
  // ============================================================

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Stall Tier 16-bit Pixel Art Background
    ctx.imageSmoothingEnabled = false;
    const bgKey = this.engine.assets.hasImage(this.stallTier.bgKey) ? this.stallTier.bgKey : 'bg_saigon';
    if (this.engine.assets.hasImage(bgKey)) {
      ctx.drawImage(this.engine.assets.getImage(bgKey), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#1E1E2E';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Top Bar HUD
    this.renderTopBar(ctx, W);

    // 3. Customers (Ref-Style Vertical Multi-Dish Cards!) OR Prep Header
    if (this.phase === 'service') {
      this.renderCustomers(ctx);
    } else {
      this.renderPrepStageHeader(ctx, W);
    }

    // 4. Live Interactive Cat Kitchen Booth (top-right corner)
    if (!this.tutorial.isActive && !this.activeMinigame) {
      this.cats.render(ctx);
    }

    // 5. Phase-specific Counter & Workstations
    if (this.phase === 'prep') {
      this.renderTrays(ctx);
      this.renderPrepBottomBar(ctx, W);
    } else {
      // Ref-Style Wooden Counter Ledge with 3 Parallel Plates + Checklist + Tea Dispenser!
      this.renderWoodenServingCounter(ctx);
      // Workbench Base Ingredient Trays right underneath!
      this.renderTrays(ctx);
      // Bottom 6 Topping Jars!
      this.renderToppingShelf(ctx);
    }

    // 6. Floating Feedback Toast
    if (this.feedbackTimer > 0 && !this.activeMinigame) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.feedbackTimer);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, this.feedbackText, W / 2, 186, this.feedbackColor);
      ctx.restore();
    }

    // 7. Phase Transition Fanfare Banner
    if (this.phaseBannerTimer > 0 && !this.activeMinigame && !this.briefingOpen) {
      const alpha = Math.min(1, this.phaseBannerTimer * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      roundRect(ctx, 180, 140, 600, 44, 14);
      ctx.fillStyle = 'rgba(15, 16, 32, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, this.phaseBannerText, W / 2, 162, '#ffd166');
      ctx.restore();
    }

    // 8. Active Prep/Refill Minigame Modal
    if (this.activeMinigame) {
      this.activeMinigame.render(ctx);
    }

    // 9. Particle FX Layer
    this.particles.render(ctx);

    // 10. Cat Tutorial Overlay
    if (this.tutorial.isActive && !this.activeMinigame) {
      this.tutorial.render(ctx, W, H, this.getTutorialTarget());
    }

    // 11. Pre-Level Briefing Modal
    if (this.briefingOpen) {
      this.renderBriefing(ctx, W, H);
    }

    ctx.restore();

    // 12. Pause Overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.68)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 46px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '⏸ TẠM DỪNG', W / 2, H / 2 - 44, '#FCA311');

      roundRect(ctx, this.resumeBtn.x, this.resumeBtn.y, this.resumeBtn.width, this.resumeBtn.height, 10);
      ctx.fillStyle = '#4CAF50';
      ctx.fill();
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '▶ Tiếp tục', this.resumeBtn.x + this.resumeBtn.width / 2, this.resumeBtn.y + this.resumeBtn.height / 2);

      roundRect(ctx, this.exitMapBtn.x, this.exitMapBtn.y, this.exitMapBtn.width, this.exitMapBtn.height, 10);
      ctx.fillStyle = '#E63946';
      ctx.fill();
      drawTextShadow(ctx, '🗺 Bản đồ', this.exitMapBtn.x + this.exitMapBtn.width / 2, this.exitMapBtn.y + this.exitMapBtn.height / 2);
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, W: number): void {
    roundRect(ctx, 0, 0, W, 50, 0);
    ctx.fillStyle = 'rgba(10, 12, 24, 0.8)';
    ctx.fill();
    ctx.textBaseline = 'middle';

    // Money + Star Goal Progress
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px monospace';
    drawTextShadow(ctx, `💰 ${formatMoney(this.money)}/${formatMoney(this.levelConfig.targetScore)}`, 14, 18, '#4CAF50');

    const progress = Math.min(1, this.money / Math.max(1, this.levelConfig.targetScore));
    const currentStars =
      this.money >= this.levelConfig.targetScore ? 3
      : this.money >= this.levelConfig.minScore ? 2
      : this.money > 0 ? 1
      : 0;
    drawProgressBar(ctx, 16, 33, 152, 8, progress, currentStars >= 3 ? '#ffd166' : '#4CAF50');

    ctx.font = '13px "Segoe UI"';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('⭐'.repeat(currentStars) + '☆'.repeat(3 - currentStars), 174, 25);

    // Center: Phase Pill + Customer Wave + Optional Slogan Bonus!
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    const centerX = this.reachedThreeStars ? 404 : W / 2 - 18;
    const sloganTag = this.sloganTipMult > 1 ? ' • 📣+20%' : '';
    const statusLabel =
      this.phase === 'prep'
        ? `🌅 PHA 1: SƠ CHẾ  •  ${this.stallTier.icon} ${this.stallTier.name}`
        : `🏮 PHA 2  •  👥 ${this.customersServed}/${this.targetCustomers}  •  ${this.stallTier.icon} Cấp ${this.stallTier.tier}${sloganTag}`;
    drawTextShadow(ctx, statusLabel, centerX, 25, this.phase === 'prep' ? '#ffd166' : '#FCA311');

    // Early Finish button once 3 stars reached
    if (this.phase === 'service' && this.reachedThreeStars && !this.activeMinigame) {
      const fb = this.finishEarlyBtn;
      roundRect(ctx, fb.x, fb.y, fb.width, fb.height, 9);
      ctx.fillStyle = '#2d9348';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '⏭ Qua màn!', fb.x + fb.width / 2, fb.y + fb.height / 2, '#fff');
    }

    // Timer
    const timeColor =
      this.phase === 'prep' ? '#7dd3fc'
      : this.timeRemaining < 10 ? '#E63946'
      : this.timeRemaining < 30 ? '#FCA311'
      : '#fff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px monospace';
    drawTextShadow(
      ctx,
      this.phase === 'prep' ? '🌅 SƠ CHẾ' : `⏱ ${formatTime(this.timeRemaining)}`,
      this.muteBtn.x - 10,
      25,
      timeColor,
    );

    // Mute toggle
    roundRect(ctx, this.muteBtn.x, this.muteBtn.y, this.muteBtn.width, this.muteBtn.height, 8);
    ctx.fillStyle = this.engine.audio.muted ? 'rgba(230, 57, 70, 0.55)' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '18px "Segoe UI"';
    ctx.fillStyle = '#fff';
    ctx.fillText(
      this.engine.audio.muted ? '🔇' : '🔊',
      this.muteBtn.x + this.muteBtn.width / 2,
      this.muteBtn.y + this.muteBtn.height / 2,
    );

    if (supportsFullscreen()) {
      roundRect(ctx, this.fullscreenBtn.x, this.fullscreenBtn.y, this.fullscreenBtn.width, this.fullscreenBtn.height, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '18px "Segoe UI"';
      ctx.fillStyle = '#fff';
      ctx.fillText('⛶', this.fullscreenBtn.x + this.fullscreenBtn.width / 2, this.fullscreenBtn.y + this.fullscreenBtn.height / 2);
    }

    roundRect(ctx, this.pauseBtn.x, this.pauseBtn.y, this.pauseBtn.width, this.pauseBtn.height, 8);
    ctx.fillStyle = this.paused ? '#E85D04' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '20px "Segoe UI"';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.paused ? '▶' : '⏸', this.pauseBtn.x + this.pauseBtn.width / 2, this.pauseBtn.y + this.pauseBtn.height / 2);
  }

  // ---- Phase 1 Prep Header & Bottom Bar ----

  private renderPrepStageHeader(ctx: CanvasRenderingContext2D, _W: number): void {
    const preppedCount = this.trays.filter((t) => t.prepped).length;
    const totalCount = this.trays.length;

    roundRect(ctx, 20, 62, 476, 112, 14);
    ctx.fillStyle = 'rgba(15, 16, 32, 0.84)';
    ctx.fill();
    ctx.strokeStyle = '#FCA311';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      `🌅 PHA 1: SƠ CHẾ NGUYÊN LIỆU (${preppedCount}/${totalCount})`,
      34,
      84,
      '#ffd166',
    );

    ctx.font = '12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Chạm từng khay phát sáng bên dưới để sơ chế trước khi mở quán!', 34, 108);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Điểm càng cao → càng nhiều phần dự trữ & chất lượng ⭐', 34, 126);

    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#80ed99';
    ctx.fillText('Món hôm nay:', 34, 152);
    let rx = 122;
    for (const r of this.recipes.slice(0, 3)) {
      const fKey = `food_${r.id}`;
      if (this.engine.assets.hasImage(fKey)) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.engine.assets.getImage(fKey), rx, 138, 26, 26);
      }
      ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(r.name, rx + 30, 152);
      rx += ctx.measureText(r.name).width + 44;
    }
  }

  private renderPrepBottomBar(ctx: CanvasRenderingContext2D, W: number): void {
    const ready = this.allRequiredPrepped();
    const pending = this.trays.filter((t) => !t.prepped);

    roundRect(ctx, 130, 392, 700, 120, 16);
    ctx.fillStyle = 'rgba(15, 16, 32, 0.82)';
    ctx.fill();
    ctx.strokeStyle = ready ? '#4CAF50' : 'rgba(252, 163, 17, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!ready) {
      const next = pending[0];
      const hint = next ? STATION_META[next.type].prepHint : '';
      ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        `👆 Chạm khay ${next?.label ?? ''} phát sáng trên quầy để sơ chế (${hint})!`,
        W / 2,
        434,
        '#ffd166',
      );
      ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `Hoàn thành hết ${pending.length} khay còn lại sẽ TỰ ĐỘNG mở ${this.stallTier.icon} ${this.stallTier.name} đón khách vào Pha 2!`,
        W / 2,
        472,
      );
    } else {
      const btn = this.openShopNowBtn;
      roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
      ctx.fillStyle = '#2d9348';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '🔔 MỞ QUÁN BÀY BÁN!', btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');
    }
  }

  // ---- Phase 2: Ref-Style Wooden Counter Ledge + 3 Parallel Serving Plates + Tea Dispenser! ----

  private renderWoodenServingCounter(ctx: CanvasRenderingContext2D): void {
    // Warm golden-oak counter bar spanning full width (inspired by Cooking Fever!)
    roundRect(ctx, 14, 192, 932, 90, 14);
    const wood = ctx.createLinearGradient(0, 192, 0, 282);
    wood.addColorStop(0, '#c88c42');
    wood.addColorStop(0.18, '#a76a29');
    wood.addColorStop(1, '#6f4219');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = '#f3c677';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 1. LEFT: Target Dish Recipe & Topping Checklist Card (x: 22..306, y: 198..276)
    const sel = this.getSelectedOrderItem();
    const activePlate = this.getActivePlate();
    const displayRecipe = activePlate.targetRecipe ?? sel?.item.recipe ?? null;

    roundRect(ctx, 22, 198, 286, 78, 10);
    ctx.fillStyle = 'rgba(15, 16, 32, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (!displayRecipe) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('⏳ Đang chờ khách gọi món...', 165, 237);
    } else {
      const reqBases = this.getRequiredBases(displayRecipe);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        `📋 ${displayRecipe.name} (Đĩa #${this.activePlateIdx + 1})`,
        32,
        213,
        '#ffd166',
      );

      // Base ingredient compact pills
      let bx = 30;
      for (const st of reqBases) {
        const done = activePlate.bases.includes(st);
        const m = STATION_META[st];
        const txt = `${done ? '✅' : '⬜'}${m.icon}`;
        ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
        const tw = ctx.measureText(txt).width + 10;
        roundRect(ctx, bx, 226, tw, 20, 6);
        ctx.fillStyle = done ? 'rgba(45, 147, 72, 0.78)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(txt, bx + tw / 2, 236);
        bx += tw + 4;
      }

      // Taste wanted / forbidden pills on bottom row of checklist
      if (sel && sel.item.recipe.id === displayRecipe.id) {
        let tx = 30;
        ctx.font = 'bold 10.5px "Segoe UI", sans-serif';
        for (const w of sel.item.taste.wanted) {
          const has = activePlate.toppings.has(w.id);
          const txt = `${has ? '✅' : '+'}${w.emoji}${w.shortLabel}`;
          const tw = ctx.measureText(txt).width + 8;
          if (tx + tw > 304) break;
          roundRect(ctx, tx, 251, tw, 19, 5);
          ctx.fillStyle = has ? '#2d9348' : '#e85d04';
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.fillText(txt, tx + tw / 2, 260.5);
          tx += tw + 4;
        }
        if (sel.item.taste.forbidden) {
          const f = sel.item.taste.forbidden;
          const violated = activePlate.toppings.has(f.id);
          const txt = `🚫${f.emoji}${f.shortLabel}`;
          const tw = ctx.measureText(txt).width + 8;
          if (tx + tw <= 306) {
            roundRect(ctx, tx, 251, tw, 19, 5);
            ctx.fillStyle = violated ? '#d00000' : '#475569';
            ctx.fill();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText(txt, tx + tw / 2, 260.5);
          }
        }
      }
    }

    // 2. CENTER: 3 Parallel Circular Serving Plates on Warm Wood Bay! (Ref Centerpiece!)
    const pointer = this.engine.input.pointer;
    for (let i = 0; i < this.plates.length; i++) {
      const plate = this.plates[i];
      const r = this.plateRects[i];
      const isSelected = i === this.activePlateIdx;
      const isReady = plate.readyRecipe !== null;
      const hover = InputManager.hitTest(pointer, r);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;

      // Plate wooden bay background
      roundRect(ctx, r.x, r.y, r.width, r.height, 14);
      ctx.fillStyle =
        plate.flashTimer > 0
          ? 'rgba(76, 175, 80, 0.55)'
          : isReady
            ? 'rgba(45, 147, 72, 0.52)'
            : isSelected
              ? 'rgba(255, 209, 102, 0.24)'
              : hover
                ? 'rgba(255, 255, 255, 0.14)'
                : 'rgba(28, 17, 10, 0.45)';
      ctx.fill();
      ctx.strokeStyle = isReady
        ? '#80ed99'
        : isSelected
          ? '#ffd166'
          : 'rgba(255, 232, 180, 0.35)';
      ctx.lineWidth = isSelected || isReady ? 2.8 : 1.5;
      ctx.stroke();

      // Ceramic circular plate visual inside bay!
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 48, 28, 0, 0, Math.PI * 2);
      ctx.fillStyle = isReady ? '#fffdf5' : '#f1ece0';
      ctx.fill();
      ctx.strokeStyle = isReady ? '#4CAF50' : '#c8bca6';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 36, 20, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180, 160, 130, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Slot tag top-left
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = isSelected ? '#ffd166' : 'rgba(255,255,255,0.75)';
      ctx.fillText(`#${i + 1}`, r.x + 6, r.y + 4);

      if (isReady && plate.readyRecipe) {
        const foodKey = `food_${plate.readyRecipe.id}`;
        if (this.engine.assets.hasImage(foodKey)) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.engine.assets.getImage(foodKey), cx - 26, cy - 24, 52, 52);
        }

        // Toppings icons tiny row on bottom-left
        if (plate.toppings.size > 0) {
          const pool = getToppingPoolForRecipe(plate.readyRecipe);
          const emojis = Array.from(plate.toppings)
            .map((id) => pool.find((p) => p.id === id)?.emoji ?? '')
            .join('');
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.font = '13px "Segoe UI"';
          ctx.fillText(emojis, r.x + 6, r.y + r.height - 3);
        }

        // Pulsing green "GIAO!" pill on top-right!
        const pulse = 0.8 + 0.2 * Math.sin(this.elapsed * 8);
        ctx.save();
        ctx.globalAlpha = pulse;
        roundRect(ctx, r.x + r.width - 56, r.y + 3, 52, 18, 8);
        ctx.fillStyle = '#2d9348';
        ctx.fill();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('🍽️ GIAO!', r.x + r.width - 30, r.y + 12);
        ctx.restore();
      } else if (plate.bases.length > 0 && plate.targetRecipe) {
        const req = this.getRequiredBases(plate.targetRecipe);
        const icons = plate.bases.map((st) => STATION_META[st].icon).join('');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = '19px "Segoe UI"';
        ctx.fillText(icons, cx, cy);
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#6f4219';
        ctx.fillText(`${plate.bases.length}/${req.length}`, cx, cy + 20);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = '#8b7e6a';
        ctx.fillText(isSelected ? '👆 Ghép vào đây' : `Đĩa #${i + 1}`, cx, cy + 3);
      }
    }

    // 3. RIGHT: Patience-Boost Iced Tea Dispenser (`🧋 Trà Đá`)!
    const teas = this.engine.save.current.teaDrinks ?? 0;
    const teaHover = InputManager.hitTest(pointer, this.teaBtn);
    roundRect(ctx, this.teaBtn.x, this.teaBtn.y, this.teaBtn.width, this.teaBtn.height, 12);
    ctx.fillStyle =
      teas > 0
        ? teaHover
          ? '#0284c7'
          : 'rgba(14, 116, 144, 0.9)'
        : 'rgba(30, 41, 59, 0.78)';
    ctx.fill();
    ctx.strokeStyle = teas > 0 ? '#7dd3fc' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = teas > 0 ? 2.2 : 1.2;
    ctx.stroke();

    if (this.engine.assets.hasImage('item_tea')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.engine.assets.getImage('item_tea'), this.teaBtn.x + 8, this.teaBtn.y + 8, 38, 38);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px monospace';
    drawTextShadow(ctx, `×${teas}`, this.teaBtn.x + 70, this.teaBtn.y + 26, teas > 0 ? '#ffd166' : '#94a3b8');
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    drawTextShadow(ctx, '🧋 Trà Đá +55%', this.teaBtn.x + this.teaBtn.width / 2, this.teaBtn.y + 62, '#fff');

    // 4. FAR RIGHT: Trash active plate (`🗑 Bỏ`)
    const trashHover = InputManager.hitTest(pointer, this.trashBtn);
    roundRect(ctx, this.trashBtn.x, this.trashBtn.y, this.trashBtn.width, this.trashBtn.height, 12);
    ctx.fillStyle = trashHover ? '#dc2626' : 'rgba(185, 28, 28, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px "Segoe UI"';
    ctx.fillText('🗑', this.trashBtn.x + this.trashBtn.width / 2, this.trashBtn.y + 28);
    ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
    drawTextShadow(ctx, `Bỏ #${this.activePlateIdx + 1}`, this.trashBtn.x + this.trashBtn.width / 2, this.trashBtn.y + 58, '#fff');
  }

  // ---- Ingredient Trays on Workbench (Both Phase 1 & Phase 2!) ----

  private renderTrays(ctx: CanvasRenderingContext2D): void {
    const visible = this.getVisibleTrays();
    const activePlate = this.getActivePlate();
    const sel = this.phase === 'service' ? this.getSelectedOrderItem() : null;
    const activeRecipe = activePlate?.targetRecipe ?? sel?.item.recipe ?? null;
    const reqBases = activeRecipe ? this.getRequiredBases(activeRecipe) : [];
    const pointer = this.engine.input.pointer;

    ctx.imageSmoothingEnabled = false;
    for (const tr of visible) {
      const rect: Rect = { x: tr.x, y: tr.y, width: tr.width, height: tr.height };
      const hover = InputManager.hitTest(pointer, rect);
      const needsPrep = this.phase === 'prep' && !tr.prepped;
      const alreadyPicked =
        this.phase === 'service' && activePlate && activePlate.bases.includes(tr.type);
      const neededNow =
        this.phase === 'service' &&
        !activePlate?.readyRecipe &&
        reqBases.includes(tr.type) &&
        !alreadyPicked;
      const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 7);

      ctx.save();

      // Zero-blur drop shadow beneath tray
      roundRect(ctx, tr.x, tr.y + 4, tr.width, tr.height, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.36)';
      ctx.fill();

      roundRect(ctx, tr.x, tr.y, tr.width, tr.height, 14);
      if (tr.flashTimer > 0) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.72)';
      } else if (alreadyPicked) {
        ctx.fillStyle = 'rgba(45, 147, 72, 0.45)';
      } else if (needsPrep || neededNow) {
        ctx.fillStyle = hover ? 'rgba(252, 163, 17, 0.42)' : 'rgba(252, 163, 17, 0.24)';
      } else {
        ctx.fillStyle = hover ? 'rgba(35, 30, 52, 0.88)' : 'rgba(18, 16, 30, 0.78)';
      }
      ctx.fill();

      roundRect(ctx, tr.x, tr.y, tr.width, tr.height, 14);
      if (needsPrep || neededNow) {
        ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
        ctx.lineWidth = 3.2;
      } else if (alreadyPicked) {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();

      const spriteKey = `station_${tr.type.toLowerCase()}`;
      const spriteSize = this.phase === 'prep' ? Math.min(tr.width - 26, 66) : Math.min(tr.width - 24, 56);
      if (this.engine.assets.hasImage(spriteKey)) {
        ctx.drawImage(
          this.engine.assets.getImage(spriteKey),
          tr.x + (tr.width - spriteSize) / 2,
          tr.y + (this.phase === 'prep' ? 14 : 6),
          spriteSize,
          spriteSize,
        );
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        tr.shortName,
        tr.x + tr.width / 2,
        tr.y + tr.height - (this.phase === 'prep' ? 28 : 13),
        '#fff',
      );

      if (this.phase === 'prep') {
        if (!tr.prepped) {
          ctx.font = 'bold 10.5px "Segoe UI", sans-serif';
          ctx.fillStyle = '#fde68a';
          ctx.fillText(STATION_META[tr.type].prepHint, tr.x + tr.width / 2, tr.y + tr.height - 11);

          roundRect(ctx, tr.x + tr.width - 54, tr.y - 9, 58, 20, 10);
          ctx.fillStyle = '#e85d04';
          ctx.fill();
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.fillStyle = '#fff';
          ctx.fillText('🎮 SƠ CHẾ', tr.x + tr.width - 25, tr.y + 1);
        } else {
          ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
          ctx.fillStyle = '#80ed99';
          ctx.fillText(
            tr.needsPlayerPrep ? `✅ Sẵn sàng (×${tr.stock})` : `🐾 Phụ sẵn (×${tr.stock})`,
            tr.x + tr.width / 2,
            tr.y + tr.height - 11,
          );
          if (tr.quality >= 85) {
            ctx.font = '16px "Segoe UI"';
            ctx.fillText('⭐', tr.x + 16, tr.y + 16);
          }
        }
      } else {
        const outOfStock = tr.stock <= 0;
        roundRect(ctx, tr.x + tr.width - 42, tr.y - 7, 44, 20, 9);
        ctx.fillStyle = outOfStock ? '#E63946' : tr.stock <= 1 ? '#E85D04' : '#1e293b';
        ctx.fill();
        ctx.strokeStyle = outOfStock ? '#fff' : '#ffd166';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(outOfStock ? 'HẾT!' : `×${tr.stock}`, tr.x + tr.width - 20, tr.y + 3);

        if (alreadyPicked) {
          ctx.font = '18px "Segoe UI"';
          ctx.fillText('✅', tr.x + 16, tr.y + 16);
        } else if (tr.quality >= 85) {
          ctx.font = '14px "Segoe UI"';
          ctx.fillText('⭐', tr.x + 14, tr.y + 14);
        }
      }

      ctx.restore();
    }
  }

  private renderToppingShelf(ctx: CanvasRenderingContext2D): void {
    const sel = this.getSelectedOrderItem();
    const plate = this.getActivePlate();
    if (this.toppingJarRects.length === 0) this.refreshToppingBar();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(
      `🧂 GIA VỊ & TOPPING cho Đĩa #${this.activePlateIdx + 1} (Chất lượng sơ chế: ${Math.round(this.seasoningQuality)}% ${this.seasoningQuality >= 85 ? '⭐' : ''}) — Chạm hũ để rắc:`,
      480,
      411,
    );

    const pointer = this.engine.input.pointer;
    for (const { option, rect } of this.toppingJarRects) {
      const picked = plate.toppings.has(option.id);
      const isWanted = sel?.item.taste.wanted.some((w) => w.id === option.id) ?? false;
      const isForb = sel?.item.taste.forbidden?.id === option.id;
      const hover = InputManager.hitTest(pointer, rect);

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 14);
      ctx.fillStyle = picked
        ? (isForb ? 'rgba(230, 57, 70, 0.88)' : 'rgba(45, 147, 72, 0.88)')
        : hover
          ? 'rgba(55, 48, 78, 0.94)'
          : 'rgba(24, 22, 40, 0.9)';
      ctx.fill();

      ctx.strokeStyle = picked
        ? '#fff'
        : isWanted
          ? '#ffd166'
          : isForb
            ? '#ef4444'
            : option.color;
      ctx.lineWidth = picked || isWanted ? 3 : 1.8;
      ctx.stroke();

      if (isWanted && !picked) {
        roundRect(ctx, rect.x + rect.width - 34, rect.y + 4, 30, 16, 6);
        ctx.fillStyle = '#e85d04';
        ctx.fill();
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('CẦN', rect.x + rect.width - 19, rect.y + 12);
      } else if (isForb) {
        roundRect(ctx, rect.x + rect.width - 34, rect.y + 4, 30, 16, 6);
        ctx.fillStyle = '#d00000';
        ctx.fill();
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('CẤM', rect.x + rect.width - 19, rect.y + 12);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = '30px "Segoe UI"';
      ctx.fillText(option.emoji, rect.x + rect.width / 2, rect.y + 32);

      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, option.label, rect.x + rect.width / 2, rect.y + 66, '#fff');
    }
  }

  // ---- Customers with Cooking-Fever-Style Vertical Multi-Dish Order Cards! ----

  private renderCustomers(ctx: CanvasRenderingContext2D): void {
    const sel = this.getSelectedOrderItem();
    ctx.imageSmoothingEnabled = false;

    for (const c of this.customers) {
      ctx.save();
      const isTarget = sel?.customer.id === c.id && !c.served && !c.leaving;
      const isMoving = c.x > c.targetX + 1 || c.leaving;
      const bounceY = isMoving ? Math.abs(Math.sin(c.x * 0.08)) * -5 : 0;
      const drawY = c.y + bounceY;

      // Active target golden floor highlight
      ctx.beginPath();
      ctx.ellipse(c.x + c.width / 2, c.y + c.height + 2, c.width / 2.2, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = isTarget ? 'rgba(255, 209, 102, 0.48)' : 'rgba(0,0,0,0.35)';
      ctx.fill();
      if (isTarget) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }

      // Customer pixel-art portrait
      const spriteKey = `customer_${c.customerType.toLowerCase()}`;
      if (this.engine.assets.hasImage(spriteKey)) {
        ctx.drawImage(this.engine.assets.getImage(spriteKey), c.x, drawY, c.width, c.height);
      }

      const faceEmoji =
        c.mood === CustomerMood.HAPPY ? '😊'
        : c.mood === CustomerMood.NEUTRAL ? '😐'
        : '😡';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '15px "Segoe UI"';
      ctx.fillText(faceEmoji, c.x + 10, drawY + 12);

      // REF-STYLE VERTICAL WHITE MULTI-DISH ORDER CARD WITH SIDE PATIENCE BAR!
      if (!c.served && c.orderBubbleAlpha > 0) {
        ctx.globalAlpha = c.orderBubbleAlpha;
        const { bx, by, bw, bh, itemH } = this.getCustomerCardRect(c);

        // Card drop offset shadow
        roundRect(ctx, bx + 2, by + 3, bw, bh, 11);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fill();

        // Crisp white vertical order card!
        roundRect(ctx, bx, by, bw, bh, 11);
        ctx.fillStyle = isTarget ? '#fffbeb' : '#fffcf5';
        ctx.fill();
        ctx.strokeStyle = isTarget ? '#e85d04' : '#3d281c';
        ctx.lineWidth = isTarget ? 2.8 : 1.8;
        ctx.stroke();

        // Left speech tail pointing cleanly at the customer
        ctx.beginPath();
        ctx.moveTo(bx, by + bh - 26);
        ctx.lineTo(bx - 8, by + bh - 20);
        ctx.lineTo(bx, by + bh - 14);
        ctx.fillStyle = isTarget ? '#fffbeb' : '#fffcf5';
        ctx.fill();

        // Vertical Patience Bar embedded along the RIGHT edge of the white card (just like ref image!)
        const ratio = clamp(c.patience / c.maxPatience, 0, 1);
        const barX = bx + bw - 13;
        const barY = by + 7;
        const barW = 7;
        const barH = bh - 14;
        roundRect(ctx, barX, barY, barW, barH, 3.5);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();

        const fillH = Math.max(0, barH * ratio);
        const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.22 ? '#f59e0b' : '#ef4444';
        if (fillH > 1) {
          roundRect(ctx, barX, barY + (barH - fillH), barW, fillH, 3.5);
          ctx.fillStyle = barColor;
          ctx.fill();
        }

        // Stacked 1–3 Dish Rows inside the white card!
        for (let i = 0; i < c.orderItems.length; i++) {
          const it = c.orderItems[i];
          const ry = by + 7 + i * itemH;
          const isFocusedItem = isTarget && sel?.itemIdx === i && !it.served;
          const hasReadyPlate =
            !it.served && this.plates.some((p) => p.readyRecipe?.id === it.recipe.id);

          if (isFocusedItem || hasReadyPlate) {
            roundRect(ctx, bx + 4, ry, bw - 21, itemH - 2, 7);
            ctx.fillStyle = hasReadyPlate
              ? 'rgba(76, 175, 80, 0.22)'
              : 'rgba(252, 163, 17, 0.2)';
            ctx.fill();
            ctx.strokeStyle = hasReadyPlate ? '#2d9348' : '#f59e0b';
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }

          const foodKey = `food_${it.recipe.id}`;
          const iconSize = itemH >= 42 ? 36 : itemH >= 36 ? 30 : 28;
          if (this.engine.assets.hasImage(foodKey)) {
            ctx.save();
            if (it.served) ctx.globalAlpha = 0.35;
            ctx.drawImage(
              this.engine.assets.getImage(foodKey),
              bx + 7,
              ry + (itemH - iconSize) / 2 - 1,
              iconSize,
              iconSize,
            );
            ctx.restore();
          }

          if (it.served) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 18px "Segoe UI"';
            ctx.fillText('✅', bx + 44, ry + itemH / 2);
          } else {
            // Compact taste badges right beside dish icon
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
            ctx.fillStyle = '#3d281c';
            const badges = it.taste.summaryBadges.slice(0, 2).join('');
            ctx.fillText(badges || '⭐', bx + 8 + iconSize, ry + itemH / 2 - 5);

            ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
            ctx.fillStyle = '#b5561d';
            const short = it.recipe.name.length > 7 ? `${it.recipe.name.slice(0, 6)}…` : it.recipe.name;
            ctx.fillText(short, bx + 8 + iconSize, ry + itemH / 2 + 7);
          }
        }

        ctx.globalAlpha = 1;
      }

      // Speech bubble briefly when arriving or finishing
      if (c.speechTimer > 0 && c.speechText && c.x <= c.targetX + 30) {
        const sAlpha = Math.min(1, c.speechTimer * 1.5);
        ctx.save();
        ctx.globalAlpha = sAlpha;
        ctx.font = 'bold 10.5px "Segoe UI", system-ui, sans-serif';
        const sw = Math.min(176, ctx.measureText(c.speechText).width + 14);
        const sx = clamp(c.x + c.width / 2 - sw / 2, 10, 742 - sw);
        const sy = 53;
        roundRect(ctx, sx, sy, sw, 20, 7);
        ctx.fillStyle = c.served ? 'rgba(45, 147, 72, 0.92)' : 'rgba(17, 19, 38, 0.9)';
        ctx.fill();
        ctx.strokeStyle = c.served ? '#80ed99' : '#FCA311';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(c.speechText, sx + sw / 2, sy + 10);
        ctx.restore();
      }

      if (c.served) {
        ctx.font = '26px "Segoe UI"';
        ctx.fillText('✅', c.x + c.width / 2, drawY - 4);
      }

      ctx.restore();
    }
  }

  private getTutorialTarget(): TutorialTarget | null {
    const stage = this.tutorial.currentStage;
    if (stage === 'prep_phase') {
      const next = this.trays.find((t) => !t.prepped);
      return next ? { rect: { x: next.x, y: next.y, width: next.width, height: next.height } } : null;
    }
    if (stage === 'service_mix') {
      const sel = this.getSelectedOrderItem();
      const plate = this.getActivePlate();
      if (!sel) return null;
      const req = this.getRequiredBases(sel.item.recipe);
      const missing = req.find((st) => !plate.bases.includes(st));
      if (missing) {
        const tr = this.getVisibleTrays().find((t) => t.type === missing);
        if (tr) return { rect: { x: tr.x, y: tr.y, width: tr.width, height: tr.height } };
      }
      return { rect: this.plateRects[this.activePlateIdx] };
    }
    if (stage === 'service_serve') {
      const readyIdx = this.plates.findIndex((p) => p.readyRecipe !== null);
      return { rect: this.plateRects[readyIdx >= 0 ? readyIdx : this.activePlateIdx] };
    }
    return null;
  }

  // ---- Pre-Level 2-Cat Briefing Card ----

  private renderBriefing(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 11, 24, 0.8)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 680;
    const cardH = 380;
    const cardX = (W - cardW) / 2;
    const cardY = 66;

    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    const bg = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    bg.addColorStop(0, '#231e38');
    bg.addColorStop(1, '#141326');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#FCA311';
    ctx.lineWidth = 3;
    ctx.stroke();

    const missionMap = {
      classic: { text: '🎯 NHIỆM VỤ: SƠ CHẾ → 3 ĐĨA PICK & MIX', color: '#2A9D8F' },
      rush: { text: '⚡ GIỜ CAO ĐIỂM: KHÁCH GỌI NHIỀU MÓN CÙNG LÚC!', color: '#E85D04' },
      picky: { text: '🌶️ KHÁCH KHÓ TÍNH: ĐÚNG TOPPING TIP x1.25!', color: '#E63946' },
      vip_critic: { text: '⭐ THỬ THÁCH BOSS: GIÁM KHẢO ẨM THỰC!', color: '#D97706' },
    };
    const mInfo = missionMap[this.levelConfig.missionType ?? 'classic'];
    roundRect(ctx, cardX + 120, cardY - 16, cardW - 240, 32, 16);
    ctx.fillStyle = mInfo.color;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, mInfo.text, W / 2, cardY, '#fff');

    ctx.font = 'bold 25px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      `Ngày ${this.levelId}: ${this.levelConfig.dayName}  •  ${this.stallTier.icon} ${this.stallTier.name}`,
      W / 2,
      cardY + 42,
      '#FCA311',
    );

    const pillY = cardY + 66;
    const pillH = 28;
    roundRect(ctx, cardX + 28, pillY, 356, pillH, 10);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(128, 237, 153, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#80ed99';
    ctx.fillText(
      `👥 ${this.targetCustomers} khách  •  🎁 Rương: +${formatMoney(this.levelConfig.rewardBonus ?? 50)}`,
      cardX + 28 + 178,
      pillY + pillH / 2,
    );

    const diffTier =
      this.difficulty < 0.22
        ? { label: '🌱 Dễ', color: '#4CAF50' }
        : this.difficulty < 0.5
          ? { label: '🔥 Trung bình', color: '#FCA311' }
          : this.difficulty < 0.78
            ? { label: '⚡ Khó', color: '#E85D04' }
            : { label: '👑 Siêu Đầu Bếp', color: '#E63946' };
    const filledPips = clamp(Math.ceil(this.difficulty * 5), 1, 5);
    const dPillX = cardX + 396;
    const dPillW = 256;
    roundRect(ctx, dPillX, pillY, dPillW, pillH, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = diffTier.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = 'bold 12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = diffTier.color;
    ctx.fillText(diffTier.label, dPillX + 10, pillY + pillH / 2);

    const pipStartX = dPillX + dPillW - 76;
    for (let p = 0; p < 5; p++) {
      roundRect(ctx, pipStartX + p * 13, pillY + 8, 9, 12, 3);
      ctx.fillStyle = p < filledPips ? diffTier.color : 'rgba(255,255,255,0.16)';
      ctx.fill();
    }

    const bob = Math.sin(this.briefingElapsed * 3.5) * 4;
    ctx.imageSmoothingEnabled = true;

    const r1Y = cardY + 104;
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const img = this.engine.assets.getImage('npc_cat_boss');
      const dh = 92;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, cardX + 24, r1Y + bob, dw, dh);
    }
    roundRect(ctx, cardX + 124, r1Y + 4, cardW - 152, 80, 12);
    ctx.fillStyle = 'rgba(252, 163, 17, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('👑 Vằn Bếp Trưởng:', cardX + 138, r1Y + 12);
    ctx.font = '14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapBriefingText(
      ctx,
      this.shiftDelaySec > 0
        ? `Hừm... nãy thua Tiến Lên hơi cay cú nên mở quán trễ ${this.shiftDelaySec} giây! Nấu bù siêu tốc nào!!`
        : (this.levelConfig.introBoss ?? 'Sơ chế nguyên liệu thật chuẩn rồi mở quán 3 đĩa Pick & Mix nhé!'),
      cardX + 138,
      r1Y + 32,
      cardW - 180,
      20,
    );

    const r2Y = cardY + 206;
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const dh = 86;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, cardX + cardW - dw - 24, r2Y - bob, dw, dh);
    }
    roundRect(ctx, cardX + 28, r2Y + 4, cardW - 152, 80, 12);
    ctx.fillStyle = 'rgba(244, 162, 97, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 162, 97, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#F4A261';
    ctx.fillText('🐾 Mèo Vàng Phụ Bếp:', cardX + 42, r2Y + 12);
    ctx.font = '14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapBriefingText(
      ctx,
      this.sloganTipMult > 1
        ? 'Biển hiệu mới đẹp lung linh +20% tiền Tips!! Em có sẵn Trà Đá giải nhiệt cho khách rồi nhé!'
        : (this.levelConfig.introGolden ?? 'Em đã dọn sẵn 3 đĩa phục vụ & Trà Đá tăng kiên nhẫn rồi! Chiến thôi!'),
      cardX + 42,
      r2Y + 32,
      cardW - 180,
      20,
    );

    const dishStartX = W / 2 - (this.recipes.length * 46) / 2;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < this.recipes.length; i++) {
      const key = `food_${this.recipes[i].id}`;
      if (this.engine.assets.hasImage(key)) {
        ctx.drawImage(this.engine.assets.getImage(key), dishStartX + i * 46, cardY + 304, 40, 40);
      }
    }

    const btn = this.startBriefingBtn;
    const pulse = 1 + Math.sin(this.briefingElapsed * 5) * 0.03;
    ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
    ctx.scale(pulse, pulse);
    roundRect(ctx, -btn.width / 2, -btn.height / 2, btn.width, btn.height, 14);
    ctx.fillStyle = '#e85d04';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🌅 VÀO PHA 1 SƠ CHẾ!', 0, 0, '#fff');

    ctx.restore();
  }

  private wrapBriefingText(
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
