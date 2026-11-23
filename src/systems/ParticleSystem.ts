// ============================================================
// ParticleSystem — Juicy 60fps Kitchen & Minigame Visual FX
// Steam, fire embers, blade sparks, spice rain, liquid splashes,
// arcing gold coins, starbursts, floating popups & screen shake
// ============================================================

import { randFloat, randPick } from '../utils/math';

export type ParticleKind =
  | 'circle'
  | 'smoke'
  | 'star'
  | 'ring'
  | 'confetti'
  | 'coin'
  | 'text';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  endSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  text?: string;
  targetX?: number;
  targetY?: number;
}

const MAX_PARTICLES = 420;

export class ParticleSystem {
  private particles: Particle[] = [];
  private shakeTime = 0;
  private shakeIntensity = 0;

  clear(): void {
    this.particles.length = 0;
    this.shakeTime = 0;
    this.shakeIntensity = 0;
  }

  /** Trigger subtle screen shake */
  shake(intensity = 5, duration = 0.2): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  /** Get current camera shake offset */
  getShakeOffset(): { x: number; y: number } {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const mag = this.shakeIntensity * (this.shakeTime / 0.25);
    return {
      x: (Math.random() - 0.5) * 2 * mag,
      y: (Math.random() - 0.5) * 2 * mag,
    };
  }

  private push(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  // ---- Ambient Atmosphere FX ----

  /** Silky rising steam curl from hot soup pots / grill */
  emitSteam(x: number, y: number, count = 1): void {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: 'smoke',
        x: x + randFloat(-14, 14),
        y: y + randFloat(-4, 4),
        vx: randFloat(-10, 10),
        vy: randFloat(-38, -20),
        gravity: -6,
        drag: 0.99,
        size: randFloat(4, 7),
        endSize: randFloat(14, 22),
        alpha: randFloat(0.22, 0.38),
        life: 0,
        maxLife: randFloat(0.9, 1.4),
        color: '#ffffff',
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  /** Warm drifting golden lantern firefly / bokeh dust */
  emitLanternDust(x: number, y: number): void {
    this.push({
      kind: 'circle',
      x,
      y,
      vx: randFloat(-12, 12),
      vy: randFloat(-18, -6),
      gravity: 0,
      drag: 0.995,
      size: randFloat(1.8, 3.6),
      endSize: 0.5,
      alpha: randFloat(0.35, 0.7),
      life: 0,
      maxLife: randFloat(1.8, 3.2),
      color: randPick(['#ffd166', '#fca311', '#fff3b0']),
      rotation: 0,
      rotSpeed: 0,
    });
  }

  // ---- Cooking & Minigame Action FX ----

  /** Bursting orange & yellow stove/charcoal fire sparks */
  emitFireSparks(x: number, y: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const angle = randFloat(-Math.PI * 0.9, -Math.PI * 0.1);
      const speed = randFloat(60, 190);
      this.push({
        kind: 'circle',
        x: x + randFloat(-22, 22),
        y: y + randFloat(-6, 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 160,
        drag: 0.96,
        size: randFloat(3, 6),
        endSize: 0.5,
        alpha: 1,
        life: 0,
        maxLife: randFloat(0.35, 0.75),
        color: randPick(['#ffba08', '#f48c06', '#e85d04', '#fff3b0']),
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  /** Gleaming blade sparks + juicy specks along a knife slice or cut */
  emitSliceSparks(x: number, y: number, accentColor = '#fff3b0', count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = randFloat(0, Math.PI * 2);
      const speed = randFloat(50, 165);
      this.push({
        kind: i % 3 === 0 ? 'star' : 'circle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        gravity: 240,
        drag: 0.95,
        size: randFloat(3, 7),
        endSize: 1,
        alpha: 1,
        life: 0,
        maxLife: randFloat(0.3, 0.58),
        color: i % 2 === 0 ? '#ffffff' : accentColor,
        rotation: randFloat(0, Math.PI),
        rotSpeed: randFloat(-8, 8),
      });
    }
  }

  /** Fresh green sparkle burst when picking herbs */
  emitLeafBurst(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = randFloat(0, Math.PI * 2);
      const speed = randFloat(45, 135);
      this.push({
        kind: i % 3 === 0 ? 'star' : 'confetti',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        gravity: 170,
        drag: 0.95,
        size: randFloat(4, 8),
        endSize: 1,
        alpha: 1,
        life: 0,
        maxLife: randFloat(0.35, 0.65),
        color: randPick(['#52b788', '#80ed99', '#2d9348', '#d8f3fc']),
        rotation: randFloat(0, Math.PI * 2),
        rotSpeed: randFloat(-7, 7),
      });
    }
  }

  /** Colorful seasoning flecks raining into a bowl */
  emitSpiceRain(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      this.push({
        kind: i % 4 === 0 ? 'star' : 'circle',
        x: x + randFloat(-32, 32),
        y: y + randFloat(-38, -14),
        vx: randFloat(-28, 28),
        vy: randFloat(25, 95),
        gravity: 190,
        drag: 0.98,
        size: randFloat(3, 6),
        endSize: 2,
        alpha: 1,
        life: 0,
        maxLife: randFloat(0.4, 0.72),
        color: i % 3 === 0 ? '#fff3b0' : color,
        rotation: randFloat(0, Math.PI),
        rotSpeed: randFloat(-6, 6),
      });
    }
  }

  /** Sparkling liquid splash droplets during pouring */
  emitLiquidSplash(x: number, y: number, color: string, count = 4): void {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: 'circle',
        x: x + randFloat(-14, 14),
        y,
        vx: randFloat(-55, 55),
        vy: randFloat(-75, -25),
        gravity: 260,
        drag: 0.97,
        size: randFloat(2.5, 5),
        endSize: 1,
        alpha: 0.95,
        life: 0,
        maxLife: randFloat(0.25, 0.48),
        color: i === 0 ? '#ffffff' : color,
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  /** Dazzling starburst + expanding shockwave ring for PERFECT / dish completion */
  emitStarburst(x: number, y: number, color = '#ffd166', count = 18): void {
    // Expanding glow ring
    this.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      size: 10,
      endSize: 76,
      alpha: 0.9,
      life: 0,
      maxLife: 0.45,
      color,
      rotation: 0,
      rotSpeed: 0,
    });

    const palette = [color, '#fff3b0', '#ffffff', '#4CAF50', '#f48c06'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + randFloat(-0.15, 0.15);
      const speed = randFloat(75, 220);
      this.push({
        kind: i % 2 === 0 ? 'star' : 'confetti',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        gravity: 160,
        drag: 0.94,
        size: randFloat(5, 10),
        endSize: 1.5,
        alpha: 1,
        life: 0,
        maxLife: randFloat(0.45, 0.85),
        color: randPick(palette),
        rotation: randFloat(0, Math.PI * 2),
        rotSpeed: randFloat(-9, 9),
      });
    }
  }

  /** Golden coins arcing from served customer toward top-left money counter! */
  emitCoinShower(fromX: number, fromY: number, toX = 64, toY = 26, count = 7): void {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: 'coin',
        x: fromX + randFloat(-18, 18),
        y: fromY + randFloat(-14, 14),
        vx: randFloat(-110, 110),
        vy: randFloat(-140, -60),
        gravity: 0,
        drag: 0.94,
        size: 11,
        endSize: 9,
        alpha: 1,
        life: -i * 0.04, // staggered launch!
        maxLife: 0.72,
        color: '#ffd166',
        rotation: 0,
        rotSpeed: 10,
        targetX: toX,
        targetY: toY,
      });
    }
  }

  /** Red anger puffs when customer leaves or wrong click */
  emitAngryPuff(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const angle = randFloat(0, Math.PI * 2);
      const speed = randFloat(35, 100);
      this.push({
        kind: 'smoke',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        gravity: -20,
        drag: 0.94,
        size: randFloat(5, 9),
        endSize: randFloat(12, 18),
        alpha: 0.75,
        life: 0,
        maxLife: randFloat(0.4, 0.7),
        color: i % 2 === 0 ? '#e63946' : '#ff758f',
        rotation: 0,
        rotSpeed: 0,
      });
    }
  }

  /** Floating rising text popup (e.g. "+68đ ⭐ PERFECT!") */
  emitFloatingText(x: number, y: number, text: string, color = '#4CAF50', size = 20): void {
    this.push({
      kind: 'text',
      x,
      y,
      vx: 0,
      vy: -56,
      gravity: 16,
      drag: 0.98,
      size,
      endSize: size,
      alpha: 1,
      life: 0,
      maxLife: 1.25,
      color,
      rotation: 0,
      rotSpeed: 0,
      text,
    });
  }

  // ---- Update & Render ----

  update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life < 0) continue; // staggered delay

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.kind === 'coin' && p.targetX !== undefined && p.targetY !== undefined) {
        // Burst outward briefly, then magnetize smoothly into money counter!
        const t = p.life / p.maxLife;
        if (t < 0.28) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= p.drag;
          p.vy *= p.drag;
        } else {
          const pull = Math.min(1, dt * (6 + t * 14));
          p.x += (p.targetX - p.x) * pull;
          p.y += (p.targetY - p.y) * pull;
        }
        p.rotation += p.rotSpeed * dt;
      } else {
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();
    for (const p of this.particles) {
      if (p.life < 0) continue;
      const t = Math.min(1, p.life / p.maxLife);
      const curSize = p.size + (p.endSize - p.size) * t;
      const curAlpha = p.alpha * (p.kind === 'text' ? (t < 0.7 ? 1 : (1 - t) / 0.3) : 1 - t);
      if (curAlpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = curAlpha;

      switch (p.kind) {
        case 'circle':
        case 'smoke': {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, curSize), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.beginPath();
          ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 5 * (1 - t));
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          this.draw4Star(ctx, curSize, p.color);
          break;
        }
        case 'confetti': {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-curSize / 2, -curSize * 0.3, curSize, curSize * 0.6);
          break;
        }
        case 'coin': {
          const squeeze = Math.max(0.3, Math.abs(Math.cos(p.rotation)));
          ctx.translate(p.x, p.y);
          ctx.scale(squeeze, 1);
          ctx.beginPath();
          ctx.arc(0, 0, curSize, 0, Math.PI * 2);
          ctx.fillStyle = '#fca311';
          ctx.fill();
          ctx.strokeStyle = '#fff3b0';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#7f4f24';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₫', 0, 0.5);
          break;
        }
        case 'text': {
          ctx.font = `bold ${Math.round(curSize)}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillText(p.text ?? '', p.x, p.y + 2);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', p.x, p.y);
          break;
        }
      }

      ctx.restore();
    }
    ctx.restore();
  }

  private draw4Star(ctx: CanvasRenderingContext2D, r: number, color: string): void {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? r : r * 0.38;
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}
