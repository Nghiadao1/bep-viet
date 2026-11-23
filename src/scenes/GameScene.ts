// ============================================================
// GameScene — Main gameplay: cooking, customers, stations
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Recipe, LevelConfig, CookingStep } from '../types';
import { StationType, CustomerMood } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { formatMoney, formatTime, clamp, randFloat, randInt, randPick } from '../utils/math';
import { RECIPES, getRecipe } from '../data/recipes';
import { getLevel } from '../data/levels';
import { ResultScene } from './ResultScene';

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
  x: number;
  y: number;
  targetX: number;
  width: number;
  height: number;
  patience: number;
  maxPatience: number;
  order: Recipe;
  mood: CustomerMood;
  served: boolean;
  leaving: boolean;
  orderBubbleAlpha: number;
}

interface ActiveDish {
  recipe: Recipe;
  currentStepIndex: number;
  steps: CookingStep[];
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

  // UI rects
  private recipeCards: { recipe: Recipe; rect: Rect }[] = [];
  private pauseBtn: Rect = { x: 900, y: 10, width: 44, height: 36 };

  // Input
  private removeClick?: () => void;

  // Feedback
  private feedbackText = '';
  private feedbackTimer = 0;
  private feedbackColor = '#fff';

  // Flash
  private stationFlashTimer = 0;
  private stationFlashIndex = -1;

  constructor(engine: Engine, levelId: number) {
    this.engine = engine;
    this.levelId = levelId;
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
    this.customers = [];
    this.nextCustomerId = 0;
    this.spawnTimer = 2000; // first spawn after 2s

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

    // Create stations
    this.stations = [];
    const typesArr = Array.from(neededTypes);
    const stationW = 100;
    const stationH = 110;
    const stationGap = 16;
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

    // Build recipe cards
    this.recipeCards = [];
    const cardW = 140;
    const cardH = 100;
    const cardGap = 16;
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

    // Input
    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.gameOver) return;

      // Pause button
      if (InputManager.hitTest(pos, this.pauseBtn)) {
        this.paused = !this.paused;
        return;
      }

      if (this.paused) return;

      // Click recipe card → start new dish
      if (!this.activeDish) {
        for (const card of this.recipeCards) {
          if (InputManager.hitTest(pos, card.rect)) {
            this.startDish(card.recipe);
            return;
          }
        }
      }

      // Click station → cook current step
      if (this.activeDish && !this.activeDish.completed) {
        for (let i = 0; i < this.stations.length; i++) {
          const st = this.stations[i];
          const rect: Rect = { x: st.x, y: st.y, width: st.width, height: st.height };
          if (InputManager.hitTest(pos, rect)) {
            this.handleStationClick(i);
            return;
          }
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  private startDish(recipe: Recipe): void {
    this.activeDish = {
      recipe,
      currentStepIndex: 0,
      steps: [...recipe.steps],
      completed: false,
    };
    this.showFeedback(`🍳 ${recipe.name} — Bước 1: ${recipe.steps[0].action}`, '#FCA311');
  }

  private handleStationClick(stationIndex: number): void {
    const station = this.stations[stationIndex];
    const dish = this.activeDish;
    if (!dish || dish.completed) return;

    const currentStep = dish.steps[dish.currentStepIndex];

    // Check if this is the correct station
    if (station.type !== currentStep.stationType) {
      this.showFeedback(`❌ Sai trạm! Cần: ${STATION_LABELS[currentStep.stationType]}`, '#E63946');
      return;
    }

    // Check if station is busy
    if (station.state === 'cooking') {
      this.showFeedback('⏳ Đang nấu...', '#FCA311');
      return;
    }

    // Start cooking at this station
    station.state = 'cooking';
    station.cookTimer = 0;
    station.cookDuration = currentStep.duration / 1000; // convert ms to seconds
    station.currentStep = currentStep;

    this.showFeedback(`🔥 ${currentStep.action}...`, '#4CAF50');
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
    // Find matching customer
    let target: InlineCustomer | null = null;
    for (const c of this.customers) {
      if (!c.served && !c.leaving && c.order.id === dish.recipe.id) {
        target = c;
        break;
      }
    }

    if (target) {
      target.served = true;
      target.leaving = true;
      target.mood = CustomerMood.HAPPY;

      // Calculate earnings
      const patienceRatio = target.patience / target.maxPatience;
      const tipMultiplier = patienceRatio > 0.5 ? 1.5 : patienceRatio > 0.2 ? 1.0 : 0.7;
      const earned = Math.floor(dish.recipe.basePrice * tipMultiplier);

      this.money += earned;
      this.customersServed++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      this.showFeedback(`💰 +${formatMoney(earned)}! Combo x${this.combo}`, '#4CAF50');
    } else {
      // No matching customer — wasted dish
      this.showFeedback(`😢 Không có khách đặt ${dish.recipe.name}!`, '#E63946');
      this.combo = 0;
    }

    this.activeDish = null;
  }

  private spawnCustomer(): void {
    if (this.customers.filter((c) => !c.leaving).length >= this.levelConfig.maxCustomers) return;
    if (this.recipes.length === 0) return;

    const recipe = randPick(this.recipes);
    const slot = this.getNextCustomerSlot();

    const customer: InlineCustomer = {
      id: this.nextCustomerId++,
      x: 960 + 80, // start offscreen
      targetX: slot.x,
      y: slot.y,
      width: 70,
      height: 90,
      patience: randFloat(15, 25),
      maxPatience: randFloat(15, 25),
      order: recipe,
      mood: CustomerMood.HAPPY,
      served: false,
      leaving: false,
      orderBubbleAlpha: 0,
    };
    customer.maxPatience = customer.patience;

    this.customers.push(customer);
  }

  private getNextCustomerSlot(): { x: number; y: number } {
    const activeCustomers = this.customers.filter((c) => !c.leaving);
    const slotX = 80 + activeCustomers.length * 150;
    return { x: clamp(slotX, 80, 800), y: 80 };
  }

  private showFeedback(text: string, color: string): void {
    this.feedbackText = text;
    this.feedbackTimer = 2.0;
    this.feedbackColor = color;
  }

  update(dt: number): void {
    if (this.gameOver || this.paused) return;

    // Timer
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      return;
    }

    // Spawn customers
    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0) {
      this.spawnCustomer();
      this.spawnTimer = this.levelConfig.customerSpawnRate;
    }

    // Update stations
    for (const station of this.stations) {
      if (station.state === 'done') {
        // cookTimer is negative, counting up to 0
        station.cookTimer += dt;
        if (station.cookTimer >= 0) {
          station.state = 'idle';
          station.cookTimer = 0;
        }
      } else if (station.state === 'cooking') {
        station.cookTimer += dt;
        if (station.cookTimer >= station.cookDuration) {
          station.state = 'done';
          station.cookTimer = 0;
          // Auto-advance dish step
          if (
            this.activeDish &&
            station.currentStep &&
            station.type === this.activeDish.steps[this.activeDish.currentStepIndex]?.stationType
          ) {
            this.advanceDishStep();
          }
          station.currentStep = null;
          // Station will reset to idle after 0.3s via doneTimer
          station.cookTimer = -0.3; // reuse cookTimer as done countdown
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

      // Patience
      c.patience -= dt;
      const ratio = c.patience / c.maxPatience;
      if (ratio > 0.5) c.mood = CustomerMood.HAPPY;
      else if (ratio > 0.2) c.mood = CustomerMood.NEUTRAL;
      else c.mood = CustomerMood.ANGRY;

      if (c.patience <= 0) {
        c.leaving = true;
        c.mood = CustomerMood.ANGRY;
        this.combo = 0;
        this.showFeedback('😡 Khách bỏ đi!', '#E63946');
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

    // --- Background ---
    ctx.fillStyle = '#1E1E2E';
    ctx.fillRect(0, 0, W, H);

    // Floor
    const floorGrad = ctx.createLinearGradient(0, 350, 0, H);
    floorGrad.addColorStop(0, '#2A2A3E');
    floorGrad.addColorStop(1, '#1A1A28');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 350, W, H - 350);

    // --- Top bar ---
    this.renderTopBar(ctx, W);

    // --- Customers ---
    this.renderCustomers(ctx);

    // --- Stations ---
    this.renderStations(ctx);

    // --- Active dish progress ---
    this.renderDishProgress(ctx, W);

    // --- Recipe cards ---
    this.renderRecipeCards(ctx);

    // --- Feedback ---
    if (this.feedbackTimer > 0) {
      const alpha = Math.min(1, this.feedbackTimer);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = this.feedbackColor;
      ctx.globalAlpha = alpha;
      ctx.fillText(this.feedbackText, W / 2, 190);
      ctx.restore();
    }

    // --- Pause overlay ---
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '⏸ TẠM DỪNG', W / 2, H / 2 - 20, '#FCA311');
      ctx.font = '20px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, 'Nhấn ⏸ để tiếp tục', W / 2, H / 2 + 30, '#aaa');
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, W: number): void {
    // Bar background
    roundRect(ctx, 0, 0, W, 50, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    ctx.textBaseline = 'middle';

    // Money
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px monospace';
    drawTextShadow(ctx, `💰 ${formatMoney(this.money)}`, 16, 26, '#4CAF50');

    // Day name
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, this.levelConfig.dayName, W / 2, 26, '#FCA311');

    // Timer
    const timeColor = this.timeRemaining < 10 ? '#E63946' : this.timeRemaining < 30 ? '#FCA311' : '#fff';
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    drawTextShadow(ctx, `⏱ ${formatTime(this.timeRemaining)}`, W - 70, 26, timeColor);

    // Pause button
    roundRect(ctx, this.pauseBtn.x, this.pauseBtn.y, this.pauseBtn.width, this.pauseBtn.height, 6);
    ctx.fillStyle = this.paused ? '#E85D04' : 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '20px "Segoe UI"';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.paused ? '▶' : '⏸', this.pauseBtn.x + this.pauseBtn.width / 2, this.pauseBtn.y + this.pauseBtn.height / 2);
  }

  private renderCustomers(ctx: CanvasRenderingContext2D): void {
    for (const c of this.customers) {
      // Customer body
      const bodyColor =
        c.mood === CustomerMood.HAPPY ? '#4CAF50'
        : c.mood === CustomerMood.NEUTRAL ? '#FFC107'
        : '#E63946';

      ctx.save();

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(c.x + c.width / 2, c.y + c.height + 4, c.width / 2.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      roundRect(ctx, c.x, c.y + 25, c.width, c.height - 25, 8);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Head
      ctx.beginPath();
      ctx.arc(c.x + c.width / 2, c.y + 18, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#FFDAB9';
      ctx.fill();
      ctx.stroke();

      // Face (mood)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px "Segoe UI"';
      const faceEmoji =
        c.mood === CustomerMood.HAPPY ? '😊'
        : c.mood === CustomerMood.NEUTRAL ? '😐'
        : '😡';
      ctx.fillText(faceEmoji, c.x + c.width / 2, c.y + 18);

      // Patience bar
      if (!c.served && !c.leaving) {
        const ratio = c.patience / c.maxPatience;
        const barColor = ratio > 0.5 ? '#4CAF50' : ratio > 0.2 ? '#FFC107' : '#E63946';
        drawProgressBar(ctx, c.x, c.y + c.height + 8, c.width, 6, ratio, barColor);
      }

      // Order bubble
      if (!c.served && c.orderBubbleAlpha > 0) {
        ctx.globalAlpha = c.orderBubbleAlpha;
        const bx = c.x + c.width + 4;
        const by = c.y - 10;
        const bw = 65;
        const bh = 40;

        // Bubble
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tail
        ctx.beginPath();
        ctx.moveTo(bx, by + bh / 2);
        ctx.lineTo(bx - 8, by + bh / 2 + 5);
        ctx.lineTo(bx, by + bh / 2 + 10);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Order text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = c.order.color;
        ctx.fillText(c.order.name, bx + bw / 2, by + bh / 2);

        ctx.globalAlpha = 1;
      }

      // Served check
      if (c.served) {
        ctx.font = '28px "Segoe UI"';
        ctx.fillText('✅', c.x + c.width / 2, c.y - 5);
      }

      ctx.restore();
    }
  }

  private renderStations(ctx: CanvasRenderingContext2D): void {
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

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      roundRect(ctx, st.x, st.y, st.width, st.height, 10);

      // Determine fill
      if (st.state === 'cooking') {
        ctx.fillStyle = '#E85D04';
      } else if (st.state === 'done') {
        ctx.fillStyle = '#4CAF50';
      } else {
        ctx.fillStyle = st.color;
      }
      ctx.fill();

      ctx.shadowBlur = 0;

      // Highlight border if expected next
      if (isExpected) {
        roundRect(ctx, st.x - 2, st.y - 2, st.width + 4, st.height + 4, 12);
        ctx.strokeStyle = `rgba(252, 163, 17, ${0.6 + flash})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        roundRect(ctx, st.x, st.y, st.width, st.height, 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, st.label, st.x + st.width / 2, st.y + 24);

      // State indicator
      if (st.state === 'cooking') {
        // Cook progress bar
        const progress = st.cookTimer / st.cookDuration;
        drawProgressBar(
          ctx,
          st.x + 10,
          st.y + st.height - 30,
          st.width - 20,
          10,
          progress,
          '#FCA311',
        );

        // Action text
        ctx.font = '11px "Segoe UI"';
        ctx.fillStyle = '#fff';
        ctx.fillText(
          st.currentStep?.action ?? '...',
          st.x + st.width / 2,
          st.y + 50,
        );

        // Animated fire
        ctx.font = '20px "Segoe UI"';
        ctx.fillText('🔥', st.x + st.width / 2, st.y + st.height - 50);
      } else if (st.state === 'done') {
        ctx.font = '24px "Segoe UI"';
        ctx.fillText('✅', st.x + st.width / 2, st.y + st.height / 2 + 10);
      } else {
        // Idle icon
        ctx.font = '28px "Segoe UI"';
        ctx.fillText(
          st.label.split(' ')[0], // emoji only
          st.x + st.width / 2,
          st.y + st.height / 2 + 10,
        );
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
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Recipe name
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `🍳 ${dish.recipe.name}`, 32, y + 22, dish.recipe.color);

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
        W - 32,
        y + 22,
        '#FCA311',
      );
    }
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
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      ctx.fillStyle = hover && !disabled ? recipe.color : this.darkenColor(recipe.color, 0.3);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Border
      roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Recipe name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, recipe.name, rect.x + rect.width / 2, rect.y + 28);

      // English name
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(recipe.nameEn, rect.x + rect.width / 2, rect.y + 48);

      // Price
      ctx.font = 'bold 14px monospace';
      drawTextShadow(ctx, `${formatMoney(recipe.basePrice)}`, rect.x + rect.width / 2, rect.y + 70, '#4CAF50');

      // Steps count
      ctx.font = '10px "Segoe UI"';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`${recipe.steps.length} bước`, rect.x + rect.width / 2, rect.y + 88);

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
