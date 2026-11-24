#!/usr/bin/env node
// ============================================================
// Bếp Việt — Extra 16-Bit Pixel Art Prop Sprites Generator
// Produces crisp transparent RGBA PNG sprites for:
// - Sneaky Veggie Worm (worm.png)
// - Sliceable Vietnamese Aromatics & Fruits (onion, garlic, chili, lime, carrot, mango, bomb_coal)
// - Market Street Runner Obstacles (scooter, barrier, basket, coin)
// - Gangster Showdown RPS Icons (rps_rock, rps_scissors, rps_paper, brawl_cloud)
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
  getA(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
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
  save(name, scale = 3) {
    const up = this.scaleUp(scale);
    fs.writeFileSync(path.join(OUT_DIR, name), encodePNG(up.w, up.h, up.data));
  }
}

// 1. Sneaky Green Caterpillar Worm (worm.png)
{
  const c = new PixelCanvas(24, 24);
  // Cute segmented lime-green worm arching upward
  c.ellipse(6, 17, 3.2, 3.2, '#52b788');
  c.ellipse(10, 14, 3.6, 3.6, '#74c69d');
  c.ellipse(14, 15, 3.6, 3.6, '#52b788');
  c.ellipse(18, 12, 4.2, 4.2, '#95d5b2');
  // Stripes & highlights
  c.px(9, 12, '#d8f3dc'); c.px(17, 10, '#d8f3dc');
  // Googly eyes & antennae!
  c.rect(17, 10, 2, 2, '#ffffff'); c.px(18, 11, '#111111');
  c.rect(20, 10, 2, 2, '#ffffff'); c.px(21, 11, '#111111');
  c.line(17, 8, 16, 5, '#e63946'); c.line(20, 8, 22, 5, '#e63946');
  c.px(16, 5, '#ffd166'); c.px(22, 5, '#ffd166');
  c.outline();
  c.save('worm.png', 4);
}

// 2. Purple Shallot / Hành Tím (prop_onion.png)
{
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 14, 7, 7, '#7b2cbf');
  c.ellipse(11, 13, 5, 5.5, '#9d4edd');
  c.ellipse(9, 12, 2, 3, '#c77dff');
  c.line(12, 7, 11, 3, '#52b788', 2);
  c.line(12, 7, 14, 3, '#74c69d', 2);
  c.line(12, 21, 10, 22, '#e9c46a');
  c.line(12, 21, 14, 22, '#e9c46a');
  c.outline();
  c.save('prop_onion.png', 4);
}

// 3. Garlic Bulb / Tỏi (prop_garlic.png)
{
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 15, 7.5, 6.2, '#e9e2d0');
  c.ellipse(9, 15, 3.5, 5.5, '#f8f4e8');
  c.ellipse(15, 15, 3.5, 5.5, '#dfd5be');
  c.ellipse(12, 14, 3.2, 6, '#fffdf7');
  c.rect(11, 5, 2, 5, '#d4a373');
  c.px(10, 12, '#ffffff');
  c.outline();
  c.save('prop_garlic.png', 4);
}

// 4. Red Bird's Eye Chili / Ớt Đỏ (prop_chili.png)
{
  const c = new PixelCanvas(24, 24);
  c.line(18, 6, 15, 8, '#2d9348', 2);
  c.ellipse(14, 10, 3.5, 3.5, '#e63946');
  c.ellipse(11, 13, 3.2, 3.2, '#e63946');
  c.ellipse(8, 16, 2.6, 2.6, '#d00000');
  c.ellipse(5, 18, 1.8, 1.8, '#9d0208');
  c.px(14, 9, '#ff8fa3'); c.px(11, 12, '#ff8fa3');
  c.outline();
  c.save('prop_chili.png', 4);
}

// 5. Fresh Vietnamese Lime / Chanh Xanh (prop_lime.png)
{
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 13, 7.5, 7, '#2d9348');
  c.ellipse(11, 12, 6, 5.5, '#52b788');
  c.ellipse(9, 10, 2.5, 2.5, '#95d5b2');
  c.line(12, 6, 15, 4, '#1b4332', 2);
  c.ellipse(16, 5, 2.5, 1.5, '#74c69d');
  c.outline();
  c.save('prop_lime.png', 4);
}

// 6. Crisp Carrot / Cà Rốt (prop_carrot.png)
{
  const c = new PixelCanvas(24, 24);
  c.line(16, 6, 19, 3, '#2d9348', 2);
  c.line(16, 7, 21, 7, '#52b788', 2);
  c.ellipse(14, 9, 4, 4, '#f48c06');
  c.ellipse(11, 12, 3.4, 3.4, '#e85d04');
  c.ellipse(8, 15, 2.6, 2.6, '#f48c06');
  c.ellipse(6, 18, 1.8, 1.8, '#e85d04');
  c.px(13, 8, '#ffba08'); c.px(10, 11, '#ffba08');
  c.outline();
  c.save('prop_carrot.png', 4);
}

// 7. Golden Mango / Xoài Vàng (prop_mango.png)
{
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 13, 6.5, 7.5, '#f48c06');
  c.ellipse(11, 12, 5.2, 6.2, '#ffba08');
  c.ellipse(9, 10, 2.5, 3, '#ffe169');
  c.ellipse(15, 10, 2, 2.5, '#e63946');
  c.line(12, 5, 14, 3, '#2d9348', 2);
  c.outline();
  c.save('prop_mango.png', 4);
}

// 8. Hot Charcoal Bomb / Than Nóng Nguy Hiểm (prop_bomb_coal.png)
{
  const c = new PixelCanvas(24, 24);
  c.ellipse(12, 14, 7.5, 7.2, '#2b2d42');
  c.ellipse(10, 12, 5, 4.8, '#3f4259');
  // Glowing red ember cracks
  c.line(8, 14, 15, 16, '#e63946', 1);
  c.line(10, 17, 13, 12, '#f48c06', 1);
  // Fuse & burning spark!
  c.line(12, 7, 15, 4, '#d4a373', 2);
  c.ellipse(17, 4, 2.4, 2.4, '#ffba08');
  c.px(17, 4, '#ffffff');
  c.outline('#111111');
  c.save('prop_bomb_coal.png', 4);
}

// 9. Vietnamese Red Motorbike / Xe Máy (prop_scooter.png) — front-facing 3-lane obstacle!
{
  const c = new PixelCanvas(32, 32);
  // Tire
  c.rect(13, 21, 6, 9, '#1f2937');
  c.rect(14, 22, 4, 7, '#374151');
  // Front fender & red Wave body shield
  c.ellipse(16, 20, 7, 4, '#d00000');
  c.rect(9, 13, 14, 9, '#e63946');
  c.rect(11, 14, 10, 6, '#ff4d6d');
  // Handlebar & mirrors
  c.rect(6, 9, 20, 3, '#495057');
  c.rect(4, 9, 3, 3, '#1f2937');
  c.rect(25, 9, 3, 3, '#1f2937');
  c.line(8, 9, 6, 5, '#adb5bd'); c.ellipse(5, 4, 2, 1.5, '#90e0ef');
  c.line(24, 9, 26, 5, '#adb5bd'); c.ellipse(27, 4, 2, 1.5, '#90e0ef');
  // Bright glowing yellow headlight!
  c.ellipse(16, 10, 3.8, 3, '#ffd166');
  c.ellipse(16, 10, 2, 1.5, '#ffffff');
  // Front metal license plate
  c.rect(13, 18, 6, 3, '#ffffff');
  c.outline('#1a1118');
  c.save('prop_scooter.png', 4);
}

// 10. Street Construction Barrier / Rào Chắn (prop_barrier.png)
{
  const c = new PixelCanvas(32, 24);
  // Legs
  c.rect(5, 6, 3, 16, '#6c757d');
  c.rect(24, 6, 3, 16, '#6c757d');
  // Yellow-black hazard boards
  c.rect(3, 6, 26, 6, '#ffba08');
  c.rect(3, 14, 26, 5, '#ffba08');
  for (let x = 5; x < 27; x += 6) {
    c.rect(x, 6, 3, 6, '#1f2937');
    c.rect(x + 2, 14, 3, 5, '#1f2937');
  }
  // Warning red lamp on top
  c.ellipse(16, 4, 2.5, 2.5, '#e63946');
  c.px(16, 3, '#ffccd5');
  c.outline('#1a1118');
  c.save('prop_barrier.png', 4);
}

// 11. Woven Bamboo Market Basket / Thúng Hàng (prop_basket.png)
{
  const c = new PixelCanvas(28, 24);
  c.ellipse(14, 16, 11, 6, '#b07d4f');
  c.ellipse(14, 12, 11, 4.5, '#d4a373');
  c.ellipse(14, 11, 9, 3.5, '#7f4f24');
  // Colorful veggies piled inside
  c.ellipse(10, 10, 3.5, 2.8, '#2d9348');
  c.ellipse(15, 9, 3.5, 3, '#e63946');
  c.ellipse(18, 10, 3, 2.5, '#ffba08');
  c.outline('#1a1118');
  c.save('prop_basket.png', 4);
}

// 12. RPS Battle Icons (rps_rock, rps_scissors, rps_paper) + Comic Brawl Cloud
{
  // Rock / Búa (Cat Fist!)
  const r = new PixelCanvas(24, 24);
  r.ellipse(12, 13, 7.5, 7, '#f4a261');
  r.ellipse(11, 11, 5.5, 5, '#ffcb77');
  r.rect(7, 15, 10, 4, '#e76f51');
  r.line(9, 10, 9, 15, '#9c4a1a');
  r.line(12, 10, 12, 15, '#9c4a1a');
  r.line(15, 10, 15, 15, '#9c4a1a');
  r.outline('#1a1118');
  r.save('rps_rock.png', 4);

  // Scissors / Kéo
  const s = new PixelCanvas(24, 24);
  s.line(7, 4, 13, 14, '#e2e8f0', 2.4);
  s.line(17, 4, 11, 14, '#cbd5e1', 2.4);
  s.ellipse(8, 18, 3.5, 3.5, '#e63946');
  s.ellipse(16, 18, 3.5, 3.5, '#e63946');
  s.ellipse(8, 18, 1.5, 1.5, '#1a1118');
  s.ellipse(16, 18, 1.5, 1.5, '#1a1118');
  s.px(12, 13, '#ffd166');
  s.outline('#1a1118');
  s.save('rps_scissors.png', 4);

  // Paper / Bao (Open Cat Paw!)
  const p = new PixelCanvas(24, 24);
  p.ellipse(12, 15, 6.5, 6, '#fffcf5');
  p.ellipse(6, 9, 2.2, 3, '#fffcf5');
  p.ellipse(10, 6, 2.2, 3.2, '#fffcf5');
  p.ellipse(14, 6, 2.2, 3.2, '#fffcf5');
  p.ellipse(18, 9, 2.2, 3, '#fffcf5');
  // Pink paw pads!
  p.ellipse(12, 15, 3.2, 2.8, '#ff8fa3');
  p.px(6, 9, '#ff8fa3'); p.px(10, 6, '#ff8fa3'); p.px(14, 6, '#ff8fa3'); p.px(18, 9, '#ff8fa3');
  p.outline('#1a1118');
  p.save('rps_paper.png', 4);

  // Comic Brawl Dust Cloud!
  const b = new PixelCanvas(32, 32);
  b.ellipse(16, 16, 11, 10, '#fffcf5');
  b.ellipse(8, 14, 6, 6, '#f1f5f9');
  b.ellipse(24, 15, 6, 6, '#f1f5f9');
  b.ellipse(12, 8, 6, 5, '#ffffff');
  b.ellipse(20, 23, 6, 5, '#e2e8f0');
  // Comic star sparks inside cloud
  b.line(10, 12, 22, 20, '#ffba08', 2);
  b.line(22, 12, 10, 20, '#e63946', 2);
  b.ellipse(16, 16, 4, 4, '#ffd166');
  b.outline('#1a1118');
  b.save('brawl_cloud.png', 4);
}

console.log('✅ Generated 15 crisp 16-bit pixel art prop sprites in public/sprites/props/');
