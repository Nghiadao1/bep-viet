// ============================================================
// Responsive — Canvas sizing and scaling utilities
// ============================================================

export interface CanvasSize {
  width: number;   // canvas pixel width
  height: number;  // canvas pixel height
  scale: number;   // game-to-canvas scale factor
}

/**
 * Calculate canvas size to fit the game into the window
 * while maintaining aspect ratio and accounting for DPR.
 */
export function calculateCanvasSize(
  gameWidth: number,
  gameHeight: number,
  windowWidth: number,
  windowHeight: number,
  dpr: number = 1,
): CanvasSize {
  const gameAspect = gameWidth / gameHeight;
  const windowAspect = windowWidth / windowHeight;

  let displayWidth: number;
  let displayHeight: number;

  if (windowAspect > gameAspect) {
    // Window is wider than game → fit to height
    displayHeight = windowHeight;
    displayWidth = displayHeight * gameAspect;
  } else {
    // Window is taller than game → fit to width
    displayWidth = windowWidth;
    displayHeight = displayWidth / gameAspect;
  }

  const canvasWidth = Math.floor(displayWidth * dpr);
  const canvasHeight = Math.floor(displayHeight * dpr);
  const scale = canvasWidth / gameWidth;

  return { width: canvasWidth, height: canvasHeight, scale };
}
