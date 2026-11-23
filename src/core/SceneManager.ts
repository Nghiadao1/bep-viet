// ============================================================
// SceneManager — Stack-based scene management with transitions
// ============================================================

import type { Scene } from '../types';

export type TransitionType = 'none' | 'fade' | 'slide';

interface TransitionState {
  type: TransitionType;
  progress: number;        // 0 → 1
  duration: number;        // seconds
  fromScene: Scene | null;
  toScene: Scene;
}

export class SceneManager {
  private stack: Scene[] = [];
  private transition: TransitionState | null = null;

  get current(): Scene | null {
    if (this.transition) return null; // during transition, we render manually
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Replace current scene */
  replace(scene: Scene, transition: TransitionType = 'fade', duration = 0.3): void {
    const from = this.stack.pop() ?? null;
    this.stack.push(scene);

    if (transition === 'none' || !from) {
      from?.exit();
      scene.enter();
      return;
    }

    this.transition = {
      type: transition,
      progress: 0,
      duration,
      fromScene: from,
      toScene: scene,
    };
  }

  /** Push scene on top (e.g., pause overlay) */
  push(scene: Scene, transition: TransitionType = 'fade', duration = 0.3): void {
    const from = this.stack[this.stack.length - 1] ?? null;
    this.stack.push(scene);

    if (transition === 'none' || !from) {
      scene.enter();
      return;
    }

    this.transition = {
      type: transition,
      progress: 0,
      duration,
      fromScene: from,
      toScene: scene,
    };
  }

  /** Pop top scene */
  pop(transition: TransitionType = 'fade', duration = 0.3): void {
    if (this.stack.length <= 1) return;
    const from = this.stack.pop()!;
    const to = this.stack[this.stack.length - 1];

    if (transition === 'none') {
      from.exit();
      return;
    }

    this.transition = {
      type: transition,
      progress: 0,
      duration,
      fromScene: from,
      toScene: to,
    };
  }

  /** Called by Engine every frame */
  update(dt: number): void {
    if (this.transition) {
      this.transition.progress += dt / this.transition.duration;
      if (this.transition.progress >= 1) {
        this.transition.fromScene?.exit();
        this.transition.toScene.enter();
        this.transition = null;
      }
      return;
    }
    this.current?.update(dt);
  }

  /** Called by Engine every frame */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.transition) {
      this.renderTransition(ctx);
      return;
    }
    this.current?.render(ctx);
  }

  private renderTransition(ctx: CanvasRenderingContext2D): void {
    const t = this.transition!;
    const { width, height } = ctx.canvas;
    const gw = width / (window.devicePixelRatio ?? 1);
    const gh = height / (window.devicePixelRatio ?? 1);

    if (t.type === 'fade') {
      if (t.progress < 0.5) {
        // First half: render old scene fading out
        t.fromScene?.render(ctx);
        ctx.fillStyle = `rgba(26, 26, 46, ${t.progress * 2})`;
        ctx.fillRect(0, 0, 960, 540);
      } else {
        // Second half: render new scene fading in
        t.toScene.render(ctx);
        ctx.fillStyle = `rgba(26, 26, 46, ${(1 - t.progress) * 2})`;
        ctx.fillRect(0, 0, 960, 540);
      }
    }
  }
}
