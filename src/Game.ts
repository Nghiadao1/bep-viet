// ============================================================
// Game — Main game controller
// ============================================================

import { Engine } from './core/Engine';
import { StationType } from './types';
import { MenuScene } from './scenes/MenuScene';

export class Game {
  private engine: Engine;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
  }

  /** Initialize assets and start the first scene */
  init(): void {
    this.createPlaceholders();
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

  // ---- Create placeholder sprites for all game entities ----

  private createPlaceholders(): void {
    const assets = this.engine.assets;

    // Station placeholders
    const stationColors: Record<StationType, string> = {
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

    for (const [type, color] of Object.entries(stationColors)) {
      assets.createPlaceholder(`station_${type.toLowerCase()}`, 100, 110, color);
    }

    // Food item placeholders
    const foods: Array<{ key: string; color: string }> = [
      { key: 'food_pho_bo', color: '#D4A373' },
      { key: 'food_pho_ga', color: '#F2CC8F' },
      { key: 'food_bun_bo_hue', color: '#E76F51' },
      { key: 'food_banh_mi', color: '#DDA15E' },
      { key: 'food_goi_cuon', color: '#81B29A' },
      { key: 'food_com_tam', color: '#BC6C25' },
      { key: 'food_ca_phe', color: '#6B4423' },
      { key: 'food_che', color: '#A8DADC' },
      { key: 'food_bun_cha', color: '#C9790B' },
    ];

    for (const { key, color } of foods) {
      assets.createPlaceholder(key, 64, 64, color);
    }

    // Customer placeholders
    const customerColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    for (let i = 0; i < customerColors.length; i++) {
      assets.createPlaceholder(`customer_${i}`, 60, 80, customerColors[i]);
    }

    // UI placeholders
    assets.createPlaceholder('btn_play', 240, 50, '#E85D04');
    assets.createPlaceholder('btn_pause', 44, 36, '#666');
    assets.createPlaceholder('star_empty', 48, 48, '#333');
    assets.createPlaceholder('star_full', 48, 48, '#FCA311');
  }
}
