// ============================================================
// main.ts — Entry point
// ============================================================

import { Game } from './Game';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas #game not found');

  const game = new Game(canvas);
  await game.init();

  // Hide loading indicator once pixel art sprites are ready
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  game.start();
}

bootstrap();
