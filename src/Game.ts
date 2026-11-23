// ============================================================
// Game — Main game controller & pixel art sprite manifest
// ============================================================

import { Engine } from './core/Engine';
import { CustomerType, StationType } from './types';
import { RECIPES } from './data/recipes';
import { MenuScene } from './scenes/MenuScene';

export class Game {
  private engine: Engine;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
  }

  /** Load all pixel art sprites and start the first scene */
  async init(): Promise<void> {
    await this.loadSprites();
    this.engine.scenes.replace(new MenuScene(this.engine), 'none');
  }

  /** Get the Engine instance */
  getEngine(): Engine {
    return this.engine;
  }

  /** Start the game loop */
  start(): void {
    this.engine.start();
  }

  // ---- Load generated 16-bit pixel art sprites from public/sprites/ ----

  private async loadSprites(): Promise<void> {
    const assets = this.engine.assets;
    const images: Record<string, string> = {
      bg_saigon: './sprites/backgrounds/saigon_night.png',
      npc_cat_boss: './sprites/npc/cat_boss.png',
      npc_cat_golden: './sprites/npc/cat_golden.png',
    };

    // All 10 kitchen stations
    for (const type of Object.values(StationType)) {
      const key = type.toLowerCase();
      images[`station_${key}`] = `./sprites/stations/${key}.png`;
    }

    // All 24 Vietnamese dishes
    for (const recipe of RECIPES) {
      images[`food_${recipe.id}`] = `./sprites/food/${recipe.id}.png`;
    }

    // All 6 Vietnamese customer characters
    for (const type of Object.values(CustomerType)) {
      const key = type.toLowerCase();
      images[`customer_${key}`] = `./sprites/customers/${key}.png`;
    }

    // Load all sprites in parallel, falling back gracefully on any missing file
    await Promise.all(
      Object.entries(images).map(async ([key, url]) => {
        try {
          await assets.loadImage(key, url);
        } catch {
          console.warn(`Sprite missing, using fallback placeholder: ${url}`);
          assets.createPlaceholder(key, 64, 64, '#E85D04');
        }
      }),
    );
  }
}
