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
      bg_stall_1: './sprites/backgrounds/stall_1_cart.jpg',
      bg_stall_2: './sprites/backgrounds/stall_2_sidewalk.jpg',
      bg_stall_3: './sprites/backgrounds/stall_3_heritage.jpg',
      bg_stall_4: './sprites/backgrounds/stall_4_luxury.jpg',
      bg_market_runner: './sprites/backgrounds/market_runner.jpg',
      bg_alley_arena: './sprites/backgrounds/alley_arena.jpg',
      npc_cat_boss: './sprites/npc/cat_boss.png',
      npc_cat_golden: './sprites/npc/cat_golden.png',
      npc_cat_gangster: './sprites/npc/cat_gangster.png',
      prop_worm: './sprites/props/worm.png',
      prop_onion: './sprites/props/prop_onion.png',
      prop_garlic: './sprites/props/prop_garlic.png',
      prop_chili: './sprites/props/prop_chili.png',
      prop_lime: './sprites/props/prop_lime.png',
      prop_carrot: './sprites/props/prop_carrot.png',
      prop_mango: './sprites/props/prop_mango.png',
      prop_bomb_coal: './sprites/props/prop_bomb_coal.png',
      prop_scooter: './sprites/props/prop_scooter.png',
      prop_barrier: './sprites/props/prop_barrier.png',
      prop_basket: './sprites/props/prop_basket.png',
      rps_rock: './sprites/props/rps_rock.png',
      rps_scissors: './sprites/props/rps_scissors.png',
      rps_paper: './sprites/props/rps_paper.png',
      brawl_cloud: './sprites/props/brawl_cloud.png',
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
