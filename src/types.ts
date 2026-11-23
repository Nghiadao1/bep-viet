// ============================================================
// Bếp Việt — Shared Type Definitions
// ============================================================

// --- Enums ---

export enum StationType {
  BROTH = 'BROTH',       // Nồi nước dùng
  NOODLE = 'NOODLE',     // Bánh phở / mì / bún
  MEAT = 'MEAT',         // Thịt
  VEGGIE = 'VEGGIE',     // Rau, giá, hành
  SAUCE = 'SAUCE',       // Gia vị, nước chấm
  BREAD = 'BREAD',       // Bánh mì
  GRILL = 'GRILL',       // Nướng
  WOK = 'WOK',           // Xào
  DRINK = 'DRINK',       // Đồ uống
  DESSERT = 'DESSERT',   // Chè, tráng miệng
}

export enum CustomerType {
  OFFICE_WORKER = 'OFFICE_WORKER',
  ELDERLY = 'ELDERLY',
  FAMILY = 'FAMILY',
  SHIPPER = 'SHIPPER',
  TOURIST = 'TOURIST',
  FOOD_BLOGGER = 'FOOD_BLOGGER',
}

export enum CustomerMood {
  HAPPY = 'HAPPY',
  NEUTRAL = 'NEUTRAL',
  ANGRY = 'ANGRY',
}

export enum GameState {
  LOADING = 'LOADING',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RESULT = 'RESULT',
  SHOP = 'SHOP',
  MAP = 'MAP',
}

// --- Cooking ---

export interface CookingStep {
  stationType: StationType;
  action: string;
  duration: number;       // ms
  ingredient: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  nameEn: string;
  chapter: number;
  unlockLevel: number;
  basePrice: number;
  steps: CookingStep[];
  story: string;
  spriteKey: string;
  color: string;          // Representative color for UI
}

// --- Level ---

export type LevelMissionType = 'classic' | 'rush' | 'picky' | 'vip_critic';

export interface LevelConfig {
  id: number;
  chapter: number;
  dayName: string;
  targetScore: number;
  minScore: number;
  timeLimit: number;          // seconds
  targetCustomers?: number;   // customer wave quota — instant win when served!
  missionType?: LevelMissionType;
  rewardBonus?: number;       // bonus coins chest on clear
  introBoss?: string;         // Vằn Bếp Trưởng pre-level story line
  introGolden?: string;       // Mèo Vàng Phụ Bếp pre-level story line
  availableRecipes: string[];
  customerSpawnRate: number;  // ms between spawns
  maxCustomers: number;
  customerTypes: CustomerType[];
  specialEvents?: string[];
}

// --- Customer ---

export interface CustomerConfig {
  type: CustomerType;
  name: string;
  patience: number;       // ms
  tipMultiplier: number;
  orderSize: [number, number]; // [min, max]
  sprite: string;
  speechBubbles: string[];
}

// --- Upgrade ---

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'kitchen' | 'restaurant' | 'staff' | 'ingredient';
  cost: number;
  effect: UpgradeEffect;
  icon: string;
  maxLevel: number;
  requires?: string[];    // prerequisite upgrade IDs
}

export interface UpgradeEffect {
  cookSpeedMultiplier?: number;
  maxCustomers?: number;
  tipMultiplier?: number;
  satisfactionBonus?: number;
  autoCompleteSteps?: number;
  unlockStation?: StationType;
}

// --- Save ---

export interface SaveData {
  version: number;
  currentLevel: number;
  currentChapter: number;
  money: number;
  reputation: number;
  levelStars: Record<number, number>;
  upgrades: Record<string, number>; // upgrade ID → level
  unlockedRecipes: string[];
  tutorialCompleted: boolean;
  seenChapters: number[];
  settings: GameSettings;
  stats: PlayerStats;
}

export interface GameSettings {
  musicVolume: number;    // 0-1
  sfxVolume: number;      // 0-1
  language: 'vi' | 'en';
}

export interface PlayerStats {
  totalCustomersServed: number;
  totalMoneyEarned: number;
  perfectDishes: number;
  playTimeSeconds: number;
  bestCombo: number;
}

// --- Scene ---

export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onResize?(width: number, height: number): void;
}

// --- Geometry & UI ---

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sprite {
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// --- Events ---

export type GameEventType =
  | 'dish_complete'
  | 'dish_failed'
  | 'order_fulfilled'
  | 'order_expired'
  | 'customer_served'
  | 'customer_left'
  | 'level_complete'
  | 'level_failed'
  | 'upgrade_bought'
  | 'recipe_unlocked'
  | 'chapter_unlocked';

export interface GameEvent {
  type: GameEventType;
  data?: unknown;
}

export type EventCallback = (event: GameEvent) => void;
