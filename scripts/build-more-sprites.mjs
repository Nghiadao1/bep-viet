#!/usr/bin/env node
// ============================================================
// Bếp Việt — Wave 2 Pixel Art Prop Sprites Generator
// Generates 18 crisp 16-bit transparent PNG sprites for:
// - Fishing Gold-Miner (fish_gold, fish_big, item_tea, item_soda, junk_boot, junk_rock, chest_gold)
// - Dishwashing Catcher (dish_dirty, dish_soap, dish_sponge, dish_brick, dish_broken)
// - Tower Bloxx Floors (floor_1, floor_2, floor_3, floor_roof)
// - Maze Relocation (cart_mini, maze_flag)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from './slice-sprites.mjs';

const OUT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/sprites/props');
fs.mkdirSync(OUT_DIR, { recursive: true });

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  static parse(hex) {
    if (!hex) return [0, 0, 0, 0];
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
    ];
  }
  px(x, y, hex) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = PixelCanvas.parse(hex);
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
    } else if (a > 0) {
      const sa = a / 255, da = this.data[i + 3] / 255, oa = sa + da * (1 - sa);
      this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / oa);
      this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / oa);
      this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / oa);
      this.data[i + 3] = Math.round(oa * 255);
    }
  }
  rect(x, y, w, h, hex) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex);
  }
  ellipse(cx, cy, rx, ry, hex) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, hex);
      }
    }
  }
  line(x0, y0, x1, y1, hex, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (thick <= 1) this.px(x0, y0, hex);
      else this.ellipse(x0, y0, thick / 2, thick / 2, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  outline(hex = '#1a1118') {
    const src = new Uint8Array(this.data);
    const [r, g, b, a] = PixelCanvas.parse(hex);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[(y * this.w + x) * 4 + 3] > 0) continue;
        let hit = false;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + ox, ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && src[(ny * this.w + nx) * 4 + 3] > 20) {
            hit = true; break;
          }
        }
        if (hit) {
          const i = (y * this.w + x) * 4;
          this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a;
        }
      }
    }
  }
  scaleUp(factor) {
    const out = new PixelCanvas(this.w * factor, this.h * factor);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const si = (y * this.w + x) * 4;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            const di = ((y * factor + dy) * out.w + (x * factor + dx)) * 4;
            out.data[di] = this.data[si];
            out.data[di + 1] = this.data[si + 1];
            out.data[di + 2] = this.data[si + 2];
            out.data[di + 3] = this.data[si + 3];
          }
        }
      }
    }
    return out;
  }
  save(name, scale = 4) {
    const up = this.scaleUp(scale);
    fs.writeFileSync(path.join(OUT_DIR, name), encodePNG(up.w, up.h, up.data));
  }
}

// ---- 1. Fishing Gold-Miner Sprites ----

// Golden Koi Fish (fish_gold.png)
{
  const c = new PixelCanvas(26, 20);
  c.ellipse(14, 10, 8, 5.5, '#f48c06');
  c.ellipse(13, 9, 6.5, 4, '#ffba08');
  c.ellipse(12, 8, 3, 2, '#ffe169');
  // Tail fin
  c.line(5, 6, 2, 10, '#e85d04', 2);
  c.line(5, 14, 2, 10, '#e85d04', 2);
  c.rect(4, 7, 3, 6, '#f48c06');
  // Top fin & eye
  c.rect(12, 3, 4, 2, '#e85d04');
  c.rect(18, 8, 2, 2, '#ffffff');
  c.px(19, 9, '#111111');
  c.outline();
  c.save('fish_gold.png', 4);
}

// Giant River Fish (fish_big.png)
{
  const c = new PixelCanvas(32, 22);
  c.ellipse(17, 11, 11, 7, '#2a9d8f');
  c.ellipse(16, 10, 9, 5, '#4cc9f0');
  c.ellipse(16, 14, 8, 3, '#e0fbfc');
  // Tail
  c.rect(3, 6, 4, 10, '#1d6f67');
  c.rect(5, 8, 3, 6, '#2a9d8f');
  // Dorsal fin & eye
  c.rect(13, 3, 7, 2, '#1d6f67');
  c.rect(23, 8, 3, 3, '#ffffff');
  c.px(25, 9, '#111111');
  c.outline();
  c.save('fish_big.png', 4);
}

// Refreshing Vietnamese Iced Tea Cup (item_tea.png) — Restores Customer Patience!
{
  const c = new PixelCanvas(22, 24);
  c.rect(6, 7, 10, 14, '#e0f7ff');
  c.rect(7, 10, 8, 10, '#d49a1a');
  c.rect(7, 10, 8, 3, '#f4c430');
  // Ice cubes + green leaf + red straw
  c.rect(8, 11, 3, 3, '#caf0f8');
  c.rect(12, 12, 3, 3, '#90e0ef');
  c.line(13, 2, 11, 9, '#e63946', 2);
  c.ellipse(16, 7, 2.5, 1.5, '#52b788');
  c.outline();
  c.save('item_tea.png', 4);
}

// Chilled Fizzy Soda Bottle (item_soda.png) — Restores Customer Patience!
{
  const c = new PixelCanvas(20, 26);
  c.rect(8, 3, 4, 5, '#e63946');
  c.rect(7, 3, 6, 2, '#ffd166');
  c.rect(6, 8, 8, 15, '#e63946');
  c.rect(6, 12, 8, 5, '#ffffff');
  c.rect(8, 13, 4, 3, '#38bdf8');
  c.rect(7, 9, 2, 12, '#ff8fa3');
  c.outline();
  c.save('item_soda.png', 4);
}

// Old Sunken Muddy Boot (junk_boot.png)
{
  const c = new PixelCanvas(24, 24);
  c.rect(7, 5, 7, 12, '#6c584c');
  c.rect(7, 14, 13, 6, '#584438');
  c.rect(6, 18, 15, 2, '#2b211c');
  c.rect(8, 6, 2, 10, '#8d7567');
  c.outline();
  c.save('junk_boot.png', 4);
}

// Heavy Gray River Rock (junk_rock.png)
{
  const c = new PixelCanvas(26, 22);
  c.ellipse(13, 12, 10, 8, '#64748b');
  c.ellipse(11, 10, 7, 5, '#94a3b8');
  c.ellipse(16, 15, 5, 3, '#475569');
  c.outline();
  c.save('junk_rock.png', 4);
}

// Golden Treasure Chest (chest_gold.png)
{
  const c = new PixelCanvas(26, 22);
  c.rect(4, 7, 18, 12, '#9c5221');
  c.rect(4, 7, 18, 5, '#c46c2b');
  c.rect(4, 11, 18, 2, '#ffd166');
  c.rect(4, 7, 2, 12, '#ffd166');
  c.rect(20, 7, 2, 12, '#ffd166');
  c.rect(11, 10, 4, 5, '#ffba08');
  c.outline();
  c.save('chest_gold.png', 4);
}

// ---- 2. Dishwashing Catcher Sprites ----

// Dirty Porcelain Bowl (dish_dirty.png)
{
  const c = new PixelCanvas(24, 20);
  c.ellipse(12, 12, 9, 5.5, '#e2e8f0');
  c.ellipse(12, 9, 9, 3.5, '#ffffff');
  c.ellipse(12, 9, 7, 2.2, '#cbd5e1');
  // Sauce smudges!
  c.ellipse(9, 10, 2.5, 1.5, '#b5651d');
  c.ellipse(15, 11, 2, 1.5, '#d00000');
  c.rect(8, 16, 8, 2, '#2a6f97');
  c.outline();
  c.save('dish_dirty.png', 4);
}

// Dish Soap Bottle (dish_soap.png)
{
  const c = new PixelCanvas(20, 26);
  c.rect(8, 3, 4, 3, '#ffd166');
  c.rect(7, 6, 6, 3, '#2d9348');
  c.ellipse(10, 16, 6, 8, '#52b788');
  c.rect(7, 12, 6, 7, '#fffcf5');
  c.ellipse(10, 15, 2, 2, '#ffba08');
  c.outline();
  c.save('dish_soap.png', 4);
}

// Yellow Kitchen Sponge (dish_sponge.png)
{
  const c = new PixelCanvas(24, 20);
  c.rect(4, 5, 16, 4, '#2d9348'); // green scrub layer
  c.rect(4, 9, 16, 7, '#ffba08'); // yellow foam
  c.px(7, 11, '#d97706'); c.px(12, 13, '#d97706'); c.px(16, 11, '#d97706');
  c.ellipse(19, 6, 2, 2, '#e0f7ff'); // bubble
  c.outline();
  c.save('dish_sponge.png', 4);
}

// Red Construction Brick Obstacle (dish_brick.png)
{
  const c = new PixelCanvas(26, 18);
  c.rect(3, 5, 20, 10, '#b5382a');
  c.rect(3, 5, 20, 3, '#d9534f');
  c.rect(6, 9, 3, 3, '#5c1a14');
  c.rect(12, 9, 3, 3, '#5c1a14');
  c.rect(18, 9, 3, 3, '#5c1a14');
  c.outline();
  c.save('dish_brick.png', 4);
}

// Jagged Broken Plate Obstacle (dish_broken.png)
{
  const c = new PixelCanvas(24, 20);
  c.ellipse(11, 11, 8, 5, '#e2e8f0');
  // Jagged dark crack cutting out right chunk!
  c.line(12, 5, 10, 10, '#1a1118', 2);
  c.line(10, 10, 15, 14, '#1a1118', 2);
  c.line(15, 14, 12, 17, '#1a1118', 2);
  c.rect(17, 7, 4, 4, '#cbd5e1');
  c.outline('#e63946');
  c.save('dish_broken.png', 4);
}

// ---- 3. Tower Bloxx Restaurant Floors (44x22 scaled x4 = 176x88) ----
function makeFloor(name, wall, trim, roof, windowCol, isRoof = false) {
  const c = new PixelCanvas(44, 22);
  if (isRoof) {
    // Ornate curved Vietnamese pagoda/heritage tiled roof + golden lotus finial!
    c.rect(4, 12, 36, 8, wall);
    c.rect(2, 8, 40, 5, roof);
    c.rect(6, 4, 32, 4, trim);
    c.rect(19, 1, 6, 4, '#ffd166');
    // Glowing red lanterns under eaves
    c.ellipse(10, 15, 2.5, 3, '#e63946');
    c.ellipse(22, 15, 2.5, 3, '#ffba08');
    c.ellipse(34, 15, 2.5, 3, '#e63946');
  } else {
    c.rect(3, 3, 38, 17, wall);
    c.rect(2, 2, 40, 3, roof);
    c.rect(3, 18, 38, 3, trim);
    // 3 warm glowing windows with wooden shutters
    for (const wx of [7, 18, 29]) {
      c.rect(wx, 7, 8, 8, '#3d281c');
      c.rect(wx + 1, 8, 6, 6, windowCol);
      c.rect(wx + 3, 8, 2, 6, '#5c3a21');
    }
    // Tiny hanging red lanterns
    c.rect(4, 5, 2, 4, '#e63946');
    c.rect(38, 5, 2, 4, '#e63946');
  }
  c.outline('#1a1118');
  c.save(name, 4);
}

makeFloor('floor_1.png', '#e9c46a', '#9c5221', '#b5382a', '#fff3b0');
makeFloor('floor_2.png', '#f4a261', '#7f4f24', '#2a9d8f', '#fde68a');
makeFloor('floor_3.png', '#e76f51', '#582f0e', '#9d0208', '#ffeb99');
makeFloor('floor_roof.png', '#8d2424', '#d00000', '#9d0208', '#ffd166', true);

// ---- 4. Maze Hero Cart & Finish Flag ----
{
  const c = new PixelCanvas(24, 24);
  c.rect(4, 3, 16, 4, '#38bdf8');
  c.rect(7, 3, 4, 4, '#ffffff');
  c.rect(14, 3, 4, 4, '#ffffff');
  c.rect(5, 7, 14, 11, '#b07d4f');
  c.rect(7, 9, 10, 5, '#fca311');
  c.ellipse(8, 20, 2.5, 2.5, '#1f2937');
  c.ellipse(16, 20, 2.5, 2.5, '#1f2937');
  c.outline();
  c.save('cart_mini.png', 4);
}

{
  const c = new PixelCanvas(22, 24);
  c.rect(5, 3, 2, 19, '#e2e8f0');
  c.rect(7, 4, 12, 8, '#e63946');
  c.rect(11, 6, 4, 4, '#ffd166');
  c.outline();
  c.save('maze_flag.png', 4);
}

console.log('✅ Generated 18 Wave-2 pixel art prop sprites in public/sprites/props/');
