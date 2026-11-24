// ============================================================
// MarketRunnerScene — 🏃 Subway Surfers-Style Emergency Market Dash!
// Appears randomly between levels (or via quick-play on Map) when
// ingredients run low: sprint down a 3-lane Saigon market street,
// collect urgent ingredients & dodge scooters / barriers / baskets!
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { clamp, formatMoney, lerp, randInt, randPick } from '../utils/math';
import { ParticleSystem } from '../systems/ParticleSystem';

interface RunnerEntity {
  lane: 0 | 1 | 2;
  z: number;           // 0 (horizon) -> 1 (player) -> 1.18 (offscreen)
  speed: number;
  kind: 'ingredient' | 'obstacle';
  spriteKey: string;
  label: string;
  resolved: boolean;
}

const COLLECTIBLE_POOL = [
  { spriteKey: 'prop_onion', label: 'Hành tím' },
  { spriteKey: 'prop_garlic', label: 'Tỏi thơm' },
  { spriteKey: 'prop_chili', label: 'Ớt đỏ' },
  { spriteKey: 'prop_lime', label: 'Chanh tươi' },
  { spriteKey: 'prop_carrot', label: 'Cà rốt' },
  { spriteKey: 'prop_mango', label: 'Xoài chín' },
  { spriteKey: 'station_meat', label: 'Thịt tươi' },
  { spriteKey: 'station_veggie', label: 'Rau thơm' },
];

const OBSTACLE_POOL = [
  { spriteKey: 'prop_scooter', label: 'Xe máy!', speedBoost: 1.18 },
  { spriteKey: 'prop_barrier', label: 'Rào chắn!', speedBoost: 0.96 },
  { spriteKey: 'prop_basket', label: 'Thúng hàng!', speedBoost: 0.96 },
];

export class MarketRunnerScene implements Scene {
  private engine: Engine;
  private onComplete: (bonusStock: number) => void;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'running' | 'summary' = 'intro';
  private elapsed = 0;
  private timeRemaining = 22;
  private roadScroll = 0;

  // Player state (3 lanes: 0 = Left, 1 = Center, 2 = Right)
  private lane: 0 | 1 | 2 = 1;
  private visualLane = 1;
  private hopTimer = 0;
  private invulnTimer = 0;
  private hearts = 3;

  // Progress & rewards
  private collected = 0;
  private targetCollect = 10;
  private coinsEarned = 0;
  private entities: RunnerEntity[] = [];
  private spawnTimer = 0.55;

  // Controls
  private swipeStart: Vec2 | null = null;
  private leftBtn: Rect = { x: 24, y: 424, width: 122, height: 92 };
  private rightBtn: Rect = { x: 814, y: 424, width: 122, height: 92 };
  private actionBtn: Rect = { x: 340, y: 432, width: 280, height: 56 };

  private removeDown?: () => void;
  private removeUp?: () => void;
  private removeClick?: () => void;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(engine: Engine, onComplete: (bonusStock: number) => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('action');
    this.phase = 'intro';
    this.elapsed = 0;
    this.timeRemaining = 22;
    this.lane = 1;
    this.visualLane = 1;
    this.hearts = 3;
    this.collected = 0;
    this.coinsEarned = 0;
    this.entities = [];
    this.particles.clear();

    this.removeDown = this.engine.input.onDown((pos) => {
      if (this.phase !== 'running') return;
      this.swipeStart = pos;
    });

    this.removeUp = this.engine.input.onUp((pos) => {
      if (this.phase !== 'running' || !this.swipeStart) return;
      const dx = pos.x - this.swipeStart.x;
      this.swipeStart = null;
      if (Math.abs(dx) >= 34) {
        this.shiftLane(dx < 0 ? -1 : 1);
      }
    });

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.phase = 'running';
          this.particles.emitStarburst(480, 280, '#ffd166', 20);
        }
        return;
      }

      if (this.phase === 'summary') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.4) {
          const bonusStock = Math.max(1, Math.min(5, Math.ceil(this.collected / 2)));
          if (this.coinsEarned > 0) {
            this.engine.save.addMoney(this.coinsEarned);
          }
          this.onComplete(bonusStock);
        }
        return;
      }

      // Running tap controls: Left/Right buttons OR left/right side of screen!
      if (InputManager.hitTest(pos, this.leftBtn, 16) || pos.x < 340) {
        this.shiftLane(-1);
      } else if (InputManager.hitTest(pos, this.rightBtn, 16) || pos.x > 620) {
        this.shiftLane(1);
      }
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        this.phase = 'running';
        return;
      }
      if (this.phase !== 'running') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.shiftLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.shiftLane(1);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  exit(): void {
    this.removeDown?.();
    this.removeUp?.();
    this.removeClick?.();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  private shiftLane(delta: -1 | 1): void {
    const next = clamp(this.lane + delta, 0, 2) as 0 | 1 | 2;
    if (next !== this.lane) {
      this.lane = next;
      this.hopTimer = 0.22;
      this.engine.audio.playSfx('pop');
      const px = this.laneToX(this.visualLane, 1);
      this.particles.emitSliceSparks(px, 456, '#ffd166', 6);
    }
  }

  private laneToX(laneVal: number, perspective: number): number {
    return 480 + (laneVal - 1) * lerp(36, 195, perspective);
  }

  private spawnRow(): void {
    // Always guarantee at least 1 open safe lane (no impossible 3-lane walls!)
    const lanes: Array<0 | 1 | 2> = [0, 1, 2];
    const ingLane = randPick(lanes);
    const colSpec = randPick(COLLECTIBLE_POOL);

    const baseSpeed = lerp(0.56, 0.78, 1 - this.timeRemaining / 22);

    this.entities.push({
      lane: ingLane,
      z: 0.04,
      speed: baseSpeed,
      kind: 'ingredient',
      spriteKey: colSpec.spriteKey,
      label: colSpec.label,
      resolved: false,
    });

    // Spawn 1 or 2 obstacles in the OTHER lanes
    const otherLanes = lanes.filter((l) => l !== ingLane);
    const obstacleCount = Math.random() < 0.52 ? 2 : 1;
    for (let i = 0; i < obstacleCount; i++) {
      const obsLane = obstacleCount === 2 ? otherLanes[i] : randPick(otherLanes);
      const obsSpec = randPick(OBSTACLE_POOL);
      this.entities.push({
        lane: obsLane,
        z: 0.04,
        speed: baseSpeed * obsSpec.speedBoost,
        kind: 'obstacle',
        spriteKey: obsSpec.spriteKey,
        label: obsSpec.label,
        resolved: false,
      });
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);

    if (this.phase !== 'running') return;

    this.roadScroll = (this.roadScroll + dt * 2.8) % 1;
    this.visualLane += (this.lane - this.visualLane) * Math.min(1, dt * 16);
    if (this.hopTimer > 0) this.hopTimer = Math.max(0, this.hopTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishRun();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnRow();
      this.spawnTimer = lerp(0.88, 0.62, 1 - this.timeRemaining / 22);
    }

    // Advance all road objects toward camera
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      ent.z += ent.speed * dt;

      // Hit / Collect check right in player's collision band (z: 0.86..1.03)
      if (!ent.resolved && ent.z >= 0.86 && ent.z <= 1.03) {
        const sameLane = Math.abs(this.visualLane - ent.lane) < 0.45;
        if (sameLane) {
          ent.resolved = true;
          const ex = this.laneToX(ent.lane, ent.z * ent.z);
          const ey = lerp(128, 456, ent.z * ent.z);

          if (ent.kind === 'ingredient') {
            this.collected++;
            const bonus = randInt(10, 16);
            this.coinsEarned += bonus;
            this.engine.audio.playSfx('coin');
            this.particles.emitStarburst(ex, ey, '#ffd166', 14);
            this.particles.emitFloatingText(ex, ey - 24, `+1 ${ent.label}!`, '#80ed99', 16);
            if (this.collected >= this.targetCollect) {
              this.finishRun();
              return;
            }
          } else if (this.invulnTimer <= 0) {
            this.hearts--;
            this.invulnTimer = 1.05;
            this.engine.audio.playSfx('error');
            this.particles.emitAngryPuff(ex, ey);
            this.particles.shake(8, 0.28);
            this.particles.emitFloatingText(ex, ey - 26, `💥 Đụng ${ent.label}`, '#E63946', 18);
            if (this.hearts <= 0) {
              this.finishRun();
              return;
            }
          }
        }
      }

      if (ent.z > 1.16 || (ent.resolved && ent.kind === 'ingredient')) {
        this.entities.splice(i, 1);
      }
    }
  }

  private finishRun(): void {
    this.phase = 'summary';
    this.elapsed = 0;
    this.engine.audio.playSfx(this.hearts > 0 ? 'win' : 'lose');
    this.particles.emitStarburst(480, 260, '#ffd166', 28);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Vibrant 16-bit Pixel Art 3-Lane Vietnamese Market Background
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_market_runner')) {
      ctx.drawImage(this.engine.assets.getImage('bg_market_runner'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#25263a';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Animated scrolling speed lane markers to give authentic Subway Surfers forward velocity!
    ctx.save();
    for (const divider of [-0.5, 0.5]) {
      for (let step = 0; step < 7; step++) {
        const z0 = ((step / 7) + this.roadScroll / 7) % 1;
        const z1 = Math.min(1, z0 + 0.06);
        const p0 = z0 * z0;
        const p1 = z1 * z1;
        const x0 = 480 + divider * lerp(72, 390, p0);
        const y0 = lerp(128, 540, p0);
        const x1 = 480 + divider * lerp(72, 390, p1);
        const y1 = lerp(128, 540, p1);
        ctx.strokeStyle = `rgba(255, 243, 176, ${0.25 + p0 * 0.65})`;
        ctx.lineWidth = 2 + p0 * 4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 3. Draw road entities sorted back-to-front (painter's algorithm)
    const sorted = [...this.entities].sort((a, b) => a.z - b.z);
    for (const ent of sorted) {
      const p = clamp(ent.z * ent.z, 0, 1.3);
      const x = this.laneToX(ent.lane, p);
      const y = lerp(128, 456, p);
      const size = lerp(24, 92, p);

      ctx.save();
      // Ground shadow / glowing pickup halo
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.36, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fillStyle =
        ent.kind === 'ingredient'
          ? 'rgba(76, 175, 80, 0.48)'
          : 'rgba(230, 57, 70, 0.42)';
      ctx.fill();

      if (ent.kind === 'ingredient') {
        // Golden collectible aura
        const bob = Math.sin(this.elapsed * 9 + ent.lane) * 5 * p;
        ctx.beginPath();
        ctx.arc(x, y + bob, size * 0.48, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#80ed99';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.engine.assets.hasImage(ent.spriteKey)) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.engine.assets.getImage(ent.spriteKey), x - size / 2, y - size / 2 + bob, size, size);
        }
      } else {
        // Obstacle sprite (scooter / barrier / basket)
        if (this.engine.assets.hasImage(ent.spriteKey)) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.engine.assets.getImage(ent.spriteKey), x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.restore();
    }

    // 4. Player Runner: Mèo Vàng Phụ Bếp sprinting forward!
    const px = this.laneToX(this.visualLane, 1);
    const runBounce = Math.abs(Math.sin(this.elapsed * 14)) * -8;
    const hopArc = this.hopTimer > 0 ? Math.sin((this.hopTimer / 0.22) * Math.PI) * -32 : 0;
    const blinkHide = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 16) % 2 === 0;

    if (!blinkHide) {
      ctx.save();
      // Runner shadow
      ctx.beginPath();
      ctx.ellipse(px, 492, 42, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // Golden speed aura beneath Mèo Vàng
      ctx.beginPath();
      ctx.ellipse(px, 488, 48, 15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (this.engine.assets.hasImage('npc_cat_golden')) {
        ctx.imageSmoothingEnabled = true;
        const img = this.engine.assets.getImage('npc_cat_golden');
        const dh = 98;
        const dw = (img.width / img.height) * dh;
        ctx.drawImage(img, px - dw / 2, 404 + runBounce + hopArc, dw, dh);
      }

      // Little shopping basket badge beside Mèo Vàng
      ctx.font = '26px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧺', px + 40, 458 + runBounce + hopArc);
      ctx.restore();
    }

    // 5. Top HUD Bar
    roundRect(ctx, 0, 0, W, 56, 0);
    ctx.fillStyle = 'rgba(12, 14, 28, 0.78)';
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🏃 CHẠY CHỢ MUA NGUYÊN LIỆU GẤP!', 18, 28, '#FCA311');

    // Progress bar center
    drawProgressBar(ctx, 402, 16, 210, 22, this.collected / this.targetCollect, '#4CAF50');
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`🧺 ${this.collected} / ${this.targetCollect} món`, 507, 27);

    // Hearts & timer right
    ctx.textAlign = 'right';
    ctx.font = '20px "Segoe UI"';
    ctx.fillText('❤️'.repeat(this.hearts) + '🖤'.repeat(3 - this.hearts), W - 120, 28);
    ctx.font = 'bold 20px monospace';
    drawTextShadow(ctx, `⏱ ${Math.ceil(this.timeRemaining)}s`, W - 18, 28, this.timeRemaining < 6 ? '#E63946' : '#fff');

    // 6. Big translucent Mobile Touch Controls (Left / Right) during run
    if (this.phase === 'running') {
      for (const [btn, label] of [[this.leftBtn, '◀ TRÁI'], [this.rightBtn, 'PHẢI ▶']] as const) {
        roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 18);
        ctx.fillStyle = 'rgba(15, 18, 36, 0.62)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(252, 163, 17, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
        drawTextShadow(ctx, label, btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');
      }
    }

    // 7. Particles
    this.particles.render(ctx);

    // 8. Intro / Summary Modal Cards
    if (this.phase === 'intro') {
      this.renderOverlayCard(
        ctx,
        '🚨 KHẨN CẤP: SẮP HẾT NGUYÊN LIỆU!',
        '#E85D04',
        '👑 Vằn Bếp Trưởng: "Kho rau thịt sắp cạn rồi! Mèo Vàng phóng ngay ra Chợ Bến Thành mua bổ sung gấp!!"',
        '• Vuốt TRÁI / PHẢI (hoặc bấm 2 nút mũi tên / phím ← →) để chuyển 3 làn đường\n• Gom 10 nguyên liệu tươi xanh (halo xanh lá) để cộng kho dự trữ cho màn tới\n• Né xe máy 🛵, rào chắn 🚧 & thúng hàng 🧺 trên đường chợ!',
        '🏃 CHẠY RA CHỢ NGAY!',
      );
    } else if (this.phase === 'summary') {
      const bonusStock = Math.max(1, Math.min(5, Math.ceil(this.collected / 2)));
      this.renderOverlayCard(
        ctx,
        this.collected >= this.targetCollect ? '🎉 GOM ĐẦY RỔ NGUYÊN LIỆU!' : '🧺 VỀ QUÁN KỊP GIỜ!',
        '#2d9348',
        `🐾 Mèo Vàng: "Hộc hộc... Em gom được ${this.collected} bó nguyên liệu tươi roi rói + ${formatMoney(this.coinsEarned)} tiền thừa rồi đây!!"`,
        `🎁 Phần thưởng cho màn tiếp theo:\n• +${bonusStock} phần nguyên liệu cộng thẳng vào TẤT CẢ khay sơ chế!\n• +${formatMoney(this.coinsEarned)} tiền cộng vào quỹ quán!`,
        '🍜 QUAY LẠI QUÁN NẤU NGAY!',
      );
    }

    ctx.restore();
  }

  private renderOverlayCard(
    ctx: CanvasRenderingContext2D,
    title: string,
    accent: string,
    quote: string,
    body: string,
    btnText: string,
  ): void {
    const W = 960;
    const H = 540;
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, W, H);

    const cw = 660;
    const ch = 360;
    const cx = (W - cw) / 2;
    const cy = 74;

    roundRect(ctx, cx, cy, cw, ch, 20);
    ctx.fillStyle = '#1c1932';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cat boss portrait left
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage('npc_cat_boss');
      const dh = 128;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, cx + 22, cy + 72, dw, dh);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 25px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, W / 2, cy + 38, '#FCA311');

    // Quote box
    roundRect(ctx, cx + 150, cy + 72, cw - 174, 72, 12);
    ctx.fillStyle = 'rgba(252, 163, 17, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapText(ctx, quote, cx + 164, cy + 84, cw - 202, 20);

    // Body lines
    const lines = body.split('\n');
    let ly = cy + 168;
    ctx.font = '14.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    for (const line of lines) {
      ly = this.wrapText(ctx, line, cx + 154, ly, cw - 182, 22) + 4;
    }

    // Big button
    const btn = this.actionBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, btnText, btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number,
  ): number {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > maxW && line) {
        ctx.fillText(line.trim(), x, cy);
        line = w + ' ';
        cy += lh;
      } else {
        line = t;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, cy);
      cy += lh;
    }
    return cy;
  }
}
