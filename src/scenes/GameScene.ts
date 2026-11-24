// ============================================================
// GameScene — 2-Phase Vietnamese Street Food Cooking Loop!
//   🌅 PHASE 1 (PREP): Challenging moving-target minigames to
//      prepare stock trays (broth, meat, worm-catching herbs,
//      Fruit-Ninja aromatics, bread, grill, etc.).
//   🏮 PHASE 2 (SERVICE — Pick & Mix): Shawarma Legend / Good
//      Pizza style fast assembly! Pick prepped ingredients from
//      the stall trays + customize toppings to each customer's
//      exact taste, and grow from Xe Đẩy Vỉa Hè → Nhà Hàng 5 Sao!
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
  needsPlayerPrep: boolean; // Up to 4 trays require player minigame; overflow auto-assisted by Mèo Vàng
  stock: number;
  maxStock: number;
  quality: number;          // 0..100 from prep minigame!
  flashTimer: number;
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
  order: Recipe;
  taste: CustomerTasteOrder;
  mood: CustomerMood;
  served: boolean;
  leaving: boolean;
  warnedImpatient: boolean;
  speechText: string;
  speechTimer: number;
  orderBubbleAlpha: number;
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

  private levelConfig!: LevelConfig;
  private bonuses!: ActiveUpgradeBonuses;
  private stallTier!: StallTierInfo;

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
  private seasoningQuality = 88; // Boosted by prepping the SAUCE/Aromatics tray!
  private customers: InlineCustomer[] = [];
  private spawnTimer = 0;
  private nextCustomerId = 0;

  // Phase 2: Pick & Mix Assembly Tray State!
  private selectedCustomerId: number | null = null;
  private assembledBases: StationType[] = [];
  private assembledToppings = new Set<string>();
  private toppingJarRects: Array<{ option: ToppingOption; rect: Rect }> = [];

  // UI Rects
  private pauseBtn: Rect = { x: 896, y: 6, width: 52, height: 40 };
  private fullscreenBtn: Rect = { x: 838, y: 6, width: 50, height: 40 };
  private muteBtn: Rect = { x: 786, y: 6, width: 44, height: 40 };
  private finishEarlyBtn: Rect = { x: 562, y: 8, width: 112, height: 36 };
  private serveBtn: Rect = { x: 672, y: 320, width: 178, height: 66 };
  private trashBtn: Rect = { x: 858, y: 320, width: 80, height: 66 };
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
  ) {
    this.engine = engine;
    this.levelId = levelId;
    this.forceTutorial = forceTutorial;
    this.marketBonusStock = marketBonusStock;
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
    this.timeRemaining = this.levelConfig.timeLimit;
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
    this.assembledBases = [];
    this.assembledToppings.clear();
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

    if (this.marketBonusStock > 0) {
      this.cats.say(
        'golden',
        `Hàng chợ về tới rồi!! Cộng thêm +${this.marketBonusStock} phần nguyên liệu cho mọi khay! 🧺✨`,
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

  /**
   * Build the ingredient trays for Phase 1 Prep & Phase 2 Service!
   * Includes every distinct base station + a dedicated SAUCE/Aromatics prep tray
   * so Fruit Ninja slicing & Worm Catching shine right from Level 1!
   */
  private buildPrepTrays(): void {
    const stationStepMap = new Map<StationType, { recipe: Recipe; step: CookingStep }>();
    for (const r of this.recipes) {
      for (const s of r.steps) {
        if (!stationStepMap.has(s.stationType)) {
          stationStepMap.set(s.stationType, { recipe: r, step: s });
        }
      }
    }

    // Always ensure a SAUCE / Aromatics slicing tray exists in Phase 1 Prep!
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
    // Pick up to 3-4 engaging trays for the player to prep manually; Mèo Vàng auto-preps any overflow!
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

    const baseStock = 5 + this.bonuses.prepStockBonus + this.marketBonusStock;
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
        y: 210,
        width: 110,
        height: 98,
        color: STATION_COLORS[type] ?? '#FCA311',
        prepped: !needsPlayerPrep,
        needsPlayerPrep,
        stock: needsPlayerPrep ? 0 : baseStock,
        maxStock: baseStock + 2,
        quality: needsPlayerPrep ? 0 : 90,
        flashTimer: 0,
      };
    });

    this.layoutTrays();
  }

  /** Position trays neatly across the stall counter based on active phase! */
  private layoutTrays(): void {
    // In Prep Phase show ALL trays (including SAUCE/Aromatics prep);
    // In Service Phase show all Base trays on the middle counter (SAUCE powers the bottom Topping Shelf!).
    const visible = this.getVisibleTrays();
    const count = Math.max(1, visible.length);
    const gap = count > 6 ? 8 : 14;
    const trayW = Math.min(138, Math.floor((916 - (count - 1) * gap) / count));
    const trayH = this.phase === 'prep' ? 128 : 96;
    const trayY = this.phase === 'prep' ? 228 : 206;
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

  /** Base StationTypes required in Service Phase to assemble a recipe */
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
    return waiting[0];
  }

  private refreshToppingBar(): void {
    const cust = this.getSelectedCustomer();
    const recipe = cust?.order ?? this.recipes[0];
    if (!recipe) {
      this.toppingJarRects = [];
      return;
    }
    const pool = cust?.taste.tray ?? getToppingPoolForRecipe(recipe);
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

  // ============================================================
  // Input Handling
  // ============================================================

  private handleClick(pos: { x: number; y: number }): void {
    if (this.gameOver) return;

    // Tutorial modal has top priority so Skip/Next never clicks through to Pause!
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

    // Tutorial modal / skip button
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

      // Open stall manually once all required preps are done
      if (this.allRequiredPrepped() && InputManager.hitTest(pos, this.openShopNowBtn, 10)) {
        this.beginServicePhase();
      }
      return;
    }

    // ---- PHASE 2: SERVICE (PICK & MIX) CLICK HANDLING ----

    // 1. Tap a customer to select them OR serve directly if dish is ready!
    for (const c of this.customers) {
      if (c.served || c.leaving) continue;
      const cRect: Rect = { x: c.x - 6, y: c.y - 12, width: c.width + 86, height: c.height + 16 };
      if (InputManager.hitTest(pos, cRect, 4)) {
        if (c.id === this.selectedCustomerId && this.isAssemblyReadyFor(c)) {
          this.tryServeSelectedCustomer();
        } else {
          this.selectedCustomerId = c.id;
          this.assembledToppings.clear();
          this.refreshToppingBar();
          this.showFeedback(`🎯 Đang ghép cho khách gọi ${c.order.name}!`, '#FCA311');
          this.cats.say('golden', formatTasteSpeech(c.order, c.taste), 4.0);
        }
        return;
      }
    }

    // 2. Tap a Prepped Ingredient Tray on the middle counter to pick & add into the bowl!
    for (const tr of this.getVisibleTrays()) {
      const rect: Rect = { x: tr.x, y: tr.y, width: tr.width, height: tr.height };
      if (InputManager.hitTest(pos, rect, 6)) {
        this.pickIngredientFromTray(tr);
        return;
      }
    }

    // 3. Tap a Topping Jar on the bottom shelf!
    for (const { option, rect } of this.toppingJarRects) {
      if (InputManager.hitTest(pos, rect, 6)) {
        this.toggleTopping(option);
        return;
      }
    }

    // 4. Tap "🍽️ GIAO MÓN!" button
    if (InputManager.hitTest(pos, this.serveBtn, 8)) {
      this.tryServeSelectedCustomer();
      return;
    }

    // 5. Tap "🗑 Bỏ" button to clear assembly bowl
    if (InputManager.hitTest(pos, this.trashBtn, 6)) {
      this.clearAssemblyBowl(true);
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

    // During Prep Phase, pass taste: null so SAUCE launches Fruit Ninja / Swirl Whisk!
    this.activeMinigame = createMinigameForStep(
      {
        engine: this.engine,
        recipe: tr.sampleRecipe,
        step: tr.sampleStep,
        taste: null,
        particles: this.particles,
        difficulty: clamp(this.difficulty + 0.08, 0, 1), // Slightly extra spicy challenge in Prep Phase!
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
        boostedScore >= 85 ? 6
        : boostedScore >= 55 ? 5
        : 4;
      const totalPortions = earnedPortions + this.bonuses.prepStockBonus + this.marketBonusStock;

      tr.prepped = true;
      tr.quality = boostedScore;
      tr.stock = Math.min(tr.maxStock + 4, tr.stock + totalPortions);
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

    // If all required trays are now prepped in Phase 1, smoothly open the stall!
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
    this.phaseBannerText = `🔔 MỞ ${this.stallTier.name.toUpperCase()} — PHA 2: PICK & MIX!`;
    this.phaseBannerTimer = 2.4;
    this.spawnTimer = 200; // First customer arrives immediately!
    this.particles.emitStarburst(480, 220, '#ffd166', 32);
    this.cats.say(
      'both',
      'Nguyên liệu sơ chế thơm nức rồi!! Mở quán Pick & Mix bán cho khách ngay thôi!! 🍜✨',
      4.5,
    );
    this.tutorial.onServicePhaseStarted();
    this.refreshToppingBar();
  }

  // ============================================================
  // Phase 2 — Pick & Mix Assembly & Serving
  // ============================================================

  private pickIngredientFromTray(tr: PrepTray): void {
    const cust = this.getSelectedCustomer();
    if (!cust) {
      this.showFeedback('⏳ Chờ khách vào gọi món nhé!', '#FCA311');
      return;
    }

    // If tray ran out of stock mid-shift, tap to quick-refill via a snappy minigame!
    if (tr.stock <= 0) {
      this.cats.say('golden', `Hết ${tr.shortName} rồi! Làm nhanh mẻ mới bổ sung liền nhé! ⚡`, 3.0);
      this.launchPrepMinigame(this.trays.indexOf(tr));
      return;
    }

    const reqBases = this.getRequiredBases(cust.order);
    if (!reqBases.includes(tr.type)) {
      this.engine.audio.playSfx('error');
      this.showFeedback(`❌ Món ${cust.order.name} không cần ${tr.shortName}!`, '#E63946');
      this.particles.emitAngryPuff(tr.x + tr.width / 2, tr.y + 24);
      this.particles.shake(4, 0.14);
      this.cats.say('boss', `Khoan! ${cust.order.name} không dùng ${tr.shortName} đâu nha! 😾`, 3.0);
      return;
    }

    if (this.assembledBases.includes(tr.type)) {
      this.engine.audio.playSfx('click');
      this.showFeedback(`✅ Đã cho ${tr.shortName} vào món rồi!`, '#80ed99');
      return;
    }

    // Consume 1 stock & toss cleanly into Assembly Bowl!
    tr.stock = Math.max(0, tr.stock - 1);
    tr.flashTimer = 0.4;
    this.assembledBases.push(tr.type);
    this.engine.audio.playSfx('pop');

    const tx = tr.x + tr.width / 2;
    const ty = tr.y + tr.height / 2;
    this.particles.emitStarburst(tx, ty, '#ffd166', 10);
    this.particles.emitStarburst(515, 352, '#80ed99', 12);
    this.particles.emitFloatingText(515, 326, `+ ${tr.label}`, '#ffd166', 15);

    if (this.isAssemblyReadyFor(cust)) {
      this.tutorial.onDishReadyToServe();
      this.cats.say(
        'golden',
        `Ghép đủ cốt ${cust.order.name} rồi! Thêm gia vị khách dặn rồi bấm GIAO MÓN! 🍽️`,
        3.5,
      );
    }
  }

  private toggleTopping(option: ToppingOption): void {
    const cust = this.getSelectedCustomer();
    if (!cust) return;

    if (this.assembledToppings.has(option.id)) {
      this.assembledToppings.delete(option.id);
      this.engine.audio.playSfx('click');
      this.showFeedback(`Đã gắp ${option.label} ra`, '#cbd5e1');
      return;
    }

    this.assembledToppings.add(option.id);
    this.particles.emitSpiceRain(515, 350, option.color);

    if (cust.taste.forbidden && option.id === cust.taste.forbidden.id) {
      this.engine.audio.playSfx('error');
      this.particles.emitAngryPuff(515, 345);
      this.particles.shake(4.5, 0.16);
      this.showFeedback(`🚫 Khách dặn KHÔNG ${option.label.toUpperCase()}! Chạm lại để gắp ra!`, '#E63946');
      this.cats.say('boss', `Á!! Khách kiêng ${option.label} mà! Chạm lại hũ đó để gắp ra mau!! 🙀`, 3.5);
    } else if (cust.taste.wanted.some((w) => w.id === option.id)) {
      this.engine.audio.playSfx('spice');
      this.particles.emitStarburst(515, 344, '#ffd166', 10);
      this.showFeedback(`✅ Đúng vị ${option.emoji} ${option.label}!`, '#4CAF50');
    } else {
      this.engine.audio.playSfx('spice');
      this.showFeedback(`Đã thêm ${option.emoji} ${option.label}`, '#FCA311');
    }
  }

  private isAssemblyReadyFor(cust: InlineCustomer): boolean {
    const req = this.getRequiredBases(cust.order);
    return req.every((st) => this.assembledBases.includes(st));
  }

  private clearAssemblyBowl(feedback = false): void {
    this.assembledBases = [];
    this.assembledToppings.clear();
    if (feedback) {
      this.showFeedback('🗑 Đã dọn mâm ghép món', '#FCA311');
      this.cats.say('golden', 'Dọn sạch mâm rồi, chọn lại nguyên liệu chuẩn chỉnh nha!', 2.8);
    }
  }

  private tryServeSelectedCustomer(): void {
    const target = this.getSelectedCustomer();
    if (!target) return;

    const reqBases = this.getRequiredBases(target.order);
    const missingBase = reqBases.find((st) => !this.assembledBases.includes(st));
    if (missingBase) {
      const m = STATION_META[missingBase];
      this.engine.audio.playSfx('error');
      this.showFeedback(`⚠️ Chưa đủ món! Còn thiếu ${m.icon} ${m.name}!`, '#E63946');
      this.particles.shake(4, 0.15);
      this.cats.say('boss', `Khoan giao! Còn thiếu ${m.icon} ${m.name} trong tô kìa! 😾`, 3.2);
      return;
    }

    // Score 1: Prep Quality from the prepped trays used!
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

    // Score 2: Customer Custom Topping Accuracy!
    let tasteScore = 100;
    let addedForbidden = false;
    for (const w of target.taste.wanted) {
      if (!this.assembledToppings.has(w.id)) tasteScore -= 26;
    }
    if (target.taste.forbidden && this.assembledToppings.has(target.taste.forbidden.id)) {
      tasteScore -= 45;
      addedForbidden = true;
    }
    for (const tid of this.assembledToppings) {
      const isWanted = target.taste.wanted.some((w) => w.id === tid);
      const isForb = target.taste.forbidden?.id === tid;
      if (!isWanted && !isForb) tasteScore -= 8;
    }
    tasteScore = clamp(tasteScore, 25, 100);

    const finalQuality = Math.round(prepAvg * 0.45 + tasteScore * 0.55);
    const qualityMult = finalQuality >= 85 ? 1.45 : finalQuality >= 60 ? 1.12 : 0.78;

    // Serve customer!
    target.served = true;
    target.leaving = true;
    target.mood = addedForbidden ? CustomerMood.NEUTRAL : CustomerMood.HAPPY;

    const patienceRatio = target.patience / target.maxPatience;
    const baseTip = patienceRatio > 0.5 ? 1.45 : patienceRatio > 0.2 ? 1.12 : 0.85;
    const missionTip =
      this.levelConfig.missionType === 'picky' ? 1.25
      : this.levelConfig.missionType === 'vip_critic' ? 1.35
      : 1.0;

    const earned = Math.floor(
      target.order.basePrice *
      this.bonuses.priceMultiplier *
      baseTip *
      this.bonuses.tipMultiplier *
      missionTip *
      qualityMult,
    );

    this.money += earned;
    this.customersServed++;
    if (!addedForbidden) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    } else {
      this.combo = 0;
    }

    target.speechText = addedForbidden
      ? `Ôi lỡ bỏ ${target.taste.forbidden?.shortLabel} rồi 😅`
      : finalQuality >= 85
        ? 'Ngon chuẩn vị 10 điểm!! ⭐'
        : 'Cảm ơn hai bé mèo nha!';
    target.speechTimer = 2.0;

    // Juicy FX & Sound!
    this.engine.audio.playSfx(finalQuality >= 85 ? 'perfect' : 'coin');
    const custCx = target.x + target.width / 2;
    const custCy = target.y + 30;
    this.particles.emitStarburst(custCx, custCy, finalQuality >= 85 ? '#ffd166' : '#4CAF50', 22);
    this.particles.emitCoinShower(custCx, custCy, 66, 26, finalQuality >= 85 ? 9 : 6);
    this.particles.emitFloatingText(
      custCx,
      custCy - 18,
      `+${formatMoney(earned)}${finalQuality >= 85 ? ' ⭐' : ''}`,
      finalQuality >= 85 ? '#ffd166' : '#4CAF50',
      22,
    );

    // Clear bowl & immediately switch to next waiting customer
    this.clearAssemblyBowl(false);
    this.selectedCustomerId = null;
    this.refreshToppingBar();

    // Check instant wave-clear victory!
    if (this.customersServed >= this.targetCustomers) {
      this.reachedThreeStars = true;
      this.winDelayTimer = 0.95;
      this.particles.emitStarburst(480, 180, '#ffd166', 36);
      this.particles.emitFloatingText(480, 170, '🎉 HOÀN THÀNH MÀN! MỞ RƯƠNG THƯỞNG!', '#ffd166', 24);
      this.cats.say('both', 'HOÀN THÀNH ĐỦ KHÁCH RỒI!! Nhận Rương Thưởng và nâng cấp quán thôi!! 🎉🎁', 4.5);
    } else if (!this.reachedThreeStars && this.money >= this.levelConfig.targetScore) {
      this.reachedThreeStars = true;
      this.particles.emitStarburst(480, 140, '#ffd166', 32);
      this.particles.emitFloatingText(480, 150, '⭐⭐⭐ ĐẠT 3 SAO!', '#ffd166', 22);
      this.cats.say('both', 'ĐẠT 3 SAO RỒI!! Phục vụ nốt khách cuối là nhận rương thưởng nha! 🎉⭐', 4.5);
    } else if (addedForbidden) {
      this.cats.say('boss', 'Khách nhăn mặt vì dính món kiêng rồi! Lần sau xem kỹ phiếu 🚫 nha! 😿', 3.6);
    } else if (this.combo >= 3) {
      this.cats.say('both', `COMBO x${this.combo}!! Pick & Mix nhanh như tia chớp luôn!! 🔥⭐`, 4.0);
    } else if (finalQuality >= 85) {
      this.cats.say('boss', `Chuẩn từng topping! Khách bo đậm +${formatMoney(earned)}! 👑`, 3.6);
    } else {
      this.cats.say('golden', `Giao xong ${target.order.name}! +${formatMoney(earned)}! 🍜`, 3.2);
    }

    this.showFeedback(
      `💰 +${formatMoney(earned)}${finalQuality >= 85 ? ' ⭐ PERFECT!' : ''} Combo x${this.combo}`,
      addedForbidden ? '#FCA311' : '#4CAF50',
    );
    this.tutorial.onFirstCustomerServed();
  }

  // ============================================================
  // Customer Spawning
  // ============================================================

  private spawnCustomer(): boolean {
    const activeCount = this.customers.filter((c) => !c.leaving).length;
    if (activeCount >= this.levelConfig.maxCustomers) return false;
    if (this.customersServed + activeCount >= this.targetCustomers) return false;
    if (this.recipes.length === 0) return false;

    const recipe = randPick(this.recipes);
    const taste = generateCustomerTaste(
      recipe,
      this.difficulty,
      this.levelConfig.missionType ?? 'classic',
    );
    const slot = this.getNextCustomerSlot();
    // Smooth patience curve: 46s early -> 24s late!
    const basePatience = lerp(46, 24, this.difficulty);
    const patience = basePatience * randFloat(0.92, 1.08) * this.bonuses.patienceMultiplier;

    const pool =
      this.levelConfig.customerTypes && this.levelConfig.customerTypes.length > 0
        ? this.levelConfig.customerTypes
        : Object.values(CustomerType);
    const customerType = randPick(pool);
    const custCfg = CUSTOMERS.find((cfg) => cfg.type === customerType);
    const speechText = custCfg ? randPick(custCfg.speechBubbles) : 'Cho mình một phần thật ngon nha!';

    const customer: InlineCustomer = {
      id: this.nextCustomerId++,
      customerType,
      x: 960 + 80,
      targetX: slot.x,
      y: slot.y,
      width: 72,
      height: 90,
      patience,
      maxPatience: patience,
      order: recipe,
      taste,
      mood: CustomerMood.HAPPY,
      served: false,
      leaving: false,
      warnedImpatient: false,
      speechText,
      speechTimer: 3.8,
      orderBubbleAlpha: 0,
    };

    this.customers.push(customer);
    if (this.selectedCustomerId === null) {
      this.selectedCustomerId = customer.id;
      this.refreshToppingBar();
    }
    if (!this.activeMinigame) {
      const custName = custCfg?.name ?? 'Khách';
      this.cats.say('golden', `${custName}: "${speechText}" → ${formatTasteSpeech(recipe, taste)}`, 4.6);
    }
    return true;
  }

  private getNextCustomerSlot(): { x: number; y: number } {
    const slots = [34, 178, 322, 466, 610];
    const occupied = new Set(this.customers.filter((c) => !c.leaving).map((c) => c.targetX));
    for (const sx of slots) {
      if (!occupied.has(sx)) return { x: sx, y: 80 };
    }
    return { x: clamp(34 + occupied.size * 144, 34, 610), y: 80 };
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

    // Ambient lantern dust & hot tray steam (throttled lightly on mobile for 60fps!)
    if (!this.activeMinigame) {
      const ambScale = isTouchDevice() ? 0.45 : 1;
      if (Math.random() < dt * 4.0 * ambScale) {
        this.particles.emitLanternDust(randFloat(40, 920), randFloat(68, 165));
      }
      for (const tr of this.getVisibleTrays()) {
        if (
          tr.prepped &&
          (tr.type === StationType.BROTH || tr.type === StationType.GRILL || tr.type === StationType.WOK) &&
          Math.random() < dt * 2.2 * ambScale
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

    // Update active Prep / Refill Minigame
    if (this.activeMinigame) {
      this.activeMinigame.update(dt);
      if (this.activeMinigame.done) {
        this.completeActiveMinigame();
      }
    }

    // In Phase 1 (Prep), customer timers do NOT tick — pure preparation focus!
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
          this.cats.say('golden', `Á á khách gọi ${c.order.name} sắp hết kiên nhẫn rồi!! Nhanh tay Pick & Mix!! 💦`, 3.5);
        }
      }

      if (c.patience <= 0) {
        c.leaving = true;
        c.mood = CustomerMood.ANGRY;
        this.combo = 0;
        if (this.selectedCustomerId === c.id) {
          this.selectedCustomerId = null;
          this.clearAssemblyBowl(false);
          this.refreshToppingBar();
        }
        this.engine.audio.playSfx('error');
        this.showFeedback('😡 Khách bỏ đi!', '#E63946');
        this.particles.emitAngryPuff(c.x + c.width / 2, c.y + 24);
        this.particles.shake(5, 0.2);
        this.cats.say('boss', 'Khách đợi lâu quá bỏ đi mất rồi! Ghép món nhanh tay lên nhé! 😾', 3.5);
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
  // Render Pipeline
  // ============================================================

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Stall Tier 16-bit Pixel Art Background (Xe Đẩy → Vỉa Hè → Phố Cổ → 5 Sao!)
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

    // 3. Customers (in Service Phase) OR Morning Prep Banner (in Prep Phase)
    if (this.phase === 'service') {
      this.renderCustomers(ctx);
    } else {
      this.renderPrepStageHeader(ctx, W);
    }

    // 4. Live Interactive Cat Kitchen Booth (top-right corner)
    if (!this.tutorial.isActive && !this.activeMinigame) {
      this.cats.render(ctx);
    }

    // 5. Ingredient Trays on Counter (Prep Trays or Pick & Mix Trays!)
    this.renderTrays(ctx);

    // 6. Lower Area: Phase 1 Open-Stall Prompt OR Phase 2 Assembly Workstation + Topping Jars!
    if (this.phase === 'prep') {
      this.renderPrepBottomBar(ctx, W);
    } else {
      this.renderAssemblyStrip(ctx);
      this.renderToppingShelf(ctx);
    }

    // 7. Floating Feedback Toast
    if (this.feedbackTimer > 0 && !this.activeMinigame) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.feedbackTimer);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, this.feedbackText, W / 2, 192, this.feedbackColor);
      ctx.restore();
    }

    // 8. Phase Transition Fanfare Banner
    if (this.phaseBannerTimer > 0 && !this.activeMinigame && !this.briefingOpen) {
      const alpha = Math.min(1, this.phaseBannerTimer * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      roundRect(ctx, 180, 146, 600, 46, 14);
      ctx.fillStyle = 'rgba(15, 16, 32, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, this.phaseBannerText, W / 2, 169, '#ffd166');
      ctx.restore();
    }

    // 9. Active Prep/Refill Minigame Modal
    if (this.activeMinigame) {
      this.activeMinigame.render(ctx);
    }

    // 10. 60fps Particle FX Layer
    this.particles.render(ctx);

    // 11. Cat Tutorial Overlay
    if (this.tutorial.isActive && !this.activeMinigame) {
      this.tutorial.render(ctx, W, H, this.getTutorialTarget());
    }

    // 12. Pre-Level Briefing Modal
    if (this.briefingOpen) {
      this.renderBriefing(ctx, W, H);
    }

    ctx.restore();

    // 13. Pause Overlay
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
    ctx.fillStyle = 'rgba(10, 12, 24, 0.78)';
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

    // Center: Phase Pill + Stall Tier + Customer Wave
    ctx.textAlign = 'center';
    ctx.font = 'bold 14.5px "Segoe UI", system-ui, sans-serif';
    const centerX = this.reachedThreeStars ? 416 : W / 2 - 12;
    const statusLabel =
      this.phase === 'prep'
        ? `🌅 PHA 1: SƠ CHẾ  •  ${this.stallTier.icon} ${this.stallTier.name}`
        : `🏮 PHA 2: PICK & MIX  •  👥 ${this.customersServed}/${this.targetCustomers}  •  ${this.stallTier.icon} Cấp ${this.stallTier.tier}`;
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
    const timerRightX = this.muteBtn.x - 10;
    drawTextShadow(
      ctx,
      this.phase === 'prep' ? '🌅 SƠ CHẾ' : `⏱ ${formatTime(this.timeRemaining)}`,
      timerRightX,
      25,
      timeColor,
    );

    // Mute toggle button
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

    // Compact Prep Progress Sign on left half (leaves right half clear for Cat Booth + speech bubble!)
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

    // Today's Menu icons preview strip
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
        `Hoàn thành hết ${pending.length} khay còn lại sẽ TỰ ĐỘNG mở ${this.stallTier.icon} ${this.stallTier.name} đón khách vào Pha 2 Pick & Mix!`,
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

  // ---- Ingredient Trays on Counter (Both Phase 1 & Phase 2!) ----

  private renderTrays(ctx: CanvasRenderingContext2D): void {
    const visible = this.getVisibleTrays();
    const targetCust = this.phase === 'service' ? this.getSelectedCustomer() : null;
    const reqBases = targetCust ? this.getRequiredBases(targetCust.order) : [];
    const pointer = this.engine.input.pointer;

    ctx.imageSmoothingEnabled = false;
    for (const tr of visible) {
      const rect: Rect = { x: tr.x, y: tr.y, width: tr.width, height: tr.height };
      const hover = InputManager.hitTest(pointer, rect);
      const needsPrep = this.phase === 'prep' && !tr.prepped;
      const neededNow =
        this.phase === 'service' &&
        reqBases.includes(tr.type) &&
        !this.assembledBases.includes(tr.type);
      const alreadyPicked =
        this.phase === 'service' && this.assembledBases.includes(tr.type);
      const pulse = 0.65 + 0.35 * Math.sin(this.elapsed * 7);

      ctx.save();

      // Fast zero-blur drop shadow beneath tray (10x faster on mobile GPUs!)
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
        ctx.fillStyle = hover ? 'rgba(35, 30, 52, 0.85)' : 'rgba(18, 16, 30, 0.74)';
      }
      ctx.fill();

      // Glowing border for active Prep / Needed Service Ingredient
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

      // Pixel-art Station / Ingredient Sprite
      const spriteKey = `station_${tr.type.toLowerCase()}`;
      const spriteSize = this.phase === 'prep' ? Math.min(tr.width - 26, 66) : Math.min(tr.width - 24, 58);
      if (this.engine.assets.hasImage(spriteKey)) {
        ctx.drawImage(
          this.engine.assets.getImage(spriteKey),
          tr.x + (tr.width - spriteSize) / 2,
          tr.y + (this.phase === 'prep' ? 14 : 6),
          spriteSize,
          spriteSize,
        );
      }

      // Ingredient Name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, tr.shortName, tr.x + tr.width / 2, tr.y + tr.height - (this.phase === 'prep' ? 28 : 13), '#fff');

      if (this.phase === 'prep') {
        // Phase 1 sub-hint or Ready badge!
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
        // Phase 2 Service: Stock Counter Pill top-right + Quality Star top-left + Picked check!
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

  // ---- Phase 2: Assembly Workstation Strip & Bottom Topping Shelf ----

  private renderAssemblyStrip(ctx: CanvasRenderingContext2D): void {
    const cust = this.getSelectedCustomer();

    // Backdrop strip
    roundRect(ctx, 18, 312, 924, 82, 14);
    ctx.fillStyle = 'rgba(14, 15, 30, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (!cust) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('⏳ Đang đón khách tiếp theo tới quầy...', 480, 353);
      return;
    }

    const reqBases = this.getRequiredBases(cust.order);
    const ready = this.isAssemblyReadyFor(cust);

    // 1. LEFT: Target Customer Order Checklist (x: 28..372)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `📋 Đơn khách: ${cust.order.name}`, 32, 330, '#FCA311');

    // Base ingredient checklist pills
    let bx = 32;
    for (const st of reqBases) {
      const done = this.assembledBases.includes(st);
      const m = STATION_META[st];
      const txt = `${done ? '✅' : '⬜'} ${m.icon} ${m.name}`;
      ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, 344, tw, 22, 6);
      ctx.fillStyle = done ? 'rgba(45, 147, 72, 0.7)' : 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, bx + tw / 2, 355);
      bx += tw + 5;
    }

    // Custom Taste line (Wanted + Forbidden)
    let tx = 32;
    ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
    for (const w of cust.taste.wanted) {
      const has = this.assembledToppings.has(w.id);
      const txt = `${has ? '✅' : '+'} ${w.emoji} ${w.shortLabel}`;
      const tw = ctx.measureText(txt).width + 10;
      roundRect(ctx, tx, 370, tw, 20, 6);
      ctx.fillStyle = has ? '#2d9348' : '#e85d04';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, tx + tw / 2, 380);
      tx += tw + 5;
    }
    if (cust.taste.forbidden) {
      const f = cust.taste.forbidden;
      const violated = this.assembledToppings.has(f.id);
      const txt = `🚫 ${f.emoji} Không ${f.shortLabel}`;
      const tw = ctx.measureText(txt).width + 10;
      roundRect(ctx, tx, 370, tw, 20, 6);
      ctx.fillStyle = violated ? '#d00000' : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, tx + tw / 2, 380);
    }

    // 2. CENTER: Live Pick & Mix Serving Plate / Bowl (x: 416..654)
    const bowlCx = 535;
    const bowlCy = 353;
    roundRect(ctx, 418, 320, 236, 66, 12);
    ctx.fillStyle = ready ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = ready ? '#4CAF50' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (ready) {
      // Finished dish sprite glowing in center of plate + added topping badges!
      const foodKey = `food_${cust.order.id}`;
      if (this.engine.assets.hasImage(foodKey)) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.engine.assets.getImage(foodKey), bowlCx - 66, bowlCy - 29, 58, 58);
      }
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '✨ Sẵn sàng giao!', bowlCx - 2, bowlCy - 12, '#80ed99');

      // Show picked toppings emojis
      const pool = cust.taste.tray;
      const topEmojis = Array.from(this.assembledToppings)
        .map((id) => pool.find((p) => p.id === id)?.emoji ?? '')
        .join(' ');
      ctx.font = '17px "Segoe UI"';
      ctx.fillText(topEmojis || '(Chưa thêm gia vị)', bowlCx - 2, bowlCy + 14);
    } else if (this.assembledBases.length === 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('🥣 Chạm khay nguyên liệu phía trên', bowlCx, bowlCy - 8);
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('để ghép thành món ăn!', bowlCx, bowlCy + 12);
    } else {
      // Show icons of ingredients mixed into the bowl so far
      const icons = this.assembledBases.map((st) => STATION_META[st].icon).join(' + ');
      ctx.textAlign = 'center';
      ctx.font = '24px "Segoe UI"';
      ctx.fillText(icons, bowlCx, bowlCy - 8);
      ctx.font = '11.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`Đã ghép ${this.assembledBases.length}/${reqBases.length} nguyên liệu chính`, bowlCx, bowlCy + 18);
    }

    // 3. RIGHT: Serve Button & Trash Button
    const sb = this.serveBtn;
    const pulse = ready ? 1 + Math.sin(this.elapsed * 7) * 0.03 : 1;
    ctx.save();
    ctx.translate(sb.x + sb.width / 2, sb.y + sb.height / 2);
    ctx.scale(pulse, pulse);
    roundRect(ctx, -sb.width / 2, -sb.height / 2, sb.width, sb.height, 12);
    ctx.fillStyle = ready ? '#2d9348' : 'rgba(71, 85, 105, 0.7)';
    ctx.fill();
    ctx.strokeStyle = ready ? '#ffd166' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = ready ? 2.5 : 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🍽️ GIAO MÓN!', 0, 0, ready ? '#fff' : '#cbd5e1');
    ctx.restore();

    const tb = this.trashBtn;
    roundRect(ctx, tb.x, tb.y, tb.width, tb.height, 12);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🗑 Bỏ', tb.x + tb.width / 2, tb.y + tb.height / 2, '#fff');
  }

  private renderToppingShelf(ctx: CanvasRenderingContext2D): void {
    const cust = this.getSelectedCustomer();
    if (this.toppingJarRects.length === 0) this.refreshToppingBar();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(
      `🧂 GIA VỊ & TOPPING PICK-AND-MIX (Chất lượng sơ chế: ${Math.round(this.seasoningQuality)}% ${this.seasoningQuality >= 85 ? '⭐' : ''}) — Chạm hũ để rắc vào món:`,
      480,
      412,
    );

    const pointer = this.engine.input.pointer;
    for (const { option, rect } of this.toppingJarRects) {
      const picked = this.assembledToppings.has(option.id);
      const isWanted = cust?.taste.wanted.some((w) => w.id === option.id) ?? false;
      const isForb = cust?.taste.forbidden?.id === option.id;
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

      // Subtle tag in corner for Wanted / Forbidden!
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
      ctx.font = '30px "Segoe UI"';
      ctx.fillText(option.emoji, rect.x + rect.width / 2, rect.y + 32);

      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, option.label, rect.x + rect.width / 2, rect.y + 66, '#fff');
    }
  }

  // ---- Customers ----

  private renderCustomers(ctx: CanvasRenderingContext2D): void {
    const selected = this.getSelectedCustomer();
    ctx.imageSmoothingEnabled = false;

    for (const c of this.customers) {
      ctx.save();
      const isTarget = selected?.id === c.id && !c.served && !c.leaving;
      const isMoving = c.x > c.targetX + 1 || c.leaving;
      const bounceY = isMoving ? Math.abs(Math.sin(c.x * 0.08)) * -5 : 0;
      const drawY = c.y + bounceY;

      // Active target golden highlight ring under selected customer!
      ctx.beginPath();
      ctx.ellipse(c.x + c.width / 2, c.y + c.height + 2, c.width / 2.2, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = isTarget ? 'rgba(255, 209, 102, 0.42)' : 'rgba(0,0,0,0.35)';
      ctx.fill();
      if (isTarget) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

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
      ctx.font = '16px "Segoe UI"';
      ctx.fillText(faceEmoji, c.x + 8, drawY + 12);

      if (!c.served && !c.leaving) {
        const ratio = c.patience / c.maxPatience;
        const barColor = ratio > 0.5 ? '#4CAF50' : ratio > 0.2 ? '#FFC107' : '#E63946';
        drawProgressBar(ctx, c.x + 2, c.y + c.height + 5, c.width - 4, 7, ratio, barColor);
      }

      if (!c.served && c.orderBubbleAlpha > 0) {
        ctx.globalAlpha = c.orderBubbleAlpha;
        const bx = c.x + c.width - 4;
        const by = c.y - 10;
        const bw = 78;
        const bh = 82;

        roundRect(ctx, bx, by, bw, bh, 10);
        ctx.fillStyle = isTarget ? '#fffbeb' : '#fffcf5';
        ctx.fill();
        ctx.strokeStyle = isTarget ? '#e85d04' : '#3d281c';
        ctx.lineWidth = isTarget ? 3 : 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bx, by + bh / 2 - 4);
        ctx.lineTo(bx - 8, by + bh / 2 + 2);
        ctx.lineTo(bx, by + bh / 2 + 8);
        ctx.fillStyle = isTarget ? '#fffbeb' : '#fffcf5';
        ctx.fill();

        const foodKey = `food_${c.order.id}`;
        if (this.engine.assets.hasImage(foodKey)) {
          ctx.drawImage(this.engine.assets.getImage(foodKey), bx + (bw - 42) / 2, by + 2, 42, 42);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#2b1c17';
        const shortName = c.order.name.length > 11 ? `${c.order.name.slice(0, 10)}…` : c.order.name;
        ctx.fillText(shortName, bx + bw / 2, by + 52);

        ctx.font = '10px "Segoe UI"';
        ctx.fillStyle = '#b5561d';
        ctx.fillText(c.taste.summaryBadges.join(' '), bx + bw / 2, by + 70);

        ctx.globalAlpha = 1;
      }

      if (c.speechTimer > 0 && c.speechText && c.x <= c.targetX + 30) {
        const sAlpha = Math.min(1, c.speechTimer * 1.5);
        ctx.save();
        ctx.globalAlpha = sAlpha;
        ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
        const sw = Math.min(185, ctx.measureText(c.speechText).width + 16);
        const sx = clamp(c.x + c.width / 2 - sw / 2, 10, 740 - sw);
        const sy = c.y - 28;
        roundRect(ctx, sx, sy, sw, 22, 8);
        ctx.fillStyle = c.served ? 'rgba(45, 147, 72, 0.92)' : 'rgba(17, 19, 38, 0.9)';
        ctx.fill();
        ctx.strokeStyle = c.served ? '#80ed99' : '#FCA311';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(c.speechText, sx + sw / 2, sy + 11);
        ctx.restore();
      }

      if (c.served) {
        ctx.font = '28px "Segoe UI"';
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
      const cust = this.getSelectedCustomer();
      if (!cust) return null;
      const req = this.getRequiredBases(cust.order);
      const missing = req.find((st) => !this.assembledBases.includes(st));
      if (missing) {
        const tr = this.getVisibleTrays().find((t) => t.type === missing);
        if (tr) return { rect: { x: tr.x, y: tr.y, width: tr.width, height: tr.height } };
      }
      return { rect: this.serveBtn };
    }
    if (stage === 'service_serve') {
      return { rect: this.serveBtn };
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
      classic: { text: '🎯 NHIỆM VỤ: SƠ CHẾ → PICK & MIX CHUẨN VỊ', color: '#2A9D8F' },
      rush: { text: '⚡ GIỜ CAO ĐIỂM: KHÁCH TỚI LIÊN TỤC!', color: '#E85D04' },
      picky: { text: '🌶️ KHÁCH KHÓ TÍNH: ĐÚNG TOPPING TIP x1.25!', color: '#E63946' },
      vip_critic: { text: '⭐ THỬ THÁCH BOSS: GIÁM KHẢO ẨM THỰC!', color: '#D97706' },
    };
    const mInfo = missionMap[this.levelConfig.missionType ?? 'classic'];
    roundRect(ctx, cardX + 130, cardY - 16, cardW - 260, 32, 16);
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

    // 2 Info Pills: Left Quota & Chest, Right Difficulty Tier
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

    // 2-Cat Live Story Banter
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
      this.levelConfig.introBoss ?? 'Sơ chế nguyên liệu thật chuẩn trước rồi mở quán Pick & Mix nhé!',
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
      this.levelConfig.introGolden ?? 'Em đã dọn quầy sẵn sàng rồi! Sơ chế xong là bày ra bán liền!',
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
