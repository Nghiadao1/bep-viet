// ============================================================
// CookingSystem — Manages stations and dish preparation
// ============================================================

import type { StationType, Vec2, Recipe } from '../types';
import { Station } from '../entities/Station';
import { Dish } from '../entities/Dish';
import { events } from '../core/EventBus';

export class CookingSystem {
  stations: Station[] = [];
  activeDish: Dish | null = null;
  private cookSpeedMultiplier = 1;

  /** Set a global cook speed multiplier (from upgrades). < 1 = faster. */
  setSpeedMultiplier(m: number): void {
    this.cookSpeedMultiplier = m;
  }

  /** Add a station to the kitchen at the given position. */
  addStation(type: StationType, x: number, y: number): Station {
    const station = new Station(type, x, y);
    this.stations.push(station);
    return station;
  }

  /** Start preparing a new dish from a recipe. */
  startDish(recipe: Recipe): void {
    this.activeDish = new Dish(recipe);
  }

  /**
   * Handle a click at `pos` (game coords).
   * Returns true if the click was consumed by a station interaction.
   */
  clickStation(pos: Vec2): boolean {
    if (!this.activeDish) return false;

    for (const station of this.stations) {
      const r = station.getRect();
      if (
        pos.x >= r.x && pos.x <= r.x + r.width &&
        pos.y >= r.y && pos.y <= r.y + r.height
      ) {
        // --- Collect finished result ---
        if (station.state === 'done') {
          const step = station.collectResult();
          if (step && this.activeDish.canAddStep(step)) {
            this.activeDish.addStep(step);

            // Update quality based on elapsed time
            const elapsed = Date.now() - this.activeDish.startTime;
            this.activeDish.quality = this.activeDish.calculateQuality(elapsed);

            // Check completion
            if (this.activeDish.isComplete()) {
              events.emit('dish_complete', { dish: this.activeDish });
              this.activeDish = null;
            }
          }
          return true;
        }

        // --- Start cooking if station matches next step ---
        if (station.isAvailable() && this.activeDish) {
          const nextIndex = this.activeDish.completedSteps.length;
          if (nextIndex < this.activeDish.recipe.steps.length) {
            const nextStep = this.activeDish.recipe.steps[nextIndex];
            if (nextStep.stationType === station.type) {
              station.startCooking(nextStep, this.cookSpeedMultiplier);
              return true;
            }
          }
        }

        return true; // click was on a station even if no action taken
      }
    }

    return false;
  }

  /** Update all stations. dt in ms. */
  update(dt: number): void {
    for (const station of this.stations) {
      station.update(dt);
    }
  }

  /** Render all stations and the active dish indicator. */
  render(ctx: CanvasRenderingContext2D): void {
    for (const station of this.stations) {
      station.render(ctx);
    }

    // Show active dish card in top-left corner
    if (this.activeDish) {
      this.activeDish.render(ctx, 10, 10);
    }
  }
}
