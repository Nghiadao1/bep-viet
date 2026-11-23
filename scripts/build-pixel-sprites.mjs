#!/usr/bin/env node
// ============================================================
// Bếp Việt — High-Craft 16-Bit Pixel Art Asset Generator
// Produces crisp transparent RGBA PNG sprites for all 24 dishes,
// 10 cooking stations, 6 Vietnamese customers, UI icons, and
// the Sài Gòn night street-stall pixel art background.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from './slice-sprites.mjs';

const OUT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/sprites');

// ---- Tiny Pixel Canvas with True 16-bit Drawing Primitives ----

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  static parseColor(hex) {
    if (!hex) return [0, 0, 0, 0];
    const h = hex.replace('#', '');
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        255,
      ];
    }
    if (h.length === 8) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        parseInt(h.slice(6, 8), 16),
      ];
    }
    return [255, 0, 255, 255];
  }

  px(x, y, hex) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof hex === 'string' ? PixelCanvas.parseColor(hex) : hex;
    const idx = (y * this.w + x) * 4;
    if (a === 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    } else if (a > 0) {
      const sa = a / 255;
      const da = this.data[idx + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa > 0) {
        this.data[idx] = Math.round((r * sa + this.data[idx] * da * (1 - sa)) / oa);
        this.data[idx + 1] = Math.round((g * sa + this.data[idx + 1] * da * (1 - sa)) / oa);
        this.data[idx + 2] = Math.round((b * sa + this.data[idx + 2] * da * (1 - sa)) / oa);
        this.data[idx + 3] = Math.round(oa * 255);
      }
    }
  }

  getA(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x, y, w, h, hex) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        this.px(x + i, y + j, hex);
      }
    }
  }

  hline(x, y, len, hex) {
    this.rect(x, y, len, 1, hex);
  }

  vline(x, y, len, hex) {
    this.rect(x, y, 1, len, hex);
  }

  line(x0, y0, x1, y1, hex) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this.px(x0, y0, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  ellipse(cx, cy, rx, ry, hex) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          this.px(x, y, hex);
        }
      }
    }
  }

  ellipseStroke(cx, cy, rx, ry, hex) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1.08 && d >= 0.72) {
          this.px(x, y, hex);
        }
      }
    }
  }

  circle(cx, cy, r, hex) {
    this.ellipse(cx, cy, r, r, hex);
  }

  /** Add crisp 1px dark pixel outline around all opaque pixels */
  outline(hex = '#23171b') {
    const c = PixelCanvas.parseColor(hex);
    const marks = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.getA(x, y) > 128) continue;
        if (
          this.getA(x - 1, y) > 128 ||
          this.getA(x + 1, y) > 128 ||
          this.getA(x, y - 1) > 128 ||
          this.getA(x, y + 1) > 128
        ) {
          marks.push([x, y]);
        }
      }
    }
    for (const [x, y] of marks) {
      this.px(x, y, c);
    }
  }

  /** Upscale nearest-neighbor by integer factor for crisp retro pixels */
  upscale(factor) {
    if (factor <= 1) return this;
    const out = new PixelCanvas(this.w * factor, this.h * factor);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const si = (y * this.w + x) * 4;
        const r = this.data[si], g = this.data[si + 1], b = this.data[si + 2], a = this.data[si + 3];
        if (a === 0) continue;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            const di = ((y * factor + dy) * out.w + (x * factor + dx)) * 4;
            out.data[di] = r;
            out.data[di + 1] = g;
            out.data[di + 2] = b;
            out.data[di + 3] = a;
          }
        }
      }
    }
    return out;
  }

  save(filePath, scale = 4) {
    const finalCanvas = this.upscale(scale);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, encodePNG(finalCanvas.w, finalCanvas.h, finalCanvas.data));
  }
}

// ---- Reusable Vietnamese Dish Building Blocks (32x32 pixel grid) ----

function drawCeramicBowl(c, {
  rimColor = '#f7f3eb',
  bodyColor = '#e6dfd3',
  shadowColor = '#bfb5a4',
  stripeColor = '#2a6f97',
  brothColor = '#d49a45',
  brothHighlight = '#ecc26e',
  yOff = 0,
} = {}) {
  // Foot ring
  c.ellipse(16, 26 + yOff, 6, 2, shadowColor);
  // Bowl exterior lower belly
  for (let y = 16; y <= 25; y++) {
    const t = (y - 16) / 9;
    const rx = Math.round(12 * (1 - t * 0.42));
    c.hline(16 - rx, y + yOff, rx * 2 + 1, y > 22 ? shadowColor : bodyColor);
    // Shading on right side
    c.hline(16 + Math.floor(rx * 0.3), y + yOff, Math.ceil(rx * 0.7), shadowColor);
    // Blue Vietnamese porcelain stripe
    if (y === 19 || y === 20) {
      c.hline(16 - rx + 1, y + yOff, rx * 2 - 1, stripeColor);
    }
  }
  // Rim oval
  c.ellipse(16, 15 + yOff, 12.5, 5.5, rimColor);
  // Broth inside
  c.ellipse(16, 15 + yOff, 10.5, 4.2, brothColor);
  c.ellipse(14, 14 + yOff, 7, 2.2, brothHighlight);
}

function drawSteam(c, xs = [11, 16, 21], yBase = 8) {
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const h = i % 2 === 0 ? 4 : 5;
    for (let j = 0; j < h; j++) {
      const dx = (j % 2 === 0) ? 0 : 1;
      c.px(x + dx, yBase - j, j === h - 1 ? '#ffffff88' : '#ffffffcc');
    }
  }
}

function drawNoodles(c, color = '#fff9e8', shade = '#e8dec5', cx = 16, cy = 15) {
  c.line(cx - 7, cy - 1, cx + 6, cy - 1, color);
  c.line(cx - 8, cy + 1, cx + 7, cy + 1, shade);
  c.line(cx - 6, cy, cx + 5, cy + 2, color);
  c.line(cx - 5, cy + 2, cx + 6, cy, color);
  c.line(cx - 4, cy - 2, cx + 4, cy, shade);
}

function drawHerbs(c, pts) {
  for (const [x, y] of pts) {
    c.px(x, y, '#2d9348');
    c.px(x + 1, y, '#52b768');
    c.px(x, y + 1, '#1e6b34');
  }
}

function drawPlate(c, outer = '#f5f1e8', inner = '#e4ddd0', rim = '#c9bfb0') {
  c.ellipse(16, 20, 13, 7.5, rim);
  c.ellipse(16, 19, 13, 7, outer);
  c.ellipse(16, 19, 10, 5, inner);
}

function drawTallGlass(c, x = 11, y = 7, w = 10, h = 19) {
  // Glass rim & wall highlights
  c.rect(x, y, w, h, '#d8f3fc');
  c.rect(x + 1, y + 1, w - 2, h - 2, '#eef9fd');
  // Base thick glass
  c.rect(x + 1, y + h - 2, w - 2, 2, '#9ecae1');
  c.hline(x + 1, y, w - 2, '#ffffff');
}

function drawBaguette(c, crust = '#d98a36', crustDark = '#a35d1b', crustLight = '#f4be6b', inner = '#fff3d6') {
  // Diagonal golden baguette
  for (let i = -9; i <= 9; i++) {
    const cx = 16 + i;
    const cy = 18 - Math.round(i * 0.42);
    const rad = Math.max(2, Math.round(4.6 - (i * i) / 28));
    c.ellipse(cx, cy, rad * 0.9, rad, crust);
    c.ellipse(cx, cy + 1, rad * 0.85, rad * 0.7, crustDark);
    c.ellipse(cx - 0.5, cy - 1, rad * 0.7, rad * 0.5, crustLight);
  }
  // Open filling slit
  c.line(9, 20, 23, 14, inner);
  c.line(10, 19, 22, 13, inner);
}

// ---- ALL 24 VIETNAMESE DISHES ----

function buildDishes() {
  const dir = path.join(OUT_ROOT, 'food');

  const recipes = {
    pho_bo(c) {
      drawCeramicBowl(c, { brothColor: '#c98a32', brothHighlight: '#e8b85c', stripeColor: '#22577a' });
      drawNoodles(c);
      // Rare beef slices
      c.ellipse(12, 14, 3, 1.8, '#8d3b32'); c.px(12, 14, '#c46357');
      c.ellipse(18, 13, 3.2, 1.8, '#7a2f27'); c.px(18, 13, '#b85348');
      c.ellipse(15, 16, 2.8, 1.5, '#9e473c'); c.px(15, 16, '#d47c70');
      // Scallions & herbs
      drawHerbs(c, [[10, 15], [14, 13], [20, 15], [16, 17], [22, 14]]);
      // Red chili dot
      c.px(13, 16, '#e63946'); c.px(19, 16, '#e63946');
    },

    pho_ga(c) {
      drawCeramicBowl(c, { brothColor: '#e2b64b', brothHighlight: '#f7d979', stripeColor: '#2a9d8f' });
      drawNoodles(c);
      // Shredded golden chicken
      c.ellipse(13, 14, 3.5, 2, '#f2d08b'); c.hline(11, 14, 4, '#fff1c9');
      c.ellipse(19, 14, 3, 1.8, '#e0b35e'); c.hline(17, 13, 4, '#fae3a5');
      // Lime wedge on rim
      c.ellipse(23, 13, 2.5, 2, '#52b749'); c.px(23, 13, '#b7e868');
      drawHerbs(c, [[10, 16], [16, 16], [18, 12], [15, 13]]);
    },

    banh_mi_thit(c) {
      drawBaguette(c);
      // Pate & pork ham slices
      c.ellipse(12, 17, 2.2, 1.5, '#e8989a');
      c.ellipse(16, 15, 2.2, 1.5, '#d97a7e');
      c.ellipse(20, 14, 2, 1.4, '#e8989a');
      // Pickled carrots (orange) + cucumber & cilantro (green)
      c.line(11, 18, 14, 16, '#f47b20');
      c.line(17, 16, 20, 14, '#f47b20');
      drawHerbs(c, [[13, 16], [15, 14], [18, 14], [21, 13]]);
      c.px(14, 15, '#e63946'); // chili
    },

    com_tam(c) {
      drawPlate(c);
      // Broken rice dome (left)
      c.ellipse(12, 18, 5.5, 3.8, '#fffcf2');
      c.px(10, 17, '#e6dec8'); c.px(13, 16, '#e6dec8'); c.px(11, 19, '#e6dec8');
      // Charred grilled pork chop (right)
      c.ellipse(20, 19, 5.2, 3.5, '#8c3f19');
      c.ellipse(19, 18, 4.2, 2.5, '#b55624');
      c.line(17, 17, 21, 19, '#4a1d0a'); // grill marks
      c.line(19, 16, 22, 18, '#4a1d0a');
      // Sunny-side-up fried egg (top)
      c.ellipse(15, 14, 3.5, 2.2, '#ffffff');
      c.circle(15, 14, 1.4, '#ffb703');
      c.px(14, 13, '#ffe066');
      // Cucumber & tomato
      c.circle(9, 21, 1.6, '#52b768');
      c.circle(12, 22, 1.4, '#e63946');
      // Tiny dipping fish sauce cup
      c.circle(25, 13, 2.5, '#f5f1e8');
      c.circle(25, 13, 1.6, '#e86f1c');
    },

    che_ba_mau(c) {
      drawTallGlass(c, 11, 7, 10, 20);
      // Layer 1 bottom: Red beans
      c.rect(12, 21, 8, 4, '#8b1e24');
      c.px(14, 22, '#b8323a'); c.px(17, 23, '#b8323a');
      // Layer 2: Mung bean yellow
      c.rect(12, 17, 8, 4, '#f4c430');
      c.hline(12, 17, 8, '#ffe066');
      // Layer 3: Green pandan jelly
      c.rect(12, 13, 8, 4, '#2d9348');
      c.px(14, 14, '#70e086'); c.px(17, 15, '#70e086');
      // Layer 4 top: Coconut cream & crushed ice
      c.rect(12, 9, 8, 4, '#ffffff');
      c.px(13, 10, '#bde0fe'); c.px(17, 11, '#bde0fe');
      // Colorful straw sticking out
      c.line(18, 9, 22, 3, '#e63946');
      c.line(19, 9, 23, 3, '#ff758f');
    },

    ca_phe_sua_da(c) {
      drawTallGlass(c, 11, 8, 10, 19);
      // Condensed milk bottom layer
      c.rect(12, 21, 8, 4, '#f7ebd2');
      c.hline(12, 21, 8, '#fff7e6');
      // Rich dark Vietnamese coffee
      c.rect(12, 11, 8, 10, '#3d1e0d');
      c.rect(12, 18, 8, 3, '#6b3b1e'); // swirl transition
      // Ice cubes floating at top
      c.rect(13, 11, 3, 3, '#bde0fe'); c.px(13, 11, '#ffffff');
      c.rect(16, 12, 3, 3, '#a2d2ff'); c.px(16, 12, '#ffffff');
      // Silver stirring spoon
      c.line(18, 10, 21, 4, '#adb5bd');
      c.px(21, 4, '#f8f9fa');
    },

    bun_bo_hue(c) {
      drawCeramicBowl(c, { brothColor: '#c93818', brothHighlight: '#e85d22', stripeColor: '#9b2226' });
      // Thick white round bún
      drawNoodles(c, '#ffffff', '#f2d3c2');
      // Beef shank + round chả Huế
      c.ellipse(12, 14, 3, 2, '#6f2c1f'); c.px(12, 14, '#9e4a38');
      c.circle(19, 14, 2.3, '#e8b49a'); c.circle(19, 14, 1.2, '#f5d2bf');
      // Lemongrass oil glints & herbs
      c.px(15, 13, '#ffb703'); c.px(21, 16, '#ffb703');
      drawHerbs(c, [[10, 16], [15, 16], [17, 12], [22, 14]]);
    },

    banh_beo(c) {
      // Wooden rustic tray
      c.ellipse(16, 19, 13, 7, '#7f4f24');
      c.ellipse(16, 18, 12, 6, '#9c6644');
      // 3 little white saucers with rice cakes + orange shrimp floss
      const pos = [[10, 18], [16, 15], [22, 18]];
      for (const [x, y] of pos) {
        c.ellipse(x, y, 4, 2.5, '#e6dfd3');
        c.ellipse(x, y - 0.5, 3.2, 1.8, '#ffffff');
        c.ellipse(x, y - 0.5, 1.8, 1, '#f47b20');
        c.px(x + 1, y - 1, '#52b768'); // scallion oil
      }
      // Small dipping bowl front
      c.ellipse(16, 21, 2.8, 1.6, '#f5f1e8');
      c.ellipse(16, 21, 1.8, 1, '#e86f1c');
    },

    banh_nam(c) {
      // Flat rectangular banana-leaf parcel
      for (let y = 12; y <= 23; y++) {
        const shift = Math.round((y - 17) * 0.25);
        c.hline(6 + shift, y, 20, y % 3 === 0 ? '#2d6a4f' : '#40916c');
      }
      // Tie string
      c.vline(16, 12, 12, '#d4a373');
      // Peeled open center revealing white rice cake + orange shrimp filling
      c.rect(10, 14, 12, 7, '#f8f5ec');
      c.ellipse(16, 17, 4, 1.8, '#e76f51');
      c.px(14, 17, '#f4a261'); c.px(18, 17, '#f4a261');
      c.px(15, 16, '#52b768');
    },

    com_hen(c) {
      drawCeramicBowl(c, { brothColor: '#f8f5ec', brothHighlight: '#ffffff', stripeColor: '#386641' });
      // Sautéed baby clams (brown/amber speckles)
      for (const [x, y] of [[11, 14], [14, 13], [17, 15], [20, 14], [13, 16], [19, 16]]) {
        c.px(x, y, '#7f4f24'); c.px(x + 1, y, '#b08968');
      }
      // Peanuts + crispy pork skin + starfruit green
      c.px(16, 13, '#f4c430'); c.px(12, 15, '#f4c430'); c.px(21, 15, '#e9c46a');
      drawHerbs(c, [[9, 15], [15, 17], [22, 15], [18, 13]]);
      c.px(16, 15, '#e63946'); // chili
    },

    che_hue(c) {
      drawCeramicBowl(c, { brothColor: '#e9c46a', brothHighlight: '#fae19c', stripeColor: '#6d597a' });
      // Golden lotus seeds & longan pearls
      for (const [x, y] of [[12, 14], [16, 13], [20, 14], [14, 16], [18, 16]]) {
        c.circle(x, y, 1.4, '#f4d35e');
        c.px(x, y - 1, '#fff3b0');
      }
      // Creamy coconut drizzle
      c.line(11, 15, 21, 15, '#ffffff');
      c.px(16, 14, '#ffffff');
      c.px(16, 12, '#52b768'); // pandan garnish
    },

    mi_quang(c) {
      drawCeramicBowl(c, { bodyColor: '#a47148', shadowColor: '#6f4518', rimColor: '#d4a373', stripeColor: '#583101', brothColor: '#e9b44c', brothHighlight: '#f7d154' });
      // Turmeric yellow flat noodles
      drawNoodles(c, '#ffd166', '#e09f3e');
      // 2 curled bright orange shrimp
      c.ellipse(12, 14, 2.5, 1.8, '#f76c35'); c.px(12, 13, '#ffb38a');
      c.ellipse(18, 15, 2.5, 1.8, '#f76c35'); c.px(18, 14, '#ffb38a');
      // Iconic crispy speckled sesame rice cracker sticking out top-right!
      c.ellipse(23, 10, 4.5, 3, '#f2d398');
      c.px(22, 9, '#3d2b1f'); c.px(24, 10, '#3d2b1f'); c.px(23, 11, '#3d2b1f');
      // Peanuts & greens
      drawHerbs(c, [[9, 15], [15, 16], [20, 13]]);
    },

    cao_lau(c) {
      drawCeramicBowl(c, { bodyColor: '#d8cfc0', stripeColor: '#9e2a2b', brothColor: '#9c5a2b', brothHighlight: '#bc753f' });
      // Thick amber Cao Lau noodles
      drawNoodles(c, '#e6c28b', '#c29958');
      // Glossy red char siu pork slices
      c.ellipse(12, 14, 3, 1.8, '#9e2a2b'); c.px(12, 13, '#e05a47');
      c.ellipse(18, 13, 3, 1.8, '#8c2324'); c.px(18, 13, '#d64545');
      // Crispy golden square croutons
      c.rect(19, 15, 3, 2, '#f4a261'); c.px(20, 15, '#ffe066');
      c.rect(14, 16, 3, 2, '#e9c46a');
      drawHerbs(c, [[9, 15], [15, 13], [22, 14]]);
    },

    banh_mi_hoi_an(c) {
      drawBaguette(c, '#e08e2c', '#9c5210', '#ffd166', '#fff8e1');
      // Overflowing roasted pork + dark golden pate + chili
      c.ellipse(12, 17, 2.5, 1.8, '#a43820');
      c.ellipse(16, 15, 2.6, 1.8, '#c95f28');
      c.ellipse(20, 14, 2.2, 1.6, '#8c3b19');
      c.line(10, 18, 22, 13, '#f4a261'); // special Hoi An sauce
      drawHerbs(c, [[11, 16], [15, 14], [19, 13], [22, 12]]);
      c.px(13, 15, '#e63946'); c.px(18, 15, '#e63946');
    },

    com_ga_hoi_an(c) {
      drawPlate(c, '#f7f3eb', '#ede6d8');
      // Bright turmeric golden rice
      c.ellipse(15, 18, 8, 4.5, '#f4c430');
      c.ellipse(14, 17, 6, 3, '#ffd95a');
      // Shredded golden chicken on top
      c.ellipse(16, 16, 5, 2.6, '#e6b85c');
      c.hline(13, 16, 6, '#fff3c4');
      // Red onion & green Vietnamese coriander
      c.px(12, 18, '#c94c6b'); c.px(19, 18, '#c94c6b');
      drawHerbs(c, [[10, 16], [20, 16], [15, 19]]);
      c.circle(23, 15, 1.8, '#52b768'); // lime
    },

    pho_ha_noi(c) {
      drawCeramicBowl(c, { brothColor: '#deb466', brothHighlight: '#f5d996', stripeColor: '#1d3557', yOff: 1 });
      drawNoodles(c, '#ffffff', '#ebe4d5', 16, 16);
      c.ellipse(13, 15, 3.2, 1.8, '#8d3b32'); c.px(13, 15, '#c46357');
      c.ellipse(19, 16, 3, 1.6, '#7a2f27');
      // Abundant Hanoi chopped green scallions
      drawHerbs(c, [[10, 16], [13, 17], [16, 14], [19, 14], [22, 16], [15, 18]]);
      // 2 golden crispy quẩy sticks beside bowl (top-right)
      c.line(21, 8, 28, 12, '#e09f3e'); c.line(21, 9, 28, 13, '#f4c430');
      c.line(22, 6, 29, 10, '#c87d28'); c.line(22, 7, 29, 11, '#f4c430');
    },

    bun_cha(c) {
      // Woven bamboo tray
      c.ellipse(16, 19, 13, 7.5, '#b08968');
      c.ellipse(16, 18, 12, 6.5, '#ddb892');
      // Left: white vermicelli nest + lettuce
      c.ellipse(10, 18, 4.5, 3, '#52b768');
      c.ellipse(11, 17, 3.8, 2.5, '#ffffff');
      c.px(10, 17, '#e6e6e6'); c.px(12, 18, '#e6e6e6');
      // Right: dipping bowl with charred grilled meatballs
      c.ellipse(21, 18, 5, 3.2, '#f5f1e8');
      c.ellipse(21, 18, 4, 2.4, '#d96b1f');
      c.circle(19, 17, 1.4, '#5c2610');
      c.circle(22, 18, 1.4, '#6e2e14');
      c.px(21, 17, '#ffd166'); // pickled papaya
    },

    bun_dau_mam_tom(c) {
      // Round bamboo mẹt lined with green banana leaf
      c.ellipse(16, 18, 13, 8.5, '#a47148');
      c.ellipse(16, 17, 11.5, 7.2, '#2d9348');
      c.ellipse(16, 17, 10, 6, '#40916c');
      // White pressed bún cubes (left)
      c.rect(8, 15, 4, 4, '#ffffff'); c.rect(10, 17, 4, 4, '#f0ede6');
      // Crispy golden fried tofu cubes (center-top)
      c.rect(14, 12, 4, 3, '#f4a261'); c.rect(15, 13, 2, 1, '#ffe066');
      c.rect(18, 13, 4, 3, '#e09f3e'); c.rect(19, 14, 2, 1, '#ffd166');
      // Boiled pork slices (bottom-center)
      c.ellipse(16, 20, 3, 1.5, '#e8a598');
      // Small dark-purple mắm tôm dipping bowl (right) + kumquat
      c.circle(23, 18, 2.8, '#f5f1e8');
      c.circle(23, 18, 1.8, '#5a3e5c');
      c.px(24, 17, '#f4a261'); // kumquat
    },

    pho_cuon(c) {
      drawPlate(c);
      // 3 rolled white rice-noodle cylinders
      const rolls = [[11, 16], [16, 18], [21, 20]];
      for (const [x, y] of rolls) {
        c.line(x - 4, y + 2, x + 4, y - 2, '#ffffff');
        c.line(x - 4, y + 3, x + 4, y - 1, '#f2eee4');
        c.line(x - 3, y + 1, x + 3, y - 3, '#ffffff');
        // Beef & green lettuce peeking from ends
        c.px(x - 5, y + 2, '#52b768'); c.px(x - 4, y + 3, '#7a3b26');
        c.px(x + 5, y - 2, '#52b768'); c.px(x + 4, y - 1, '#7a3b26');
      }
      // Dipping sauce corner
      c.circle(10, 21, 2, '#e86f1c');
    },

    tra_da(c) {
      drawTallGlass(c, 11, 8, 10, 19);
      // Golden amber iced tea
      c.rect(12, 10, 8, 15, '#c98a1c');
      c.rect(12, 10, 8, 5, '#e6b235');
      // Ice cubes floating
      c.rect(13, 10, 3, 3, '#e0f4ff'); c.px(13, 10, '#ffffff');
      c.rect(16, 12, 3, 3, '#c7e9fb'); c.px(16, 12, '#ffffff');
      // Ribbed glass highlight
      c.vline(13, 14, 9, '#f7d979');
    },

    pho_xao_truffle(c) {
      // Sleek matte black gourmet plate
      c.ellipse(16, 20, 13, 7, '#1a1a22');
      c.ellipse(16, 19, 12, 6.2, '#2d2d3a');
      c.ellipse(16, 19, 9.5, 4.5, '#3b3b4c');
      // Glossy stir-fried pho noodles
      drawNoodles(c, '#d9a05b', '#a86f2d', 16, 18);
      // Seared beef strips
      c.ellipse(13, 17, 2.5, 1.5, '#6e281d');
      c.ellipse(19, 18, 2.5, 1.5, '#7a2f22');
      // Black truffle slices with marble speck
      c.circle(16, 16, 2, '#1f1918'); c.px(16, 16, '#8c7a6b');
      c.circle(12, 19, 1.6, '#1f1918'); c.px(12, 19, '#8c7a6b');
      // Microgreens
      drawHerbs(c, [[15, 19], [18, 16]]);
    },

    banh_mi_wagyu(c) {
      drawBaguette(c, '#c97a28', '#8a4c12', '#f7c566', '#fff5dc');
      // Marbled rosy-pink seared wagyu steak slices
      c.ellipse(12, 17, 2.6, 1.8, '#a82834'); c.px(12, 17, '#f29ea6');
      c.ellipse(16, 15, 2.8, 1.8, '#96222c'); c.px(16, 15, '#f29ea6');
      c.ellipse(20, 14, 2.4, 1.6, '#a82834'); c.px(20, 14, '#f29ea6');
      // Gold leaf / caramelized onion glint
      c.px(15, 14, '#ffd700'); c.px(18, 13, '#ffd700');
      drawHerbs(c, [[13, 16], [19, 13]]);
    },

    spring_roll_platter(c) {
      // Elegant wooden board
      c.rect(5, 12, 22, 13, '#7f4f24');
      c.rect(6, 13, 20, 11, '#b07d4f');
      // 3 translucent fresh spring rolls showing orange shrimp & green herbs
      for (let i = 0; i < 3; i++) {
        const rx = 8 + i * 5;
        c.rect(rx, 14, 4, 8, '#f1f5f0');
        c.px(rx + 1, 16, '#f76c35'); c.px(rx + 2, 17, '#f76c35'); // prawn
        c.px(rx + 1, 19, '#52b768'); c.px(rx + 2, 20, '#80ed99'); // avocado/mint
      }
      // Small peanut dipping cup
      c.circle(24, 18, 2.4, '#f5f1e8');
      c.circle(24, 18, 1.5, '#8c4c24');
    },

    vn_coffee_cocktail(c) {
      // Stem & base of coupe cocktail glass
      c.hline(12, 27, 9, '#d8f3fc');
      c.vline(16, 19, 8, '#d8f3fc');
      // Coupe bowl
      c.ellipse(16, 15, 8, 4.5, '#d8f3fc');
      c.ellipse(16, 14, 7.5, 3.8, '#3b1d0e'); // dark espresso cocktail
      c.ellipse(16, 13, 6.5, 2.5, '#e8b878'); // golden crema foam
      // 3 coffee beans garnish
      c.px(14, 13, '#2b1206'); c.px(16, 12, '#2b1206'); c.px(18, 13, '#2b1206');
      // Cinnamon stick
      c.line(19, 13, 24, 7, '#8c451c');
      c.line(20, 13, 25, 7, '#b56130');
    },
  };

  // Run outline BEFORE optional steam overlay so steam stays soft white!
  const steamAfter = {
    pho_bo: [[11, 16, 21], 7],
    pho_ga: [[12, 17], 7],
    bun_bo_hue: [[12, 16, 20], 7],
    pho_ha_noi: [[11, 15], 7],
  };

  for (const [id, drawFn] of Object.entries(recipes)) {
    const c = new PixelCanvas(32, 32);
    drawFn(c);
    c.outline('#23171b');
    if (steamAfter[id]) {
      drawSteam(c, steamAfter[id][0], steamAfter[id][1]);
    }
    c.save(path.join(dir, `${id}.png`), 4);
  }
  console.log(`✓ Generated ${Object.keys(recipes).length} Vietnamese dish sprites -> ${dir}`);
}

// ---- ALL 10 KITCHEN STATIONS (40x40 pixel grid) ----

function buildStations() {
  const dir = path.join(OUT_ROOT, 'stations');

  const stations = {
    broth(c) {
      // Gas burner stand
      c.rect(9, 31, 22, 4, '#3a3a4a');
      c.rect(11, 29, 18, 2, '#555568');
      // Glowing blue-orange flames
      for (const fx of [13, 17, 20, 24]) {
        c.px(fx, 30, '#4cc9f0');
        c.px(fx, 29, '#f77f00');
        c.px(fx + 1, 30, '#fcbf49');
      }
      // Tall gleaming steel stockpot
      c.rect(10, 12, 20, 18, '#8d99ae');
      c.rect(12, 12, 5, 18, '#ced4da'); // specular shine
      c.rect(24, 12, 6, 18, '#6c757d'); // right shadow
      // Side handles
      c.rect(7, 15, 3, 4, '#6c757d');
      c.rect(30, 15, 3, 4, '#6c757d');
      // Rim + rich golden broth
      c.ellipse(20, 12, 10, 3.8, '#dee2e6');
      c.ellipse(20, 12, 8.5, 2.8, '#d49a45');
      c.ellipse(18, 11, 4, 1.4, '#f4d35e');
      // Ladle sticking out
      c.line(23, 12, 30, 4, '#ced4da');
      c.px(30, 4, '#ffffff');
    },

    noodle(c) {
      // Steaming metal blanching pot
      c.rect(10, 16, 20, 17, '#7f8c8d');
      c.rect(12, 16, 5, 17, '#bdc3c7');
      c.ellipse(20, 16, 10, 3.5, '#ecf0f1');
      c.ellipse(20, 16, 8.5, 2.5, '#90e0ef');
      // Woven bamboo noodle blanching basket (vợt trụng phở)
      c.rect(15, 9, 10, 9, '#d4a373');
      c.hline(15, 11, 10, '#a47148');
      c.hline(15, 14, 10, '#a47148');
      // White rice noodles piled in basket
      c.ellipse(20, 9, 5, 2.5, '#fffcf2');
      c.line(16, 9, 24, 9, '#e6dec8');
      // Long bamboo handle
      c.line(24, 10, 33, 3, '#b07d4f');
      c.line(24, 11, 33, 4, '#8c5a2b');
    },

    meat(c) {
      // Thick round Vietnamese wooden butcher block (thớt gỗ)
      c.ellipse(20, 27, 14, 7, '#6f4518');
      c.ellipse(20, 24, 14, 7, '#a47148');
      c.ellipse(20, 23, 13, 6, '#d4a373');
      c.ellipseStroke(20, 23, 9, 4, '#bc8a5f');
      // Sliced beef & pork on board
      c.ellipse(14, 23, 4.5, 2.5, '#9e2a2b'); c.hline(12, 23, 4, '#e07a7a');
      c.ellipse(21, 25, 4, 2.2, '#c94c4c'); c.hline(19, 25, 4, '#f2b5b5');
      // Shiny cleaver knife standing upright/angled
      c.rect(20, 10, 11, 9, '#ced4da');
      c.rect(21, 11, 4, 7, '#f8f9fa');
      c.hline(20, 18, 11, '#6c757d'); // sharp edge
      c.rect(31, 12, 5, 3, '#583101'); // wooden handle
    },

    veggie(c) {
      // Woven bamboo basket
      c.ellipse(20, 27, 13, 7, '#8c5a2b');
      c.ellipse(20, 24, 14, 7, '#c89b6e');
      c.hline(9, 27, 22, '#6f4518');
      c.hline(11, 30, 18, '#6f4518');
      // Overflowing fresh green herbs
      for (const [x, y, r, col] of [
        [13, 19, 4.5, '#2d6a4f'], [20, 17, 5, '#40916c'], [26, 19, 4.5, '#2d6a4f'],
        [16, 16, 4, '#52b788'], [23, 18, 4, '#52b788'], [19, 20, 4.5, '#74c69d'],
      ]) {
        c.circle(x, y, r, col);
      }
      // White bean sprouts pile
      c.ellipse(14, 22, 4, 2, '#f8f5ec');
      c.px(13, 21, '#e9c46a'); c.px(15, 22, '#e9c46a');
      // Lime wedges & bright red chilies
      c.circle(25, 22, 2.5, '#80ed99'); c.px(25, 22, '#c7f9cc');
      c.line(18, 22, 22, 24, '#e63946');
      c.line(19, 21, 23, 23, '#ff4d6d');
    },

    sauce(c) {
      // Wooden condiment tray
      c.rect(6, 26, 28, 7, '#7f4f24');
      c.rect(7, 24, 26, 4, '#b07d4f');
      // Fish sauce bottle (left, tall amber)
      c.rect(9, 13, 6, 13, '#9c4a1a');
      c.rect(10, 15, 4, 5, '#f4e4c1'); // label
      c.rect(11, 9, 2, 4, '#d97706');
      c.rect(10, 8, 4, 2, '#e63946'); // cap
      // Chili sauce bottle (middle, bright red)
      c.rect(17, 14, 6, 12, '#d62828');
      c.rect(18, 16, 2, 8, '#f77f00');
      c.rect(19, 10, 2, 4, '#2d9348'); // green nozzle cap!
      // Hoisin / soy jar (right, dark brown)
      c.rect(25, 16, 6, 10, '#3d2115');
      c.rect(26, 18, 4, 4, '#e9c46a');
      c.rect(25, 14, 6, 2, '#adb5bd');
    },

    bread(c) {
      // Compact street-stall stainless toaster / warmer box
      c.rect(6, 14, 28, 19, '#7f8c8d');
      c.rect(7, 15, 26, 17, '#95a5a6');
      // Glowing warm amber oven window
      c.rect(9, 18, 17, 10, '#f48c06');
      c.rect(10, 19, 15, 8, '#ffba08');
      // Mini baguette inside glowing window
      c.ellipse(17, 23, 6, 2.2, '#b55618');
      c.ellipse(17, 22, 5, 1.4, '#e09f3e');
      // Knobs on right side
      c.circle(30, 20, 1.5, '#2b2d42');
      c.circle(30, 25, 1.5, '#e63946');
      // Golden crispy bánh mì stacked on top!
      c.ellipse(15, 12, 7, 3, '#c97a28'); c.ellipse(15, 11, 6, 2, '#f4be6b');
      c.ellipse(25, 12, 6, 2.6, '#b5651d'); c.ellipse(25, 11, 5, 1.6, '#e8a84a');
    },

    grill(c) {
      // Charcoal street grill legs + trough
      c.rect(9, 28, 3, 7, '#343a40');
      c.rect(28, 28, 3, 7, '#343a40');
      c.rect(6, 20, 28, 9, '#495057');
      c.rect(7, 21, 26, 7, '#343a40');
      // Glowing red-orange coals
      c.rect(8, 18, 24, 4, '#d00000');
      for (let x = 9; x < 31; x += 3) {
        c.px(x, 19, '#ffba08');
        c.px(x + 1, 20, '#f48c06');
      }
      // Metal grill grate bars
      for (let x = 8; x <= 32; x += 4) {
        c.vline(x, 16, 4, '#adb5bd');
      }
      // Sizzling pork chops & skewers on grate
      c.ellipse(14, 16, 4.5, 2.2, '#8c3f19'); c.hline(12, 16, 4, '#c45b28');
      c.ellipse(25, 16, 4.5, 2.2, '#7a3314'); c.hline(23, 16, 4, '#b55624');
    },

    wok(c) {
      // Blazing stove burner underneath
      c.rect(10, 29, 20, 5, '#343a40');
      for (const fx of [13, 17, 20, 23, 26]) {
        c.rect(fx, 25, 2, 4, '#f48c06');
        c.px(fx, 24, '#ffba08');
      }
      // Round deep seasoned cast-iron wok
      c.ellipse(18, 22, 12, 6, '#2b2d42');
      c.ellipse(18, 19, 12, 4.5, '#495057');
      c.ellipse(18, 19, 10, 3.2, '#1f2128');
      // Sizzling stir-fry inside wok
      c.ellipse(18, 19, 7, 2, '#d49a45');
      c.px(15, 18, '#52b768'); c.px(20, 19, '#e63946'); c.px(18, 18, '#ffd166');
      // Wooden wok handle sticking right
      c.line(29, 18, 36, 14, '#7f4f24');
      c.line(29, 19, 36, 15, '#b07d4f');
      // Metal spatula tossing
      c.line(18, 18, 10, 8, '#ced4da');
    },

    drink(c) {
      // Wooden counter base
      c.rect(6, 28, 28, 5, '#7f4f24');
      // Left: Vietnamese coffee phin filter dripping into glass
      c.rect(10, 19, 8, 9, '#d8f3fc');
      c.rect(11, 21, 6, 6, '#4a2410');
      c.rect(11, 25, 6, 2, '#f7ebd2');
      // Silver phin on top of glass
      c.rect(9, 17, 10, 2, '#ced4da');
      c.rect(11, 11, 6, 6, '#adb5bd');
      c.rect(10, 10, 8, 2, '#dee2e6');
      c.px(14, 9, '#f8f9fa'); // lid knob
      // Right: Condensed milk tin (white & red label)
      c.rect(22, 16, 9, 12, '#f8f9fa');
      c.rect(22, 19, 9, 5, '#d62828');
      c.rect(24, 20, 5, 3, '#ffd166');
      c.hline(22, 16, 9, '#adb5bd');
    },

    dessert(c) {
      // Street-stall sweet chè counter stand
      c.rect(5, 25, 30, 8, '#c89b6e');
      c.rect(6, 26, 28, 6, '#a47148');
      // 3 colorful glass topping jars!
      const jars = [
        [7, '#9b2226', '#d62828'],   // Red beans
        [16, '#e9c46a', '#ffd166'],  // Mung bean
        [25, '#2d9348', '#70e086'],  // Pandan jelly
      ];
      for (const [jx, col, hi] of jars) {
        c.rect(jx, 12, 8, 13, '#d8f3fc');
        c.rect(jx + 1, 15, 6, 9, col);
        c.rect(jx + 2, 16, 2, 6, hi);
        c.rect(jx + 1, 10, 6, 2, '#e63946'); // lid
      }
      // Silver ladle
      c.line(20, 12, 23, 6, '#dee2e6');
    },
  };

  const stationSteam = {
    broth: [[14, 20, 25], 8],
    noodle: [[12, 17], 11],
    grill: [[12, 19, 27], 12],
    wok: [[16, 22], 12],
  };

  for (const [id, drawFn] of Object.entries(stations)) {
    const c = new PixelCanvas(40, 40);
    drawFn(c);
    c.outline('#1c1418');
    if (stationSteam[id]) {
      drawSteam(c, stationSteam[id][0], stationSteam[id][1]);
    }
    if (id === 'grill') {
      c.px(16, 13, '#ffba08'); c.px(24, 12, '#f48c06');
    }
    c.save(path.join(dir, `${id}.png`), 3);
  }
  console.log(`✓ Generated ${Object.keys(stations).length} cooking station sprites -> ${dir}`);
}

// ---- ALL 6 VIETNAMESE CUSTOMERS (32x40 pixel chibi portraits) ----

function drawBaseCharacter(c, {
  skin = '#f5c7a3',
  skinShadow = '#d9a077',
  hair = '#221c24',
  shirt = '#4895ef',
  shirtShadow = '#3a6ea5',
  yOff = 0,
}) {
  // Torso / shoulders
  c.ellipse(16, 33 + yOff, 9, 7, shirt);
  c.rect(8, 28 + yOff, 16, 10, shirt);
  c.rect(20, 29 + yOff, 4, 9, shirtShadow);
  // Neck
  c.rect(14, 24 + yOff, 4, 4, skinShadow);
  // Chibi round head
  c.ellipse(16, 17 + yOff, 8.5, 8, skin);
  c.ellipse(18, 19 + yOff, 6, 5.5, skin);
  // Rosy cheeks
  c.px(10, 19 + yOff, '#f28482'); c.px(11, 19 + yOff, '#f28482');
  c.px(21, 19 + yOff, '#f28482'); c.px(22, 19 + yOff, '#f28482');
  // Friendly eyes + white sparkle
  c.rect(12, 16 + yOff, 2, 3, '#1a141c'); c.px(12, 16 + yOff, '#ffffff');
  c.rect(18, 16 + yOff, 2, 3, '#1a141c'); c.px(18, 16 + yOff, '#ffffff');
  // Warm smile
  c.hline(14, 21 + yOff, 4, '#8d4b46');
  // Hair cap
  c.ellipse(16, 11 + yOff, 8.5, 4.5, hair);
  c.rect(7, 11 + yOff, 2, 6, hair);
  c.rect(23, 11 + yOff, 2, 6, hair);
}

function buildCustomers() {
  const dir = path.join(OUT_ROOT, 'customers');

  const customers = {
    office_worker(c) {
      drawBaseCharacter(c, { shirt: '#90e0ef', shirtShadow: '#48bfe3', hair: '#1d1e2c' });
      // White collar + navy tie
      c.rect(13, 27, 6, 2, '#ffffff');
      c.rect(15, 29, 2, 8, '#1d3557');
      // Glasses!
      c.rect(10, 15, 5, 4, '#1d3557'); c.rect(11, 16, 3, 2, '#d8f3fc');
      c.rect(17, 15, 5, 4, '#1d3557'); c.rect(18, 16, 3, 2, '#d8f3fc');
      c.hline(15, 16, 2, '#1d3557');
      c.px(12, 17, '#1a141c'); c.px(19, 17, '#1a141c');
    },

    elderly(c) {
      drawBaseCharacter(c, { shirt: '#2a9d8f', shirtShadow: '#1e7369', hair: '#ced4da' });
      // Silver hair bun at top
      c.circle(16, 8, 3.5, '#dee2e6');
      // Traditional Vietnamese conical hat (Nón Lá) on back/tilted behind head!
      for (let i = 0; i < 6; i++) {
        c.hline(16 - 4 - i * 2, 4 + i, 9 + i * 4, i % 2 === 0 ? '#f4d35e' : '#e0b341');
      }
      // Button placket on áo bà ba
      c.vline(16, 28, 9, '#f8f9fa');
    },

    family(c) {
      // Mother slightly left
      drawBaseCharacter(c, { shirt: '#f4a261', shirtShadow: '#e76f51', hair: '#2b1c17' });
      // Long hair sides
      c.rect(6, 14, 3, 14, '#2b1c17');
      c.rect(23, 14, 3, 14, '#2b1c17');
      // Cute little kid peeking bottom-right!
      c.circle(25, 29, 4.5, '#f5c7a3');
      c.ellipse(25, 26, 4.5, 2.2, '#e63946'); // red cap!
      c.hline(25, 26, 5, '#c1121f');
      c.px(23, 29, '#1a141c'); c.px(26, 29, '#1a141c');
      c.rect(22, 33, 6, 5, '#e63946');
    },

    shipper(c) {
      drawBaseCharacter(c, { shirt: '#2d9348', shirtShadow: '#1b6630', hair: '#1d1e2c' });
      // White racing stripes on green jacket
      c.vline(11, 28, 10, '#ffffff');
      c.vline(20, 28, 10, '#ffffff');
      // Iconic bright green Vietnamese delivery helmet (sits cleanly above eyes!)
      c.ellipse(16, 9, 9.5, 5.2, '#2ec459');
      c.ellipse(16, 8, 8, 3.6, '#52e076');
      c.hline(8, 12, 16, '#1b6630'); // visor rim
      c.rect(11, 9, 10, 2, '#1d3557'); // dark visor flipped up
      c.px(16, 6, '#ffffff'); // helmet logo dot
    },

    tourist(c) {
      drawBaseCharacter(c, { shirt: '#f77f00', shirtShadow: '#d62828', hair: '#8d5524' });
      // Tropical shirt dots
      c.px(11, 31, '#fcbf49'); c.px(18, 33, '#52b768'); c.px(13, 35, '#fcbf49');
      // Tan bucket sun hat
      c.ellipse(16, 11, 11, 2.8, '#d4a373');
      c.rect(10, 6, 12, 5, '#e6ccb2');
      c.hline(10, 10, 12, '#2a9d8f'); // hat band
      // Cool dark sunglasses
      c.rect(10, 15, 5, 3, '#1a1a2e'); c.px(11, 16, '#90e0ef');
      c.rect(17, 15, 5, 3, '#1a1a2e'); c.px(18, 16, '#90e0ef');
      c.hline(15, 16, 2, '#1a1a2e');
      // Retro camera around neck!
      c.line(12, 26, 14, 31, '#2b2d42');
      c.line(20, 26, 18, 31, '#2b2d42');
      c.rect(13, 30, 6, 5, '#343a40');
      c.circle(16, 32, 1.5, '#90e0ef');
    },

    food_blogger(c) {
      drawBaseCharacter(c, { shirt: '#457b9d', shirtShadow: '#1d3557', hair: '#4a2c2a' });
      // Trendy amber inner top + denim jacket
      c.rect(13, 28, 6, 10, '#fca311');
      // Hair highlight
      c.hline(12, 9, 6, '#7f4f24');
      // Holding up glowing smartphone on right!
      c.rect(24, 18, 5, 9, '#2b2d42');
      c.rect(25, 19, 3, 7, '#a8dadc');
      // Golden flash sparkle above phone!
      c.px(26, 15, '#ffd166');
      c.px(25, 16, '#fff3b0'); c.px(27, 16, '#fff3b0');
      c.px(26, 17, '#ffd166');
    },
  };

  for (const [id, drawFn] of Object.entries(customers)) {
    const c = new PixelCanvas(32, 40);
    drawFn(c);
    c.outline('#1c1418');
    c.save(path.join(dir, `${id}.png`), 3);
  }
  console.log(`✓ Generated ${Object.keys(customers).length} Vietnamese customer sprites -> ${dir}`);
}

// ---- COZY 16-BIT PIXEL ART BACKGROUND: SÀI GÒN NIGHT STREET STALL (320x180 -> 960x540) ----

function buildSaigonBackground() {
  const W = 320, H = 180;
  const c = new PixelCanvas(W, H);

  // 1. Deep night sky gradient (top 0..75)
  const skyBands = ['#111326', '#151933', '#1a2142', '#222b52', '#2c3259'];
  for (let y = 0; y < 80; y++) {
    const col = skyBands[Math.min(skyBands.length - 1, Math.floor(y / 16))];
    c.hline(0, y, W, col);
  }

  // Twinkling pixel stars
  const stars = [
    [18, 12], [52, 8], [95, 15], [142, 7], [188, 14], [234, 9], [285, 12], [305, 22], [74, 24], [212, 21],
  ];
  for (const [sx, sy] of stars) {
    c.px(sx, sy, '#fff3b0');
  }

  // 2. Distant Saigon shophouse silhouettes with glowing warm windows
  const buildings = [
    [0, 28, 42], [42, 18, 36], [78, 32, 46], [124, 22, 40],
    [164, 26, 48], [212, 16, 38], [250, 30, 40], [290, 20, 30],
  ];
  for (const [bx, topY, bw] of buildings) {
    c.rect(bx, topY, bw, 80 - topY, '#17192d');
    c.hline(bx, topY, bw, '#25294a');
    // Warm lit windows
    for (let wy = topY + 6; wy < 62; wy += 10) {
      for (let wx = bx + 5; wx < bx + bw - 8; wx += 9) {
        if ((wx * 7 + wy * 3) % 5 !== 0) {
          c.rect(wx, wy, 5, 6, (wx + wy) % 2 === 0 ? '#fca31166' : '#ffd16644');
        }
      }
    }
  }

  // 3. Striped rustic street-stall canopy awning right under top HUD (y = 17..26)
  for (let x = 0; x < W; x += 16) {
    const isRed = (x / 16) % 2 === 0;
    c.rect(x, 17, 16, 8, isRed ? '#8d2b24' : '#c9a66b');
    c.rect(x, 25, 16, 2, isRed ? '#5c1a16' : '#9c7d48');
  }

  // 4. String of glowing Vietnamese red & gold lanterns hanging below awning!
  for (let x = 0; x < W; x++) {
    const sag = Math.round(Math.sin((x / W) * Math.PI) * 9);
    c.px(x, 28 + sag, '#100c14');
  }
  const lanternXs = [26, 74, 126, 160, 194, 246, 294];
  for (let i = 0; i < lanternXs.length; i++) {
    const lx = lanternXs[i];
    const ly = 29 + Math.round(Math.sin((lx / W) * Math.PI) * 9);
    const isRed = i % 2 === 0;
    c.circle(lx, ly + 4, 10, isRed ? '#e85d0422' : '#fca31122');
    c.circle(lx, ly + 4, 6, isRed ? '#e85d0444' : '#fca31144');
    c.ellipse(lx, ly + 4, 3.6, 4.5, isRed ? '#d62828' : '#f4a261');
    c.ellipse(lx, ly + 4, 2, 3.5, isRed ? '#f77f00' : '#ffe066');
    c.hline(lx - 2, ly - 1, 5, '#23171b');
    c.hline(lx - 2, ly + 9, 5, '#23171b');
    c.vline(lx, ly + 10, 2, '#fca311');
  }

  // 5. Warm counter backdrop & rustic wooden serving ledge right under customers (y = 62..68)
  c.rect(0, 62, W, 3, '#c89b6e'); // bright serving counter top edge
  c.rect(0, 65, W, 3, '#8c5a2b'); // serving counter front lip

  // 6. Warm wooden kitchen workspace where cooking stations sit (y = 68..128)
  c.rect(0, 68, W, 62, '#34231c');
  for (let y = 76; y < 130; y += 10) {
    c.hline(0, y, W, '#271a14');
  }
  // Subtle wood grain vertical joints
  for (let y = 68; y < 130; y += 10) {
    const off = ((y - 68) / 10) % 2 === 0 ? 12 : 34;
    for (let x = off; x < W; x += 48) {
      c.vline(x, y, 10, '#271a14');
    }
  }

  // 7. Dark lower menu/recipe bar shelf (y = 130..180)
  c.rect(0, 130, W, 2, '#7f4f24');
  c.rect(0, 132, W, 48, '#1b1726');

  const outPath = path.join(OUT_ROOT, 'backgrounds', 'saigon_night.png');
  c.save(outPath, 3);
  console.log(`✓ Generated Sài Gòn night pixel-art background -> ${outPath}`);
}

// ---- Run all generators ----
buildDishes();
buildStations();
buildCustomers();
buildSaigonBackground();
console.log('\n🎉 All pixel art sprites generated successfully!');
