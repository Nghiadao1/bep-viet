// ============================================================
// main.ts — Entry point
// ============================================================

import { Game } from './Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas #game not found');

// Hide loading indicator
const loading = document.getElementById('loading');
if (loading) loading.style.display = 'none';

// Create and start the game
const game = new Game(canvas);
game.init();
game.start();
