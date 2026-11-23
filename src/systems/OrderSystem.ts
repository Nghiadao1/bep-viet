// ============================================================
// OrderSystem — Manages pending orders and fulfillment
// ============================================================

import { Customer } from '../entities/Customer';
import { Dish } from '../entities/Dish';
import { events } from '../core/EventBus';

export interface Order {
  customer: Customer;
  recipeIds: string[];
  createdAt: number;   // timestamp ms
}

export class OrderSystem {
  private orders: Order[] = [];

  /** Add a new order for a customer. */
  addOrder(customer: Customer, recipeIds: string[]): void {
    this.orders.push({
      customer,
      recipeIds: [...recipeIds],
      createdAt: Date.now(),
    });
  }

  /**
   * Try to fulfill an order with a completed dish.
   * Matches the dish recipe to a waiting customer's order.
   */
  fulfillOrder(dish: Dish): boolean {
    for (let i = 0; i < this.orders.length; i++) {
      const order = this.orders[i];
      const idx = order.recipeIds.indexOf(dish.recipe.id);
      if (idx === -1) continue;

      // Serve the dish to the customer
      const result = order.customer.serve(dish);
      if (!result.accepted) continue;

      // Remove recipe from order
      order.recipeIds.splice(idx, 1);

      events.emit('order_fulfilled', {
        customer: order.customer,
        dish,
        tips: result.tips,
        stars: result.stars,
      });

      // If order is fully served, remove it
      if (order.recipeIds.length === 0) {
        this.orders.splice(i, 1);
      }

      return true;
    }
    return false;
  }

  /** Update orders — remove expired ones (customer patience ran out). */
  update(dt: number): void {
    for (let i = this.orders.length - 1; i >= 0; i--) {
      const order = this.orders[i];
      if (order.customer.getPatienceRatio() <= 0) {
        events.emit('order_expired', {
          customer: order.customer,
          recipeIds: order.recipeIds,
        });
        this.orders.splice(i, 1);
      }
    }
  }

  /** Get all currently active orders. */
  getActiveOrders(): readonly Order[] {
    return this.orders;
  }
}
