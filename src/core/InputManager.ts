// ============================================================
// InputManager — Mouse & mobile touch input handling
// ============================================================

import type { Engine } from './Engine';
import type { Vec2, Rect } from '../types';

export type InputCallback = (pos: Vec2) => void;

export class InputManager {
  private engine: Engine;
  private clickCallbacks: InputCallback[] = [];
  private moveCallbacks: InputCallback[] = [];
  private downCallbacks: InputCallback[] = [];
  private upCallbacks: InputCallback[] = [];
  private tapVisualCallbacks: InputCallback[] = [];

  private isDown = false;
  private lastPos: Vec2 = { x: -999, y: -999 };
  private touchStartPos: Vec2 | null = null;
  private activeTouchId: number | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
    const canvas = engine.canvas;

    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.handleDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleUp(e));
    canvas.addEventListener('click', (e) => this.handleClick(e));

    // Touch events (zero 300ms delay, safe multi-touch, prevents zoom/scroll)
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (!touch) return;
      this.activeTouchId = touch.identifier;
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      this.touchStartPos = pos;
      this.handleDownAt(pos);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = this.findTouch(e.changedTouches) ?? e.touches[0];
      if (!touch) return;
      this.handleMoveAt(this.screenToGame(touch.clientX, touch.clientY));
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = this.findTouch(e.changedTouches) ?? e.changedTouches[0];
      if (!touch) return;
      const pos = this.screenToGame(touch.clientX, touch.clientY);
      this.handleUpAt(pos);

      // Fire tap if finger didn't drag far across the screen
      const start = this.touchStartPos;
      const dist = start ? Math.hypot(pos.x - start.x, pos.y - start.y) : 0;
      if (dist <= 45) {
        this.fireClick(pos);
      }

      // Clear ghost hover position after finger lifts on mobile
      this.lastPos = { x: -999, y: -999 };
      this.touchStartPos = null;
      this.activeTouchId = null;
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
      this.isDown = false;
      this.lastPos = { x: -999, y: -999 };
      this.touchStartPos = null;
      this.activeTouchId = null;
    });
  }

  private findTouch(list: TouchList): Touch | null {
    if (this.activeTouchId === null) return null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === this.activeTouchId) return list[i];
    }
    return null;
  }

  /** Convert screen coordinates to logical game coordinates (960×540) */
  private screenToGame(clientX: number, clientY: number): Vec2 {
    const rect = this.engine.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const scaleX = this.engine.gameWidth / rect.width;
    const scaleY = this.engine.gameHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private handleDown(e: MouseEvent): void {
    this.handleDownAt(this.screenToGame(e.clientX, e.clientY));
  }

  private handleMove(e: MouseEvent): void {
    this.handleMoveAt(this.screenToGame(e.clientX, e.clientY));
  }

  private handleUp(e: MouseEvent): void {
    this.handleUpAt(this.screenToGame(e.clientX, e.clientY));
  }

  private handleClick(e: MouseEvent): void {
    this.fireClick(this.screenToGame(e.clientX, e.clientY));
  }

  private handleDownAt(pos: Vec2): void {
    this.isDown = true;
    this.lastPos = pos;
    for (const cb of [...this.downCallbacks]) cb(pos);
  }

  private handleMoveAt(pos: Vec2): void {
    this.lastPos = pos;
    for (const cb of [...this.moveCallbacks]) cb(pos);
  }

  private handleUpAt(pos: Vec2): void {
    this.isDown = false;
    for (const cb of [...this.upCallbacks]) cb(pos);
  }

  private fireClick(pos: Vec2): void {
    for (const cb of this.tapVisualCallbacks) cb(pos);
    for (const cb of [...this.clickCallbacks]) cb(pos);
  }

  // --- Public API ---

  onClick(callback: InputCallback): () => void {
    this.clickCallbacks.push(callback);
    return () => {
      const idx = this.clickCallbacks.indexOf(callback);
      if (idx >= 0) this.clickCallbacks.splice(idx, 1);
    };
  }

  onMove(callback: InputCallback): () => void {
    this.moveCallbacks.push(callback);
    return () => {
      const idx = this.moveCallbacks.indexOf(callback);
      if (idx >= 0) this.moveCallbacks.splice(idx, 1);
    };
  }

  onDown(callback: InputCallback): () => void {
    this.downCallbacks.push(callback);
    return () => {
      const idx = this.downCallbacks.indexOf(callback);
      if (idx >= 0) this.downCallbacks.splice(idx, 1);
    };
  }

  onUp(callback: InputCallback): () => void {
    this.upCallbacks.push(callback);
    return () => {
      const idx = this.upCallbacks.indexOf(callback);
      if (idx >= 0) this.upCallbacks.splice(idx, 1);
    };
  }

  /** Persistent hook for tap ripple visual feedback (not cleared on scene switch) */
  onTapVisual(callback: InputCallback): void {
    this.tapVisualCallbacks.push(callback);
  }

  /** Check if a point is inside a rect (with optional touch padding) */
  static hitTest(pos: Vec2, rect: Rect, padding = 0): boolean {
    return (
      pos.x >= rect.x - padding &&
      pos.x <= rect.x + rect.width + padding &&
      pos.y >= rect.y - padding &&
      pos.y <= rect.y + rect.height + padding
    );
  }

  get pointer(): Vec2 {
    return { ...this.lastPos };
  }

  get pressed(): boolean {
    return this.isDown;
  }

  /** Remove all scene callbacks (call when switching scenes) */
  clear(): void {
    this.clickCallbacks.length = 0;
    this.moveCallbacks.length = 0;
    this.downCallbacks.length = 0;
    this.upCallbacks.length = 0;
  }
}
