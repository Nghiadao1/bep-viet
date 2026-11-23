// ============================================================
// Staff — Auto-helper NPC
// ============================================================

import { drawTextShadow } from '../utils/draw';

export type StaffType = 'cook' | 'cashier' | 'server';

/** Staff color by type */
const STAFF_COLORS: Record<StaffType, string> = {
  cook:    '#e74c3c',
  cashier: '#3498db',
  server:  '#2ecc71',
};

/** Staff label by type */
const STAFF_LABELS: Record<StaffType, string> = {
  cook:    '👨‍🍳',
  cashier: '💰',
  server:  '🍽️',
};

export class Staff {
  type: StaffType;
  x: number;
  y: number;
  skill: number;      // 0 – 1 efficiency
  busy = false;
  taskTimer = 0;

  private taskDuration = 0;
  private targetX: number;
  private targetY: number;

  constructor(type: StaffType, x: number, y: number, skill = 0.5) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.skill = skill;
    this.targetX = x;
    this.targetY = y;
  }

  /** Advance task timer. dt in ms. */
  update(dt: number): void {
    // Smooth movement toward target
    const speed = 0.004 * dt;
    this.x += (this.targetX - this.x) * speed;
    this.y += (this.targetY - this.y) * speed;

    if (!this.busy) return;

    this.taskTimer += dt;
    if (this.taskTimer >= this.taskDuration) {
      this.taskTimer = 0;
      this.taskDuration = 0;
      this.busy = false;
    }
  }

  /** Render the staff member as a colored dot with label. */
  render(ctx: CanvasRenderingContext2D): void {
    const radius = 14;
    const color = STAFF_COLORS[this.type] ?? '#888';

    // Dot
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.busy ? color : `${color}99`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Emoji label
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STAFF_LABELS[this.type] ?? '?', this.x, this.y);

    // Busy indicator
    if (this.busy) {
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      drawTextShadow(ctx, 'busy', this.x, this.y + radius + 2, '#e74c3c');
    }
  }

  /** Assign a task with a given duration (ms). Optionally move to a station. */
  assignTask(duration: number, targetX?: number, targetY?: number): void {
    if (this.busy) return;
    this.busy = true;
    this.taskTimer = 0;
    this.taskDuration = duration;
    if (targetX !== undefined && targetY !== undefined) {
      this.targetX = targetX;
      this.targetY = targetY;
    }
  }

  /** Whether the staff member can accept a new task. */
  isAvailable(): boolean {
    return !this.busy;
  }
}
