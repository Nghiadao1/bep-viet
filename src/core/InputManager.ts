// ============================================================
// InputManager — Mouse & touch input handling
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
  private isDown = false;
  private lastPos: Vec2 = { x: 0, y: 0 };

  constructor(engine: Engine) {
    this.engine = engine;
    const canvas = engine.canvas;

    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.handleDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleUp(e));
    canvas.addEventListener('click', (e) => this.handleClick(e));

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleDown(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.handleMove(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleUp(e.changedTouches[0]);
      this.handleClick(e.changedTouches[0]);
    }, { passive: false });
  }

  /** Convert screen coordinates to game coordinates */
  private screenToGame(clientX: number, clientY: number): Vec2 {
    const rect = this.engine.canvas.getBoundingClientRect();
    const scaleX = this.engine.gameWidth / rect.width;
    const scaleY = this.engine.gameHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private handleDown(e: MouseEvent | Touch): void {
    this.isDown = true;
    const pos = this.screenToGame(e.clientX, e.clientY);
    this.lastPos = pos;
    for (const cb of this.downCallbacks) cb(pos);
  }

  private handleMove(e: MouseEvent | Touch): void {
    const pos = this.screenToGame(e.clientX, e.clientY);
    this.lastPos = pos;
    for (const cb of this.moveCallbacks) cb(pos);
  }

  private handleUp(e: MouseEvent | Touch): void {
    this.isDown = false;
    const pos = this.screenToGame(e.clientX, e.clientY);
    for (const cb of this.upCallbacks) cb(pos);
  }

  private handleClick(e: MouseEvent | Touch): void {
    const pos = this.screenToGame(e.clientX, e.clientY);
    for (const cb of this.clickCallbacks) cb(pos);
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

  /** Check if a point is inside a rect */
  static hitTest(pos: Vec2, rect: Rect): boolean {
    return (
      pos.x >= rect.x &&
      pos.x <= rect.x + rect.width &&
      pos.y >= rect.y &&
      pos.y <= rect.y + rect.height
    );
  }

  get pointer(): Vec2 {
    return { ...this.lastPos };
  }

  get pressed(): boolean {
    return this.isDown;
  }

  /** Remove all callbacks (call when switching scenes) */
  clear(): void {
    this.clickCallbacks.length = 0;
    this.moveCallbacks.length = 0;
    this.downCallbacks.length = 0;
    this.upCallbacks.length = 0;
  }
}
