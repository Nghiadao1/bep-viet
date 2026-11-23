// ============================================================
// MinigameFactory — Maps every StationType & Dish Step
// to its tailored tactile Vietnamese cooking minigame!
// ============================================================

import { StationType } from '../types';
import type { CookingMinigame, MinigameContext } from './types';
import {
  FirePumpMinigame,
  TimingCutMinigame,
  SliceLineMinigame,
  GrillFlipMinigame,
} from './ActionMinigames';
import {
  VeggiePrepMinigame,
  SeasoningMinigame,
  WokTossMinigame,
  LayerPourMinigame,
} from './CraftMinigames';

/**
 * Create the right interactive minigame for any dish step!
 * - BROTH:   🔥 Thổi lửa đun nước dùng
 * - NOODLE:  ⏱️ Căn nhịp cắt bánh phở / trụng bún
 * - MEAT:    🔪 Cầm dao kéo theo đường kẻ thái thịt
 * - BREAD:   🥖 Xẻ ổ bánh mì theo đường kẻ (or Grill if specifically toasting!)
 * - VEGGIE:  🥗 Nhặt nhanh rau thơm tươi sạch
 * - SAUCE:   🧂 Nêm gia vị & topping đúng khẩu vị khách (hành / không hành, quẩy, tương ớt, pate...)
 * - GRILL:   🔥 Nướng than hoa & lật 2 mặt vàng ươm
 * - WOK:     🍳 Hất chảo xào lửa lớn
 * - DRINK:   ☕ Rót tầng cà phê sữa đá / trà đá (or Seasoning if it's the final topping step!)
 * - DESSERT: 🍧 Rót xếp tầng chè ba màu / chè Huế
 */
export function createMinigameForStep(
  ctx: MinigameContext,
  isLastStep: boolean,
): CookingMinigame {
  const { step, recipe } = ctx;

  // If a drink/dessert dish has no SAUCE step, make its final step the Customer Taste Seasoning minigame
  // so EVERY customer's custom preference (e.g., thêm đá / cốt dừa / đường) matters!
  if (
    isLastStep &&
    ctx.taste &&
    (step.stationType === StationType.DRINK || step.stationType === StationType.DESSERT) &&
    !recipe.steps.some((s) => s.stationType === StationType.SAUCE)
  ) {
    return new SeasoningMinigame(ctx);
  }

  switch (step.stationType) {
    case StationType.BROTH:
      return new FirePumpMinigame(ctx);
    case StationType.NOODLE:
      return new TimingCutMinigame(ctx);
    case StationType.MEAT:
      return new SliceLineMinigame(ctx, false);
    case StationType.BREAD:
      // Baguette slicing along dotted guide lines!
      return new SliceLineMinigame(ctx, true);
    case StationType.VEGGIE:
      return new VeggiePrepMinigame(ctx);
    case StationType.SAUCE:
      return new SeasoningMinigame(ctx);
    case StationType.GRILL:
      return new GrillFlipMinigame(ctx);
    case StationType.WOK:
      return new WokTossMinigame(ctx);
    case StationType.DRINK:
    case StationType.DESSERT:
      return new LayerPourMinigame(ctx);
    default:
      return new TimingCutMinigame(ctx);
  }
}
