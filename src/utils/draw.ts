// ============================================================
// Draw Utilities — Canvas 2D drawing helpers
// ============================================================

/** Draw a rounded rectangle */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw text with shadow for readability */
export function drawTextShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  color = '#fff',
  shadowColor = 'rgba(0,0,0,0.5)',
  offsetY = 2,
): void {
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x, y + offsetY);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Draw a progress bar */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  progress: number,  // 0→1
  fgColor: string,
  bgColor = 'rgba(0,0,0,0.3)',
  borderColor = 'rgba(0,0,0,0.5)',
): void {
  // Background
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Fill
  if (progress > 0) {
    const fillW = Math.max(h, w * Math.min(1, progress));
    roundRect(ctx, x, y, fillW, h, h / 2);
    ctx.fillStyle = fgColor;
    ctx.fill();
  }

  // Border
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}
