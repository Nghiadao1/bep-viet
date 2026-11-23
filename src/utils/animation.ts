// ============================================================
// Animation — Tweening and easing utilities
// ============================================================

// --- Easing functions (t: 0→1, returns 0→1) ---

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
} as const;

export type EasingName = keyof typeof Easing;

// --- Tween ---

interface TweenTarget {
  [key: string]: number;
}

export class Tween {
  private target: TweenTarget;
  private from: Record<string, number> = {};
  private to: Record<string, number>;
  private elapsed = 0;
  private duration: number;
  private easing: (t: number) => number;
  private onCompleteCb?: () => void;
  private _done = false;

  constructor(
    target: TweenTarget,
    to: Record<string, number>,
    durationMs: number,
    easing: EasingName = 'easeOutQuad',
  ) {
    this.target = target;
    this.to = to;
    this.duration = durationMs / 1000;
    this.easing = Easing[easing];

    // Snapshot start values
    for (const key of Object.keys(to)) {
      this.from[key] = target[key] ?? 0;
    }
  }

  onComplete(cb: () => void): this {
    this.onCompleteCb = cb;
    return this;
  }

  update(dt: number): boolean {
    if (this._done) return true;

    this.elapsed += dt;
    const rawT = Math.min(this.elapsed / this.duration, 1);
    const t = this.easing(rawT);

    for (const key of Object.keys(this.to)) {
      this.target[key] = this.from[key] + (this.to[key] - this.from[key]) * t;
    }

    if (rawT >= 1) {
      this._done = true;
      this.onCompleteCb?.();
      return true;
    }
    return false;
  }

  get done(): boolean {
    return this._done;
  }
}

// --- TweenManager (update all active tweens) ---

export class TweenManager {
  private tweens: Tween[] = [];

  add(tween: Tween): Tween {
    this.tweens.push(tween);
    return tween;
  }

  /** Create and add a tween in one call */
  to(
    target: TweenTarget,
    props: Record<string, number>,
    durationMs: number,
    easing?: EasingName,
  ): Tween {
    const tween = new Tween(target, props, durationMs, easing);
    this.tweens.push(tween);
    return tween;
  }

  update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      if (this.tweens[i].update(dt)) {
        this.tweens.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.tweens.length = 0;
  }

  get count(): number {
    return this.tweens.length;
  }
}
