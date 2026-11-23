// ============================================================
// CustomerSystem — Spawns and manages customers
// ============================================================

import type { LevelConfig, CustomerConfig, Vec2 } from '../types';
import { Customer } from '../entities/Customer';
import { events } from '../core/EventBus';
import { randInt, randPick } from '../utils/math';

/** Default customer configs by type */
const CUSTOMER_DEFAULTS: Record<string, CustomerConfig> = {
  OFFICE_WORKER: {
    type: 'OFFICE_WORKER' as any,
    name: 'Nhân viên',
    patience: 25_000,
    tipMultiplier: 1.0,
    orderSize: [1, 2],
    sprite: 'customer_office',
    speechBubbles: ['Nhanh giúp tôi nhé!', 'Tôi đang vội lắm!'],
  },
  ELDERLY: {
    type: 'ELDERLY' as any,
    name: 'Cụ ông',
    patience: 45_000,
    tipMultiplier: 1.2,
    orderSize: [1, 1],
    sprite: 'customer_elderly',
    speechBubbles: ['Từ từ cũng được con.', 'Cho cụ phở nhé.'],
  },
  FAMILY: {
    type: 'FAMILY' as any,
    name: 'Gia đình',
    patience: 35_000,
    tipMultiplier: 1.5,
    orderSize: [2, 4],
    sprite: 'customer_family',
    speechBubbles: ['Cho cả nhà gọi món!', 'Các con muốn ăn gì?'],
  },
  SHIPPER: {
    type: 'SHIPPER' as any,
    name: 'Shipper',
    patience: 15_000,
    tipMultiplier: 0.8,
    orderSize: [1, 3],
    sprite: 'customer_shipper',
    speechBubbles: ['Nhanh nhé bạn!', 'Đang có đơn gấp!'],
  },
  TOURIST: {
    type: 'TOURIST' as any,
    name: 'Du khách',
    patience: 40_000,
    tipMultiplier: 2.0,
    orderSize: [1, 2],
    sprite: 'customer_tourist',
    speechBubbles: ['This looks great!', 'Phở please!'],
  },
  FOOD_BLOGGER: {
    type: 'FOOD_BLOGGER' as any,
    name: 'Blogger',
    patience: 20_000,
    tipMultiplier: 1.8,
    orderSize: [1, 2],
    sprite: 'customer_blogger',
    speechBubbles: ['Phải ngon để review!', 'Cho mình chụp hình nha!'],
  },
};

/** Seat positions (game coords 960×540) */
const SEAT_POSITIONS: Vec2[] = [
  { x: 60, y: 80 },
  { x: 160, y: 80 },
  { x: 260, y: 80 },
  { x: 360, y: 80 },
  { x: 460, y: 80 },
  { x: 560, y: 80 },
];

export class CustomerSystem {
  private customers: Customer[] = [];
  private seats: (Customer | null)[] = [];
  private spawnTimer = 0;
  private spawnRate = 5000;          // ms between spawns
  private maxCustomers = 4;
  private availableRecipes: string[] = [];
  private customerTypes: string[] = [];

  // Scoring stats
  totalServed = 0;
  totalLeftAngry = 0;

  /** Initialize from level config. */
  init(config: LevelConfig): void {
    this.customers = [];
    this.seats = SEAT_POSITIONS.map(() => null);
    this.spawnTimer = 0;
    this.spawnRate = config.customerSpawnRate;
    this.maxCustomers = Math.min(config.maxCustomers, SEAT_POSITIONS.length);
    this.availableRecipes = [...config.availableRecipes];
    this.customerTypes = config.customerTypes.map(t => t as string);
    this.totalServed = 0;
    this.totalLeftAngry = 0;
  }

  /** Update all customers — spawn new ones, tick patience. dt in ms. */
  update(dt: number): void {
    // Spawn logic
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnRate && this.customers.length < this.maxCustomers) {
      this.spawnTimer = 0;
      this.spawnCustomer();
    }

    // Update existing customers
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.update(dt);

      // Customer ran out of patience
      if (c.getPatienceRatio() <= 0 && !c.served) {
        this.totalLeftAngry++;
        this.removeCustomer(i);
        events.emit('customer_left', { customer: c });
      }

      // Customer has been served
      if (c.served) {
        this.totalServed++;
        this.removeCustomer(i);
        events.emit('customer_served', { customer: c, tips: c.tips });
      }
    }
  }

  /** Render all customers. */
  render(ctx: CanvasRenderingContext2D): void {
    for (const c of this.customers) {
      c.render(ctx);
    }
  }

  /** Get the customer at a point (for click interaction). */
  getCustomerAt(pos: Vec2): Customer | null {
    for (const c of this.customers) {
      const r = c.getRect();
      if (
        pos.x >= r.x && pos.x <= r.x + r.width &&
        pos.y >= r.y && pos.y <= r.y + r.height
      ) {
        return c;
      }
    }
    return null;
  }

  // --- Private helpers ---

  private spawnCustomer(): void {
    const seatIdx = this.seats.indexOf(null);
    if (seatIdx === -1) return;

    const typeKey = randPick(this.customerTypes);
    const config = CUSTOMER_DEFAULTS[typeKey];
    if (!config) return;

    // Generate random order
    const [minOrder, maxOrder] = config.orderSize;
    const orderSize = randInt(minOrder, maxOrder);
    const order: string[] = [];
    for (let i = 0; i < orderSize; i++) {
      order.push(randPick(this.availableRecipes));
    }

    const seat = SEAT_POSITIONS[seatIdx];
    const customer = new Customer(config, seat.x, seat.y, order);
    customer.seated = true;
    this.customers.push(customer);
    this.seats[seatIdx] = customer;
  }

  private removeCustomer(index: number): void {
    const c = this.customers[index];
    const seatIdx = this.seats.indexOf(c);
    if (seatIdx !== -1) this.seats[seatIdx] = null;
    this.customers.splice(index, 1);
  }
}
