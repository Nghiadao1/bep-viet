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
  entered: boolean;
}

export class SceneManager {
  private stack: Scene[] = [];
  private transition: TransitionState | null = null;

  get current(): Scene | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Replace current scene */
  replace(scene: Scene, transition: TransitionType = 'fade', duration = 0.25): void {
    this.finishPendingTransition();
    const from = this.stack.pop() ?? null;
    this.stack.push(scene);

    if (transition === 'none' || !from) {
      from?.exit();
      scene.enter();
      return;
    }

    // Detach old scene's input listeners immediately so clicks don't double-fire during fade
    from.exit();

    this.transition = {
      type: transition,
      progress: 0,
      duration,
      fromScene: from,
      toScene: scene,
      entered: false,
    };
  }

  /** Push scene on top (e.g., pause overlay) */
  push(scene: Scene, transition: TransitionType = 'fade', duration = 0.25): void {
    this.finishPendingTransition();
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
      entered: false,
    };
  }

  /** Pop top scene */
  pop(transition: TransitionType = 'fade', duration = 0.25): void {
    this.finishPendingTransition();
    if (this.stack.length <= 1) return;
    const from = this.stack.pop()!;
    const to = this.stack[this.stack.length - 1];

    from.exit();

    if (transition === 'none') {
      to.enter();
      return;
    }

    this.transition = {
      type: transition,
      progress: 0,
      duration,
      fromScene: from,
      toScene: to,
      entered: false,
    };
  }

  /** Called by Engine every frame */
  update(dt: number): void {
    if (this.transition) {
      this.transition.progress += dt / this.transition.duration;

      // Initialize the incoming scene at the midpoint BEFORE it is rendered
      if (this.transition.progress >= 0.5 && !this.transition.entered) {
        this.transition.entered = true;
        this.transition.toScene.enter();
      }

      if (this.transition.progress >= 1) {
        if (!this.transition.entered) {
          this.transition.entered = true;
          this.transition.toScene.enter();
        }
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

  private finishPendingTransition(): void {
    if (this.transition && !this.transition.entered) {
      this.transition.entered = true;
      this.transition.toScene.enter();
    }
    this.transition = null;
  }

  private renderTransition(ctx: CanvasRenderingContext2D): void {
    const t = this.transition!;

    if (t.progress < 0.5) {
      // First half: render old scene fading out
      t.fromScene?.render(ctx);
      const alpha = Math.min(1, t.progress * 2);
      ctx.fillStyle = `rgba(26, 26, 46, ${alpha})`;
      ctx.fillRect(0, 0, 960, 540);
    } else {
      // Ensure incoming scene has entered before first render
      if (!t.entered) {
        t.entered = true;
        t.toScene.enter();
      }
      // Second half: render new scene fading in
      t.toScene.render(ctx);
      const alpha = Math.max(0, (1 - t.progress) * 2);
      ctx.fillStyle = `rgba(26, 26, 46, ${alpha})`;
      ctx.fillRect(0, 0, 960, 540);
    }
  }
}
