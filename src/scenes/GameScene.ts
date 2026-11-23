// ============================================================
// GameScene — Main gameplay: cooking, customers, stations
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Recipe, LevelConfig, CookingStep } from '../types';
import { StationType, CustomerMood, CustomerType } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { formatMoney, formatTime, clamp, randFloat, randInt, randPick } from '../utils/math';
import { RECIPES, getRecipe } from '../data/recipes';
import { getLevel } from '../data/levels';
import { ResultScene } from './ResultScene';
import { MapScene } from './MapScene';
import { supportsFullscreen, toggleFullscreen } from '../utils/mobile';
import { TutorialSystem, type TutorialTarget } from '../systems/TutorialSystem';
import { CatCompanionSystem } from '../systems/CatCompanionSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import {
  generateCustomerTaste,
  formatTasteSpeech,
  type CustomerTasteOrder,
} from '../data/tastes';
import { createMinigameForStep } from '../minigames/MinigameFactory';
import type { CookingMinigame } from '../minigames/types';

// ---- Inline entity types (self-contained vertical slice) ----

interface InlineStation {
  type: StationType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  state: 'idle' | 'cooking' | 'done';
  cookTimer: number;
  cookDuration: number;
  currentStep: CookingStep | null;
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
  orderBubbleAlpha: number;
}

interface ActiveDish {
  recipe: Recipe;
  currentStepIndex: number;
  steps: CookingStep[];
  stepScores: number[];
  completed: boolean;
}

// Station visual config
const STATION_COLORS: Record<StationType, string> = {
  [StationType.BROTH]: '#B5651D',
  [StationType.NOODLE]: '#F5DEB3',
  [StationType.MEAT]: '#CD5C5C',
  [StationType.VEGGIE]: '#4CAF50',
  [StationType.SAUCE]: '#FF8C00',
  [StationType.BREAD]: '#DEB887',
  [StationType.GRILL]: '#8B0000',
  [StationType.WOK]: '#696969',
  [StationType.DRINK]: '#4169E1',
  [StationType.DESSERT]: '#DA70D6',
};

const STATION_LABELS: Record<StationType, string> = {
  [StationType.BROTH]: '🍲 Nồi',
  [StationType.NOODLE]: '🍜 Phở',
  [StationType.MEAT]: '🥩 Thịt',
  [StationType.VEGGIE]: '🥬 Rau',
  [StationType.SAUCE]: '🧂 Gia vị',
  [StationType.BREAD]: '🍞 Bánh mì',
  [StationType.GRILL]: '🔥 Nướng',
  [StationType.WOK]: '🍳 Xào',
  [StationType.DRINK]: '☕ Uống',
  [StationType.DESSERT]: '🍮 Chè',
};

export class GameScene implements Scene {
  private engine: Engine;
  private levelId: number;
  private levelConfig!: LevelConfig;

  // Game state
  private timeRemaining = 0;
  private paused = false;
  private gameOver = false;
  private money = 0;
  private customersServed = 0;
  private combo = 0;
  private maxCombo = 0;

  // Entities
  private stations: InlineStation[] = [];
  private customers: InlineCustomer[] = [];
  private recipes: Recipe[] = [];
  private activeDish: ActiveDish | null = null;

  // Spawning
  private spawnTimer = 0;
  private nextCustomerId = 0;

  // UI rects (enlarged for comfortable mobile touch)
  private recipeCards: { recipe: Recipe; rect: Rect }[] = [];
  private pauseBtn: Rect = { x: 896, y: 6, width: 52, height: 40 };
  private fullscreenBtn: Rect = { x: 836, y: 6, width: 50, height: 40 };
  private finishEarlyBtn: Rect = { x: 584, y: 8, width: 122, height: 36 };
  private cancelDishBtn: Rect = { x: 850, y: 357, width: 84, height: 34 };
  private resumeBtn: Rect = { x: 318, y: 290, width: 156, height: 52 };
  private exitMapBtn: Rect = { x: 486, y: 290, width: 156, height: 52 };

  // 2-Cat NPC Tutorial, Live Cat Companion & Visual Particle FX
  private tutorial: TutorialSystem;
  private cats: CatCompanionSystem;
  private particles = new ParticleSystem();
  private forceTutorial: boolean;
  private reachedThreeStars = false;

  // Interactive Cooking Minigame
  private activeMinigame: CookingMinigame | null = null;
  private activeStationIndex = -1;

  // Input listeners
  private removeClick?: () => void;
  private removeDown?: () => void;
  private removeMove?: () => void;
  private removeUp?: () => void;

  // Feedback
  private feedbackText = '';
  private feedbackTimer = 0;
  private feedbackColor = '#fff';

  // Flash
  private stationFlashTimer = 0;
  private stationFlashIndex = -1;

  constructor(engine: Engine, levelId: number, forceTutorial = false) {
    this.engine = engine;
    this.levelId = levelId;
    this.forceTutorial = forceTutorial;
    this.tutorial = new TutorialSystem(engine);
    this.cats = new CatCompanionSystem(engine);
  }

  enter(): void {
    this.engine.input.clear();

    // Load level config
    const cfg = getLevel(this.levelId);
    if (!cfg) {
      // Fallback to a simple default
      this.levelConfig = {
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
    } else {
      this.levelConfig = cfg;
    }

    this.timeRemaining = this.levelConfig.timeLimit;
    this.money = 0;
    this.customersServed = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.paused = false;
    this.gameOver = false;
    this.activeDish = null;
    this.activeMinigame = null;
    this.activeStationIndex = -1;
    this.reachedThreeStars = false;
    this.particles.clear();
    this.customers = [];
    this.nextCustomerId = 0;
    this.spawnTimer = 500; // first spawn shortly after starting
    this.cats.say('boss', 'Sẵn sàng nổi lửa chưa? Chờ khách vào gọi món nhé! 🔥', 4.0);
    if (this.forceTutorial || (this.levelId === 1 && !this.engine.save.current.tutorialCompleted)) {
      this.tutorial.start();
    }

    // Resolve available recipes
    this.recipes = [];
    for (const rid of this.levelConfig.availableRecipes) {
      const r = getRecipe(rid);
      if (r) this.recipes.push(r);
    }
    if (this.recipes.length === 0) {
      // Fallback: use pho_bo
      const pho = RECIPES[0];
      if (pho) this.recipes.push(pho);
    }

    // Determine which station types are needed
    const neededTypes = new Set<StationType>();
    for (const r of this.recipes) {
      for (const step of r.steps) {
        neededTypes.add(step.stationType);
      }
    }

    // Create stations (dynamically sized to fit within 920px)
    this.stations = [];
    const typesArr = Array.from(neededTypes);
    const stationGap = typesArr.length > 7 ? 8 : 16;
    const stationW = Math.min(100, Math.floor((920 - (typesArr.length - 1) * stationGap) / Math.max(1, typesArr.length)));
    const stationH = 110;
    const totalW = typesArr.length * stationW + (typesArr.length - 1) * stationGap;
    const startX = (960 - totalW) / 2;

    for (let i = 0; i < typesArr.length; i++) {
      const t = typesArr[i];
      this.stations.push({
        type: t,
        label: STATION_LABELS[t] ?? t,
        x: startX + i * (stationW + stationGap),
        y: 220,
        width: stationW,
        height: stationH,
        color: STATION_COLORS[t] ?? '#888',
        state: 'idle',
        cookTimer: 0,
        cookDuration: 0,
        currentStep: null,
      });
    }

    // Build recipe cards (dynamically sized to fit within 920px)
    this.recipeCards = [];
    const cardGap = this.recipes.length > 5 ? 10 : 16;
    const cardW = Math.min(140, Math.floor((920 - (this.recipes.length - 1) * cardGap) / Math.max(1, this.recipes.length)));
    const cardH = 100;
    const totalCardW = this.recipes.length * cardW + (this.recipes.length - 1) * cardGap;
    const cardStartX = (960 - totalCardW) / 2;

    for (let i = 0; i < this.recipes.length; i++) {
      this.recipeCards.push({
        recipe: this.recipes[i],
        rect: {
          x: cardStartX + i * (cardW + cardGap),
          y: 410,
          width: cardW,
          height: cardH,
        },
      });
    }

    // Pointer drag/hold listeners for interactive cooking minigames
    this.removeDown = this.engine.input.onDown((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) {
        this.activeMinigame.onDown?.(pos);
      }
    });

    this.removeMove = this.engine.input.onMove((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) {
        this.activeMinigame.onMove?.(pos);
      }
    });

    this.removeUp = this.engine.input.onUp((pos) => {
      if (this.gameOver || this.paused) return;
      if (this.activeMinigame) {
        this.activeMinigame.onUp?.(pos);
      }
    });

    // Input (generous mobile touch padding on all interactive elements)
    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.gameOver) return;

      // Fullscreen toggle (mobile convenience)
      if (supportsFullscreen() && InputManager.hitTest(pos, this.fullscreenBtn, 6)) {
        void toggleFullscreen();
        return;
      }

      // Pause button
      if (InputManager.hitTest(pos, this.pauseBtn, 6)) {
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

      // Early finish button once 3 stars are achieved (no waiting around!)
      if (
        this.reachedThreeStars &&
        !this.activeMinigame &&
        InputManager.hitTest(pos, this.finishEarlyBtn, 6)
      ) {
        this.endGame();
        return;
      }

      // Active cooking minigame consumes clicks while open
      if (this.activeMinigame) {
        this.activeMinigame.onClick?.(pos);
        return;
      }

      // Let Cat NPC tutorial handle modal taps & skip button first
      if (this.tutorial.handleClick(pos)) {
        return;
      }

      // Pet / tap the 2 resident Cat NPCs in the Cat Booth!
      if (this.cats.handleClick(pos)) {
        return;
      }

      // Cancel active dish button
      if (this.activeDish && InputManager.hitTest(pos, this.cancelDishBtn, 6)) {
        for (const st of this.stations) {
          st.state = 'idle';
          st.cookTimer = 0;
          st.currentStep = null;
        }
        this.activeDish = null;
        this.showFeedback('🗑 Đã hủy món', '#FCA311');
        this.cats.say('golden', 'Hủy món rồi, chọn lại món khách cần nhé!');
        return;
      }

      // Click recipe card → start new dish
      if (!this.activeDish) {
        for (const card of this.recipeCards) {
          if (InputManager.hitTest(pos, card.rect, 6)) {
            this.startDish(card.recipe);
            return;
          }
        }
      }

      // Click station → launch interactive cooking minigame!
      if (this.activeDish && !this.activeDish.completed) {
        for (let i = 0; i < this.stations.length; i++) {
          const st = this.stations[i];
          const rect: Rect = { x: st.x, y: st.y, width: st.width, height: st.height };
          if (InputManager.hitTest(pos, rect, 6)) {
            this.handleStationClick(i);
            return;
          }
        }
      }
    });
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

  private startDish(recipe: Recipe): void {
    this.activeDish = {
      recipe,
      currentStepIndex: 0,
      steps: [...recipe.steps],
      stepScores: [],
      completed: false,
    };
    this.showFeedback(`🍳 ${recipe.name} — Bước 1: ${recipe.steps[0].action}`, '#FCA311');
    this.tutorial.onDishStarted();
    this.cats.say('golden', `Bắt đầu làm ${recipe.name}! Chạm trạm ${STATION_LABELS[recipe.steps[0].stationType]} nhé!`, 3.5);
    for (let i = 0; i < this.stations.length; i++) {
      if (this.stations[i].type === recipe.steps[0].stationType) {
        this.stationFlashIndex = i;
        this.stationFlashTimer = 1.5;
        break;
      }
    }
  }

  private findMatchingCustomer(recipeId: string): InlineCustomer | null {
    for (const c of this.customers) {
      if (!c.served && !c.leaving && c.order.id === recipeId) {
        return c;
      }
    }
    return null;
  }

  private handleStationClick(stationIndex: number): void {
    const station = this.stations[stationIndex];
    const dish = this.activeDish;
    if (!dish || dish.completed || this.activeMinigame) return;

    const currentStep = dish.steps[dish.currentStepIndex];

    // Check if this is the correct station
    if (station.type !== currentStep.stationType) {
      this.showFeedback(`❌ Sai trạm! Cần: ${STATION_LABELS[currentStep.stationType]}`, '#E63946');
      this.particles.emitAngryPuff(station.x + station.width / 2, station.y + 24);
      this.particles.shake(4, 0.16);
      this.cats.say('boss', `Nhầm trạm rồi! Đang cần ${STATION_LABELS[currentStep.stationType]} cơ mà! 😾`, 3.0);
      return;
    }

    // Launch the tailored interactive cooking minigame for this step!
    const matchingCustomer = this.findMatchingCustomer(dish.recipe.id);
    const isLastStep = dish.currentStepIndex === dish.steps.length - 1;

    station.state = 'cooking';
    station.currentStep = currentStep;
    this.activeStationIndex = stationIndex;

    this.activeMinigame = createMinigameForStep(
      {
        engine: this.engine,
        recipe: dish.recipe,
        step: currentStep,
        taste: matchingCustomer?.taste ?? null,
        particles: this.particles,
      },
      isLastStep,
    );

    const nextIdx = dish.currentStepIndex + 1;
    const nextLabel =
      nextIdx < dish.steps.length
        ? STATION_LABELS[dish.steps[nextIdx].stationType]
        : undefined;
    this.tutorial.onStationCookStarted(nextLabel);
  }

  private completeActiveMinigame(): void {
    const mg = this.activeMinigame;
    if (!mg) return;

    const res = mg.result;
    const stIdx = this.activeStationIndex;
    this.activeMinigame = null;
    this.activeStationIndex = -1;

    if (stIdx >= 0 && this.stations[stIdx]) {
      this.stations[stIdx].state = 'done';
      this.stations[stIdx].currentStep = null;
      this.stations[stIdx].cookTimer = -0.35;
    }

    if (res && this.activeDish) {
      this.activeDish.stepScores.push(res.score);
      this.cats.say(res.catSpeaker, res.catComment, 4.0);
    }

    this.advanceDishStep();
  }

  private advanceDishStep(): void {
    const dish = this.activeDish;
    if (!dish) return;

    dish.currentStepIndex++;

    if (dish.currentStepIndex >= dish.steps.length) {
      // Dish complete! Auto-serve to matching customer
      dish.completed = true;
      this.serveDish(dish);
    } else {
      const nextStep = dish.steps[dish.currentStepIndex];
      this.tutorial.setDynamicHint(STATION_LABELS[nextStep.stationType]);
      this.showFeedback(
        `✅ Bước ${dish.currentStepIndex + 1}: ${nextStep.action}`,
        '#4CAF50',
      );
      // Flash the correct station
      for (let i = 0; i < this.stations.length; i++) {
        if (this.stations[i].type === nextStep.stationType) {
          this.stationFlashIndex = i;
          this.stationFlashTimer = 1.0;
          break;
        }
      }
    }
  }

  private serveDish(dish: ActiveDish): void {
    const target = this.findMatchingCustomer(dish.recipe.id);

    if (target) {
      target.served = true;
      target.leaving = true;
      target.mood = CustomerMood.HAPPY;

      // Average minigame cooking quality (0.5..1.4x multiplier!)
      const avgScore =
        dish.stepScores.length > 0
          ? dish.stepScores.reduce((a, b) => a + b, 0) / dish.stepScores.length
          : 85;
      const qualityMultiplier = avgScore >= 85 ? 1.4 : avgScore >= 60 ? 1.1 : 0.8;

      // Patience tip multiplier
      const patienceRatio = target.patience / target.maxPatience;
      const tipMultiplier = patienceRatio > 0.5 ? 1.5 : patienceRatio > 0.2 ? 1.0 : 0.75;
      const earned = Math.floor(dish.recipe.basePrice * tipMultiplier * qualityMultiplier);

      this.money += earned;
      this.customersServed++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Juicy serving FX: starburst, arcing gold coins to money HUD, floating payout text!
      const custCx = target.x + target.width / 2;
      const custCy = target.y + 30;
      this.particles.emitStarburst(custCx, custCy, avgScore >= 85 ? '#ffd166' : '#4CAF50', 22);
      this.particles.emitCoinShower(custCx, custCy, 66, 26, avgScore >= 85 ? 9 : 6);
      this.particles.emitFloatingText(
        custCx,
        custCy - 18,
        `+${formatMoney(earned)}${avgScore >= 85 ? ' ⭐' : ''}`,
        avgScore >= 85 ? '#ffd166' : '#4CAF50',
        22,
      );

      // Celebrate hitting 3-star milestone!
      if (!this.reachedThreeStars && this.money >= this.levelConfig.targetScore) {
        this.reachedThreeStars = true;
        this.particles.emitStarburst(480, 140, '#ffd166', 32);
        this.particles.emitFloatingText(480, 150, '⭐⭐⭐ ĐẠT 3 SAO! Có thể bấm "Qua màn"!', '#ffd166', 22);
        this.cats.say('both', 'ĐẠT 3 SAO RỒI!! Bấm nút "Qua màn" góc trên hoặc bán thêm kiếm tiền nha! 🎉⭐', 5.0);
      } else if (this.combo >= 3) {
        this.cats.say('both', `COMBO x${this.combo}!! Quán đông nghẹt khách khen nức nở! 🔥⭐`, 4.2);
      } else if (avgScore >= 85) {
        this.cats.say('boss', `Quá xuất sắc! Khách thưởng đậm +${formatMoney(earned)}! 👑`, 4.0);
      } else {
        this.cats.say('golden', `Đã bưng ${dish.recipe.name} ra cho khách! +${formatMoney(earned)}! 🍜`, 3.8);
      }

      const perfectTag = avgScore >= 85 ? ' ⭐ PERFECT!' : '';
      this.showFeedback(`💰 +${formatMoney(earned)}${perfectTag} Combo x${this.combo}`, '#4CAF50');

      this.tutorial.onFirstCustomerServed();
    } else {
      // No matching customer — wasted dish
      this.showFeedback(`😢 Không có khách đặt ${dish.recipe.name}!`, '#E63946');
      this.particles.emitAngryPuff(480, 260);
      this.particles.shake(5, 0.2);
      this.cats.say('boss', `Nấu nhầm món rồi! Chưa có khách gọi ${dish.recipe.name}! 😿`, 3.6);
      this.combo = 0;
    }

    this.activeDish = null;
  }

  private spawnCustomer(): boolean {
    if (this.customers.filter((c) => !c.leaving).length >= this.levelConfig.maxCustomers) return false;
    if (this.recipes.length === 0) return false;

    const recipe = randPick(this.recipes);
    const taste = generateCustomerTaste(recipe);
    const slot = this.getNextCustomerSlot();
    const patience = randFloat(34, 46); // generous patience for tactile minigames!
    const pool =
      this.levelConfig.customerTypes && this.levelConfig.customerTypes.length > 0
        ? this.levelConfig.customerTypes
        : Object.values(CustomerType);
    const customerType = randPick(pool);

    const customer: InlineCustomer = {
      id: this.nextCustomerId++,
      customerType,
      x: 960 + 80, // start offscreen
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
      orderBubbleAlpha: 0,
    };

    this.customers.push(customer);
    if (!this.activeMinigame) {
      this.cats.say('golden', `Khách mới gọi ${formatTasteSpeech(recipe, taste)}`, 4.5);
    }
    return true;
  }

  private getNextCustomerSlot(): { x: number; y: number } {
    // 5 neat slots across the left/center counter leaving right Cat Booth clear!
    const slots = [34, 178, 322, 466, 610];
    const occupied = new Set(
      this.customers.filter((c) => !c.leaving).map((c) => c.targetX),
    );
    for (const sx of slots) {
      if (!occupied.has(sx)) {
        return { x: sx, y: 80 };
      }
    }
    return { x: clamp(34 + occupied.size * 144, 34, 610), y: 80 };
  }

  private showFeedback(text: string, color: string): void {
    this.feedbackText = text;
    this.feedbackTimer = 2.0;
    this.feedbackColor = color;
  }

  update(dt: number): void {
    if (this.gameOver || this.paused) return;

    // Always animate Cat NPC tutorial, Live Cat Companion & Particles!
    this.tutorial.update(dt);
    this.cats.update(dt);
    this.particles.update(dt);

    // Ambient kitchen atmosphere: hot station steam & warm golden lantern fireflies!
    if (!this.activeMinigame) {
      if (Math.random() < dt * 4.5) {
        this.particles.emitLanternDust(randFloat(40, 920), randFloat(68, 165));
      }
      for (const st of this.stations) {
        if (
          (st.type === StationType.BROTH ||
            st.type === StationType.NOODLE ||
            st.type === StationType.GRILL ||
            st.type === StationType.WOK) &&
          Math.random() < dt * 2.2
        ) {
          this.particles.emitSteam(st.x + st.width / 2, st.y + 18, 1);
        }
      }
    }

    // Pause gameplay timers & spawning while visual-novel intro/celebration modal is open
    if (this.tutorial.isModalBlocking) return;

    // Update active cooking minigame
    if (this.activeMinigame) {
      this.activeMinigame.update(dt);
      if (this.activeMinigame.done) {
        this.completeActiveMinigame();
      }
    }

    // Gentle 45% speed during minigames so 60-85s rounds feel brisk and fair
    const worldDt = this.activeMinigame ? dt * 0.45 : dt;

    // Level timer (frozen during initial guided prompts so player can read safely)
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
      this.spawnTimer = spawned ? this.levelConfig.customerSpawnRate : 1000;
    }

    // Update station done cooldowns
    for (const station of this.stations) {
      if (station.state === 'done') {
        station.cookTimer += dt;
        if (station.cookTimer >= 0) {
          station.state = 'idle';
          station.cookTimer = 0;
        }
      }
    }

    // Update customers
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];

      // Slide in
      if (c.x > c.targetX) {
        c.x = Math.max(c.targetX, c.x - 400 * dt);
      }
      if (c.orderBubbleAlpha < 1 && !c.leaving) {
        c.orderBubbleAlpha = Math.min(1, c.orderBubbleAlpha + 2 * dt);
      }

      if (c.leaving) {
        c.x += 500 * dt;
        c.orderBubbleAlpha = Math.max(0, c.orderBubbleAlpha - 3 * dt);
        if (c.x > 1050) {
          this.customers.splice(i, 1);
        }
        continue;
      }

      // Only start patience countdown once customer arrives (and pause during initial tutorial prompts)
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
          this.cats.say('golden', `Á á khách gọi ${c.order.name} sắp hết kiên nhẫn rồi!! Nhanh tay lên!! 💦`, 3.5);
        }
      }

      if (c.patience <= 0) {
        c.leaving = true;
        c.mood = CustomerMood.ANGRY;
        this.combo = 0;
        this.showFeedback('😡 Khách bỏ đi!', '#E63946');
        this.particles.emitAngryPuff(c.x + c.width / 2, c.y + 24);
        this.particles.shake(5, 0.2);
        this.cats.say('boss', 'Khách đợi lâu quá bỏ đi mất rồi! Lần sau tăng tốc lên nhé! 😾', 3.5);
      }
    }

    // Feedback timer
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
    }

    // Station flash
    if (this.stationFlashTimer > 0) {
      this.stationFlashTimer -= dt;
    }
  }

  private endGame(): void {
    this.gameOver = true;

    // Calculate stars
    const stars = this.money >= this.levelConfig.targetScore ? 3
      : this.money >= this.levelConfig.minScore ? 2
      : this.money > 0 ? 1
      : 0;

    // Save progress
    this.engine.save.setLevelStars(this.levelId, stars);
    this.engine.save.addMoney(this.money);
    this.engine.save.updateStats({
      totalCustomersServed:
        this.engine.save.current.stats.totalCustomersServed + this.customersServed,
      totalMoneyEarned:
        this.engine.save.current.stats.totalMoneyEarned + this.money,
    });

    // Advance currentLevel if needed
    if (this.levelId >= this.engine.save.current.currentLevel && stars > 0) {
      this.engine.save.update({ currentLevel: this.levelId + 1 });
    }

    // Transition to ResultScene
    this.engine.scenes.replace(
      new ResultScene(this.engine, {
        levelId: this.levelId,
        dayName: this.levelConfig.dayName,
        customersServed: this.customersServed,
        moneyEarned: this.money,
        stars,
        maxCombo: this.maxCombo,
        targetScore: this.levelConfig.targetScore,
      }),
    );
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // --- Pixel art Sài Gòn stall background ---
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_saigon')) {
      ctx.drawImage(this.engine.assets.getImage('bg_saigon'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#1E1E2E';
      ctx.fillRect(0, 0, W, H);

      const floorGrad = ctx.createLinearGradient(0, 350, 0, H);
      floorGrad.addColorStop(0, '#2A2A3E');
      floorGrad.addColorStop(1, '#1A1A28');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 350, W, H - 350);
    }

    // --- Top bar ---
    this.renderTopBar(ctx, W);

    // --- Customers ---
    this.renderCustomers(ctx);

    // --- Live Interactive Cat Kitchen Booth (Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp) ---
    if (!this.tutorial.isActive && !this.activeMinigame) {
      this.cats.render(ctx);
    }

    // --- Stations ---
    this.renderStations(ctx);

    // --- Active dish progress ---
    this.renderDishProgress(ctx, W);

    // --- Recipe cards ---
    this.renderRecipeCards(ctx);

    // --- Feedback ---
    if (this.feedbackTimer > 0 && !this.activeMinigame) {
      const alpha = Math.min(1, this.feedbackTimer);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = this.feedbackColor;
      ctx.globalAlpha = alpha;
      ctx.fillText(this.feedbackText, W / 2, 194);
      ctx.restore();
    }

    // --- Interactive Cooking Minigame Modal ---
    if (this.activeMinigame) {
      this.activeMinigame.render(ctx);
    }

    // --- 60fps Particle FX Layer (renders crisp above kitchen & minigame board!) ---
    this.particles.render(ctx);

    // --- 2-Cat NPC Tutorial Overlay (hidden briefly while playing a minigame) ---
    if (this.tutorial.isActive && !this.activeMinigame) {
      this.tutorial.render(ctx, W, H, this.getTutorialTarget());
    }

    ctx.restore(); // end camera shake transform

    // --- Pause overlay ---
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '⏸ TẠM DỪNG', W / 2, H / 2 - 40, '#FCA311');

      // Resume button
      roundRect(ctx, this.resumeBtn.x, this.resumeBtn.y, this.resumeBtn.width, this.resumeBtn.height, 10);
      ctx.fillStyle = '#4CAF50';
      ctx.fill();
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '▶ Tiếp tục', this.resumeBtn.x + this.resumeBtn.width / 2, this.resumeBtn.y + this.resumeBtn.height / 2);

      // Back to map button
      roundRect(ctx, this.exitMapBtn.x, this.exitMapBtn.y, this.exitMapBtn.width, this.exitMapBtn.height, 10);
      ctx.fillStyle = '#E63946';
      ctx.fill();
      drawTextShadow(ctx, '🗺 Bản đồ', this.exitMapBtn.x + this.exitMapBtn.width / 2, this.exitMapBtn.y + this.exitMapBtn.height / 2);
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, W: number): void {
    // Bar background
    roundRect(ctx, 0, 0, W, 50, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    ctx.textBaseline = 'middle';

    // Money + Live Star Goal Progress Bar
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px monospace';
    drawTextShadow(
      ctx,
      `💰 ${formatMoney(this.money)}/${formatMoney(this.levelConfig.targetScore)}`,
      14,
      19,
      '#4CAF50',
    );

    const progress = Math.min(1, this.money / Math.max(1, this.levelConfig.targetScore));
    const currentStars =
      this.money >= this.levelConfig.targetScore ? 3
      : this.money >= this.levelConfig.minScore ? 2
      : this.money > 0 ? 1
      : 0;
    drawProgressBar(ctx, 16, 33, 158, 9, progress, currentStars >= 3 ? '#ffd166' : '#4CAF50');

    ctx.font = '13px "Segoe UI"';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('⭐'.repeat(currentStars) + '☆'.repeat(3 - currentStars), 182, 26);

    // Day name (shifted gently left of center if early finish button is visible)
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.levelConfig.dayName,
      this.reachedThreeStars ? 420 : W / 2 - 10,
      26,
      '#FCA311',
    );

    // Glowing "⏭ Qua màn" button once 3 stars are reached!
    if (this.reachedThreeStars && !this.activeMinigame) {
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
    const timeColor = this.timeRemaining < 10 ? '#E63946' : this.timeRemaining < 30 ? '#FCA311' : '#fff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    const timerRightX = supportsFullscreen() ? W - 138 : W - 76;
    drawTextShadow(ctx, `⏱ ${formatTime(this.timeRemaining)}`, timerRightX, 26, timeColor);

    // Fullscreen toggle button (for mobile landscape play)
    if (supportsFullscreen()) {
      roundRect(ctx, this.fullscreenBtn.x, this.fullscreenBtn.y, this.fullscreenBtn.width, this.fullscreenBtn.height, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '18px "Segoe UI"';
      ctx.fillStyle = '#fff';
      ctx.fillText('⛶', this.fullscreenBtn.x + this.fullscreenBtn.width / 2, this.fullscreenBtn.y + this.fullscreenBtn.height / 2);
    }

    // Pause button
    roundRect(ctx, this.pauseBtn.x, this.pauseBtn.y, this.pauseBtn.width, this.pauseBtn.height, 8);
    ctx.fillStyle = this.paused ? '#E85D04' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '20px "Segoe UI"';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.paused ? '▶' : '⏸', this.pauseBtn.x + this.pauseBtn.width / 2, this.pauseBtn.y + this.pauseBtn.height / 2);
  }

  private getTutorialTarget(): TutorialTarget | null {
    const stage = this.tutorial.currentStage;
    if (stage === 'pick_recipe') {
      const card = this.recipeCards[0];
      return card ? { rect: card.rect } : null;
    }
    if (stage === 'tap_first_station' || stage === 'finish_steps') {
      const nextStep = this.activeDish?.steps[this.activeDish.currentStepIndex];
      if (!nextStep) return null;
      const st = this.stations.find((s) => s.type === nextStep.stationType);
      if (st && st.state !== 'cooking') {
        return { rect: { x: st.x, y: st.y, width: st.width, height: st.height } };
      }
    }
    return null;
  }

  private renderCustomers(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    for (const c of this.customers) {
      ctx.save();

      // Gentle walking bounce while approaching or leaving
      const isMoving = c.x > c.targetX + 1 || c.leaving;
      const bounceY = isMoving ? Math.abs(Math.sin(c.x * 0.08)) * -5 : 0;
      const drawY = c.y + bounceY;

      // Ground/counter shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(c.x + c.width / 2, c.y + c.height + 2, c.width / 2.6, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pixel art customer character sprite
      const spriteKey = `customer_${c.customerType.toLowerCase()}`;
      if (this.engine.assets.hasImage(spriteKey)) {
        ctx.drawImage(
          this.engine.assets.getImage(spriteKey),
          c.x,
          drawY,
          c.width,
          c.height,
        );
      } else {
        const bodyColor =
          c.mood === CustomerMood.HAPPY ? '#4CAF50'
          : c.mood === CustomerMood.NEUTRAL ? '#FFC107'
          : '#E63946';
        roundRect(ctx, c.x, drawY + 25, c.width, c.height - 25, 8);
        ctx.fillStyle = bodyColor;
        ctx.fill();
      }

      // Small mood badge at top-left of customer
      const faceEmoji =
        c.mood === CustomerMood.HAPPY ? '😊'
        : c.mood === CustomerMood.NEUTRAL ? '😐'
        : '😡';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px "Segoe UI"';
      ctx.fillText(faceEmoji, c.x + 8, drawY + 12);

      // Patience bar right on the wooden counter ledge
      if (!c.served && !c.leaving) {
        const ratio = c.patience / c.maxPatience;
        const barColor = ratio > 0.5 ? '#4CAF50' : ratio > 0.2 ? '#FFC107' : '#E63946';
        drawProgressBar(ctx, c.x + 2, c.y + c.height + 5, c.width - 4, 7, ratio, barColor);
      }

      // Order speech bubble with pixel-art dish sprite + custom customer taste badges!
      if (!c.served && c.orderBubbleAlpha > 0) {
        ctx.globalAlpha = c.orderBubbleAlpha;
        const bx = c.x + c.width - 4;
        const by = c.y - 10;
        const bw = 78;
        const bh = 82;

        // Bubble
        roundRect(ctx, bx, by, bw, bh, 10);
        ctx.fillStyle = '#fffcf5';
        ctx.fill();
        ctx.strokeStyle = '#3d281c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tail pointing to customer
        ctx.beginPath();
        ctx.moveTo(bx, by + bh / 2 - 4);
        ctx.lineTo(bx - 8, by + bh / 2 + 2);
        ctx.lineTo(bx, by + bh / 2 + 8);
        ctx.fillStyle = '#fffcf5';
        ctx.fill();

        // Pixel art dish icon inside bubble
        const foodKey = `food_${c.order.id}`;
        if (this.engine.assets.hasImage(foodKey)) {
          ctx.drawImage(
            this.engine.assets.getImage(foodKey),
            bx + (bw - 42) / 2,
            by + 2,
            42,
            42,
          );
        }

        // Order name below icon
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#2b1c17';
        const shortName = c.order.name.length > 11 ? `${c.order.name.slice(0, 10)}…` : c.order.name;
        ctx.fillText(shortName, bx + bw / 2, by + 52);

        // Customer custom taste preference badges (e.g. "+🌶️ +🥖 🚫🌿")
        ctx.font = '10px "Segoe UI"';
        ctx.fillStyle = '#b5561d';
        ctx.fillText(c.taste.summaryBadges.join(' '), bx + bw / 2, by + 70);

        ctx.globalAlpha = 1;
      }

      // Served check
      if (c.served) {
        ctx.font = '28px "Segoe UI"';
        ctx.fillText('✅', c.x + c.width / 2, drawY - 4);
      }

      ctx.restore();
    }
  }

  private renderStations(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < this.stations.length; i++) {
      const st = this.stations[i];
      const isExpected =
        this.activeDish &&
        !this.activeDish.completed &&
        this.activeDish.steps[this.activeDish.currentStepIndex]?.stationType === st.type;

      // Flash highlight
      const flash =
        this.stationFlashIndex === i && this.stationFlashTimer > 0
          ? 0.3 + 0.3 * Math.sin(this.stationFlashTimer * 12)
          : 0;

      ctx.save();

      // Wooden counter pad beneath station sprite
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      roundRect(ctx, st.x, st.y, st.width, st.height, 12);
      if (st.state === 'cooking') {
        ctx.fillStyle = 'rgba(232, 93, 4, 0.72)';
      } else if (st.state === 'done') {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.72)';
      } else if (isExpected) {
        ctx.fillStyle = 'rgba(252, 163, 17, 0.25)';
      } else {
        ctx.fillStyle = 'rgba(20, 14, 18, 0.55)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight border if expected next
      if (isExpected) {
        roundRect(ctx, st.x - 2, st.y - 2, st.width + 4, st.height + 4, 14);
        ctx.strokeStyle = `rgba(252, 163, 17, ${0.7 + flash})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        roundRect(ctx, st.x, st.y, st.width, st.height, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pixel art station sprite
      const spriteKey = `station_${st.type.toLowerCase()}`;
      const spriteSize = Math.min(st.width - 14, 72);
      if (this.engine.assets.hasImage(spriteKey)) {
        const wobble = st.state === 'cooking' ? Math.sin(st.cookTimer * 24) * 2 : 0;
        ctx.drawImage(
          this.engine.assets.getImage(spriteKey),
          st.x + (st.width - spriteSize) / 2 + wobble,
          st.y + 6,
          spriteSize,
          spriteSize,
        );
      }

      // Station label at bottom of pad
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      const labelText = st.label.replace(/^[^\s]+\s/, ''); // clean Vietnamese name
      drawTextShadow(ctx, labelText, st.x + st.width / 2, st.y + st.height - 13, '#fff');

      // State indicator overlays
      if (st.state === 'cooking') {
        const progress = st.cookTimer / st.cookDuration;
        drawProgressBar(
          ctx,
          st.x + 8,
          st.y + st.height - 32,
          st.width - 16,
          10,
          progress,
          '#FCA311',
        );
        ctx.font = '18px "Segoe UI"';
        ctx.fillText('🔥', st.x + st.width - 14, st.y + 16);
      } else if (st.state === 'done') {
        ctx.font = '22px "Segoe UI"';
        ctx.fillText('✅', st.x + st.width - 14, st.y + 18);
      }

      ctx.restore();
    }
  }

  private renderDishProgress(ctx: CanvasRenderingContext2D, W: number): void {
    if (!this.activeDish) return;

    const dish = this.activeDish;
    const y = 352;

    // Progress strip background
    roundRect(ctx, 20, y, W - 40, 44, 8);
    ctx.fillStyle = 'rgba(15, 12, 22, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pixel art dish icon on progress strip
    ctx.imageSmoothingEnabled = false;
    const dishSpriteKey = `food_${dish.recipe.id}`;
    if (this.engine.assets.hasImage(dishSpriteKey)) {
      ctx.drawImage(this.engine.assets.getImage(dishSpriteKey), 28, y + 4, 36, 36);
    }

    // Recipe name
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, dish.recipe.name, 70, y + 22, '#FCA311');

    // Step dots
    const dotStartX = 220;
    const dotGap = 48;
    for (let i = 0; i < dish.steps.length; i++) {
      const dx = dotStartX + i * dotGap;
      const dy = y + 22;
      const r = 10;

      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);

      if (i < dish.currentStepIndex) {
        ctx.fillStyle = '#4CAF50';
      } else if (i === dish.currentStepIndex) {
        ctx.fillStyle = '#FCA311';
      } else {
        ctx.fillStyle = '#555';
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Step number
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${i + 1}`, dx, dy + 1);

      // Connection line
      if (i < dish.steps.length - 1) {
        ctx.beginPath();
        ctx.moveTo(dx + r + 2, dy);
        ctx.lineTo(dx + dotGap - r - 2, dy);
        ctx.strokeStyle = i < dish.currentStepIndex ? '#4CAF50' : '#444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Current step label
    if (!dish.completed) {
      const step = dish.steps[dish.currentStepIndex];
      ctx.textAlign = 'right';
      ctx.font = '13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(
        ctx,
        `→ ${step.action} (${STATION_LABELS[step.stationType]})`,
        this.cancelDishBtn.x - 12,
        y + 22,
        '#FCA311',
      );
    }

    // Cancel dish button
    roundRect(ctx, this.cancelDishBtn.x, this.cancelDishBtn.y, this.cancelDishBtn.width, this.cancelDishBtn.height, 6);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('🗑 Hủy', this.cancelDishBtn.x + this.cancelDishBtn.width / 2, this.cancelDishBtn.y + this.cancelDishBtn.height / 2);
  }

  private renderRecipeCards(ctx: CanvasRenderingContext2D): void {
    // Label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(
      this.activeDish ? '(Đang nấu — hoàn thành món trước khi bắt đầu món mới)' : 'Chọn món để nấu:',
      480,
      405,
    );

    for (const card of this.recipeCards) {
      const { recipe, rect } = card;
      const pointer = this.engine.input.pointer;
      const hover = InputManager.hitTest(pointer, rect);
      const disabled = !!this.activeDish;

      ctx.save();

      if (disabled) ctx.globalAlpha = 0.4;

      // Card background
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      ctx.fillStyle = hover && !disabled ? this.darkenColor(recipe.color, 0.15) : 'rgba(38, 32, 52, 0.92)';
      ctx.fill();

      ctx.shadowBlur = 0;

      // Border accented with recipe color
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      ctx.strokeStyle = hover && !disabled ? '#FCA311' : recipe.color;
      ctx.lineWidth = hover && !disabled ? 2 : 1.5;
      ctx.stroke();

      // Pixel art food sprite centered on top half of card
      ctx.imageSmoothingEnabled = false;
      const foodKey = `food_${recipe.id}`;
      if (this.engine.assets.hasImage(foodKey)) {
        ctx.drawImage(
          this.engine.assets.getImage(foodKey),
          rect.x + (rect.width - 52) / 2,
          rect.y + 4,
          52,
          52,
        );
      }

      // Recipe name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, recipe.name, rect.x + rect.width / 2, rect.y + 66);

      // Price & step count row
      ctx.font = 'bold 12px monospace';
      drawTextShadow(
        ctx,
        `${formatMoney(recipe.basePrice)} • ${recipe.steps.length} bước`,
        rect.x + rect.width / 2,
        rect.y + 86,
        '#4CAF50',
      );

      ctx.restore();
    }
  }

  private darkenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - amount))}, ${Math.floor(g * (1 - amount))}, ${Math.floor(b * (1 - amount))})`;
  }
}
