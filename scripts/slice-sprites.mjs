#!/usr/bin/env node
// ============================================================
// Zero-dependency PNG sprite sheet slicer + chroma-key remover
// Reads any PNG (via sips conversion if needed), removes solid
// magenta background with flood-fill + anti-fringe cleanup,
// detects exact row/column gaps, crops each sprite cleanly,
// and saves crisp transparent RGBA PNGs.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

// ---- Pure-JS PNG Decoder (8-bit RGB / RGBA) ----

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePNG(buf) {
  // Verify PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error('Not a valid PNG file');
  }

  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];
  let offset = 8;

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const recon = Buffer.alloc(height * stride);

  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const byte = raw[inPos++];
      const a = x >= bpp ? recon[rowStart + x - bpp] : 0;
      const b = y > 0 ? recon[rowStart - stride + x] : 0;
      const c = (x >= bpp && y > 0) ? recon[rowStart - stride + x - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = byte; break;
        case 1: val = (byte + a) & 0xff; break;
        case 2: val = (byte + b) & 0xff; break;
        case 3: val = (byte + ((a + b) >> 1)) & 0xff; break;
        case 4: val = (byte + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`Unknown PNG filter: ${filter}`);
      }
      recon[rowStart + x] = val;
    }
  }

  // Convert to RGBA Uint8Array
  const rgba = new Uint8Array(width * height * 4);
  if (bpp === 4) {
    rgba.set(recon);
  } else {
    for (let i = 0, j = 0; i < recon.length; i += 3, j += 4) {
      rgba[j] = recon[i];
      rgba[j + 1] = recon[i + 1];
      rgba[j + 2] = recon[i + 2];
      rgba[j + 3] = 255;
    }
  }

  return { width, height, data: rgba };
}

// ---- Pure-JS PNG Encoder (8-bit RGBA) ----

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const outStart = y * (stride + 1);
    raw[outStart] = 0; // filter None
    const inStart = y * stride;
    raw.set(rgba.subarray(inStart, inStart + stride), outStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Load any image format (uses macOS sips to convert non-PNG or paletted PNG) ----

function loadImageRGBA(filePath) {
  const tmpPng = `/tmp/bep-viet-conv-${process.pid}-${Date.now()}.png`;
  try {
    // Convert via sips so JPEG/WebP/indexed PNG always becomes 8-bit RGB/RGBA PNG
    execFileSync('sips', ['-s', 'format', 'png', filePath, '--out', tmpPng], { stdio: 'ignore' });
    const buf = fs.readFileSync(tmpPng);
    return decodePNG(buf);
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  }
}

// ---- Chroma-Key Background Removal (Flood-fill + Edge De-fringe) ----

function removeMagentaBackground(img) {
  const { width, height, data } = img;
  const total = width * height;

  // Sample average corner background color
  const corners = [
    [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3],
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [cx, cy] of corners) {
    const idx = (cy * width + cx) * 4;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR /= 4; bgG /= 4; bgB /= 4;

  const isBgColor = (r, g, b) => {
    const dr = r - bgR, dg = g - bgG, db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < 85) return true;
    // Also catch strong magenta hues (high R & B, low G)
    const magentaExcess = Math.min(r, b) - g;
    if (magentaExcess > 75 && Math.abs(r - b) < 70 && g < 150) return true;
    return false;
  };

  // Flood fill from all 4 borders
  const visited = new Uint8Array(total);
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;

  const enqueue = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * 4;
    if (isBgColor(data[idx], data[idx + 1], data[idx + 2])) {
      visited[p] = 1;
      isBg[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  // Also clear interior pure-magenta holes (e.g., inside basket handles)
  for (let p = 0; p < total; p++) {
    if (isBg[p]) continue;
    const idx = p * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const dr = r - bgR, dg = g - bgG, db = b - bgB;
    if (Math.sqrt(dr * dr + dg * dg + db * db) < 48) {
      isBg[p] = 1;
    }
  }

  // Apply transparency
  for (let p = 0; p < total; p++) {
    if (isBg[p]) {
      data[p * 4 + 3] = 0;
    }
  }

  // De-fringe: pixels adjacent to transparent background with strong magenta tint
  for (let pass = 0; pass < 2; pass++) {
    const toClear = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        const idx = p * 4;
        if (data[idx + 3] === 0) continue;

        const hasTransNeighbor =
          data[(p - 1) * 4 + 3] === 0 ||
          data[(p + 1) * 4 + 3] === 0 ||
          data[(p - width) * 4 + 3] === 0 ||
          data[(p + width) * 4 + 3] === 0;

        if (!hasTransNeighbor) continue;

        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const magentaExcess = Math.min(r, b) - g;
        if (magentaExcess > 45 && Math.abs(r - b) < 75) {
          toClear.push(p);
        } else if (magentaExcess > 20) {
          // Suppress magenta color spill on outline edge
          const avgRB = (r + b) / 2;
          const spill = Math.max(0, avgRB - g);
          data[idx] = Math.max(0, Math.round(r - spill * 0.65));
          data[idx + 2] = Math.max(0, Math.round(b - spill * 0.65));
        }
      }
    }
    for (const p of toClear) {
      data[p * 4 + 3] = 0;
    }
  }
}

// ---- Find exact split valleys between rows and columns ----

function findSplitBounds(counts, count, parts) {
  // Find first and last non-zero index
  let start = 0;
  while (start < count && counts[start] <= 2) start++;
  let end = count - 1;
  while (end > start && counts[end] <= 2) end--;

  const span = end - start + 1;
  const step = span / parts;
  const cuts = [Math.max(0, start - 2)];

  for (let i = 1; i < parts; i++) {
    const ideal = Math.round(start + i * step);
    const searchRadius = Math.floor(step * 0.3);
    let bestPos = ideal;
    let bestVal = Infinity;
    for (let x = Math.max(0, ideal - searchRadius); x <= Math.min(count - 1, ideal + searchRadius); x++) {
      // Slight preference toward ideal center when tied (e.g., wide zero gaps)
      const score = counts[x] * 1000 + Math.abs(x - ideal);
      if (score < bestVal) {
        bestVal = score;
        bestPos = x;
      }
    }
    cuts.push(bestPos);
  }
  cuts.push(Math.min(count, end + 3));
  return cuts;
}

// ---- Resize & Center onto Square Canvas (pixel-art friendly area/nearest) ----

function cropAndCenter(img, x0, y0, x1, y1, outSize) {
  const { width, data } = img;

  // Find tight bounding box inside cell (ignoring isolated 1px speckles)
  let minX = x1, minY = y1, maxX = x0, maxY = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const out = new Uint8Array(outSize * outSize * 4);
  if (minX > maxX || minY > maxY) return out;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const pad = Math.round(outSize * 0.06);
  const avail = outSize - pad * 2;
  const scale = Math.min(avail / cw, avail / ch);
  const dstW = Math.max(1, Math.round(cw * scale));
  const dstH = Math.max(1, Math.round(ch * scale));
  const ox = Math.floor((outSize - dstW) / 2);
  const oy = Math.floor((outSize - dstH) / 2);

  // Box downsampling for crisp, clean pixel edges without jagged dropout
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = minY + (dy / dstH) * ch;
    const sy1 = minY + ((dy + 1) / dstH) * ch;
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = minX + (dx / dstW) * cw;
      const sx1 = minX + ((dx + 1) / dstW) * cw;

      const ix0 = Math.floor(sx0), ix1 = Math.max(ix0 + 1, Math.ceil(sx1));
      const iy0 = Math.floor(sy0), iy1 = Math.max(iy0 + 1, Math.ceil(sy1));

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      for (let sy = iy0; sy < iy1 && sy <= maxY; sy++) {
        for (let sx = ix0; sx < ix1 && sx <= maxX; sx++) {
          const idx = (sy * width + sx) * 4;
          const a = data[idx + 3];
          rSum += data[idx] * a;
          gSum += data[idx + 1] * a;
          bSum += data[idx + 2] * a;
          aSum += a;
          count++;
        }
      }

      const dstIdx = ((oy + dy) * outSize + (ox + dx)) * 4;
      const avgA = count > 0 ? aSum / count : 0;
      if (avgA > 64) {
        out[dstIdx] = Math.round(rSum / aSum);
        out[dstIdx + 1] = Math.round(gSum / aSum);
        out[dstIdx + 2] = Math.round(bSum / aSum);
        out[dstIdx + 3] = avgA > 180 ? 255 : Math.round(avgA);
      }
    }
  }

  return out;
}

// ---- Main Slicer ----

function sliceSheet({ inputPath, outDir, cols, rows, names, outSize = 128 }) {
  console.log(`Slicing ${path.basename(inputPath)} (${cols}x${rows}) -> ${outDir}`);
  const img = loadImageRGBA(inputPath);
  removeMagentaBackground(img);

  // Compute row/column foreground pixel density projections
  const colCounts = new Int32Array(img.width);
  const rowCounts = new Int32Array(img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 20) {
        colCounts[x]++;
        rowCounts[y]++;
      }
    }
  }

  const xCuts = findSplitBounds(colCounts, img.width, cols);
  const yCuts = findSplitBounds(rowCounts, img.height, rows);
  console.log('  xCuts:', xCuts, 'yCuts:', yCuts);

  fs.mkdirSync(outDir, { recursive: true });

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = names[idx++];
      if (!name) continue;
      const rgba = cropAndCenter(img, xCuts[c], yCuts[r], xCuts[c + 1], yCuts[r + 1], outSize);
      const png = encodePNG(outSize, outSize, rgba);
      const outFile = path.join(outDir, `${name}.png`);
      fs.writeFileSync(outFile, png);
      console.log(`  ✓ ${name}.png (${png.length} bytes)`);
    }
  }
}

// CLI entry: node scripts/slice-sprites.mjs <sheetPath> <outDir> <cols> <rows> <outSize> <commaSeparatedNames>
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [, , inputPath, outDir, colsStr, rowsStr, sizeStr, namesStr] = process.argv;
  if (!inputPath || !namesStr) {
    console.error('Usage: node slice-sprites.mjs <input> <outDir> <cols> <rows> <outSize> <name1,name2,...>');
    process.exit(1);
  }
  sliceSheet({
    inputPath,
    outDir,
    cols: Number(colsStr),
    rows: Number(rowsStr),
    outSize: Number(sizeStr) || 128,
    names: namesStr.split(','),
  });
}
