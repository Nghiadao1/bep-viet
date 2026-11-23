// ============================================================
// ScoreSystem — Tracks money, combos, reputation
// ============================================================

export interface LevelResult {
  money: number;
  stars: 0 | 1 | 2 | 3;
  served: number;
  perfect: number;
}

export class ScoreSystem {
  money = 0;
  served = 0;
  perfect = 0;         // dishes with quality ≥ 0.9
  comboCounter = 0;
  comboMultiplier = 1;
  reputation = 0;

  private lastServeTime = 0;
  private readonly COMBO_WINDOW_MS = 8_000; // serve within 8s to keep combo

  /** Call when a dish is successfully served. */
  onDishServed(quality: number, tips: number, combo: boolean): void {
    // Update combo
    const now = Date.now();
    if (combo && now - this.lastServeTime <= this.COMBO_WINDOW_MS) {
      this.comboCounter++;
      this.comboMultiplier = 1 + this.comboCounter * 0.25; // +25% per combo
    } else {
      this.comboCounter = 0;
      this.comboMultiplier = 1;
    }
    this.lastServeTime = now;

    // Calculate earnings
    const earned = Math.round(tips * this.comboMultiplier);
    this.money += earned;

    // Track stats
    this.served++;
    if (quality >= 0.9) this.perfect++;

    // Reputation: good service adds, bad subtracts
    if (quality >= 0.7) {
      this.reputation += 1;
    } else if (quality < 0.4) {
      this.reputation = Math.max(0, this.reputation - 1);
    }
  }

  /** Get the final level result summary. */
  getLevelResult(): LevelResult {
    return {
      money: this.money,
      stars: this.calculateStars(this.money, 0, 0), // caller sets targets
      served: this.served,
      perfect: this.perfect,
    };
  }

  /**
   * Calculate star rating (0-3) for a level.
   * - 0 stars: score < min
   * - 1 star:  score ≥ min
   * - 2 stars: score ≥ target * 0.75
   * - 3 stars: score ≥ target
   */
  calculateStars(score: number, target: number, min: number): 0 | 1 | 2 | 3 {
    if (score < min) return 0;
    if (score >= target) return 3;
    if (score >= target * 0.75) return 2;
    return 1;
  }

  /** Reset for a new level. */
  reset(): void {
    this.money = 0;
    this.served = 0;
    this.perfect = 0;
    this.comboCounter = 0;
    this.comboMultiplier = 1;
    this.reputation = 0;
    this.lastServeTime = 0;
  }
}
