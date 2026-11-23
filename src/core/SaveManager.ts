// ============================================================
// SaveManager — LocalStorage persistence with version migration
// ============================================================

import type { SaveData } from '../types';

const SAVE_KEY = 'bep-viet-save';
const CURRENT_VERSION = 1;

function createDefaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    currentLevel: 1,
    currentChapter: 1,
    money: 0,
    reputation: 0,
    levelStars: {},
    upgrades: {},
    unlockedRecipes: ['pho_bo'],
    tutorialCompleted: false,
    seenChapters: [],
    settings: {
      musicVolume: 0.5,
      sfxVolume: 0.7,
      language: 'vi',
    },
    stats: {
      totalCustomersServed: 0,
      totalMoneyEarned: 0,
      perfectDishes: 0,
      playTimeSeconds: 0,
      bestCombo: 0,
    },
  };
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.loadFromStorage();
  }

  /** Get current save data (read-only clone) */
  get current(): Readonly<SaveData> {
    return this.data;
  }

  /** Update save data and persist */
  update(partial: Partial<SaveData>): void {
    Object.assign(this.data, partial);
    this.persist();
  }

  /** Update nested stats */
  updateStats(stats: Partial<SaveData['stats']>): void {
    Object.assign(this.data.stats, stats);
    this.persist();
  }

  /** Update settings */
  updateSettings(settings: Partial<SaveData['settings']>): void {
    Object.assign(this.data.settings, settings);
    this.persist();
  }

  /** Record stars for a level (keeps best) */
  setLevelStars(levelId: number, stars: number): void {
    const current = this.data.levelStars[levelId] ?? 0;
    if (stars > current) {
      this.data.levelStars[levelId] = stars;
      this.persist();
    }
  }

  /** Add money */
  addMoney(amount: number): void {
    this.data.money += amount;
    this.persist();
  }

  /** Spend money (returns false if insufficient) */
  spendMoney(amount: number): boolean {
    if (this.data.money < amount) return false;
    this.data.money -= amount;
    this.persist();
    return true;
  }

  /** Unlock a recipe */
  unlockRecipe(recipeId: string): void {
    if (!this.data.unlockedRecipes.includes(recipeId)) {
      this.data.unlockedRecipes.push(recipeId);
      this.persist();
    }
  }

  /** Buy an upgrade (increment level) */
  buyUpgrade(upgradeId: string): void {
    this.data.upgrades[upgradeId] = (this.data.upgrades[upgradeId] ?? 0) + 1;
    this.persist();
  }

  /** Get upgrade level */
  getUpgradeLevel(upgradeId: string): number {
    return this.data.upgrades[upgradeId] ?? 0;
  }

  /** Reset all save data */
  reset(): void {
    this.data = createDefaultSave();
    this.persist();
  }

  /** Export save as JSON string */
  export(): string {
    return JSON.stringify(this.data);
  }

  /** Import save from JSON string */
  import(json: string): boolean {
    try {
      const data = JSON.parse(json) as SaveData;
      if (data.version && data.currentLevel) {
        this.data = this.migrate(data);
        this.persist();
        return true;
      }
    } catch { /* invalid JSON */ }
    return false;
  }

  // --- Private ---

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      console.warn('Failed to save to localStorage');
    }
  }

  private loadFromStorage(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as SaveData;
        return this.migrate(data);
      }
    } catch {
      console.warn('Failed to load save data');
    }
    return createDefaultSave();
  }

  private migrate(data: SaveData): SaveData {
    // Future version migrations go here
    if (!data.version) {
      data.version = CURRENT_VERSION;
    }
    // Ensure all fields exist
    const defaults = createDefaultSave();
    return {
      ...defaults,
      ...data,
      settings: { ...defaults.settings, ...data.settings },
      stats: { ...defaults.stats, ...data.stats },
    };
  }
}
