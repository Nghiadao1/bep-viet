// ============================================================
// MinigameFactory — Smart Router for ALL 16+ Authentic Vietnamese
// Tactile Cooking & Prep Minigames!
// ============================================================
// ActionMinigames (1–4 — NOW with Dynamic Shifting Targets!):
//   1. FirePumpMinigame     (🔥 Thổi lửa bám vùng sôi dịch chuyển)
//   2. TimingCutMinigame    (⏱️ Cắt bánh phở mục tiêu đổi vị trí liên tục)
//   3. SliceLineMinigame    (🔪 Kéo dao thái thịt góc cắt biến hóa / xẻ bánh mì)
//   4. GrillFlipMinigame    (🔥 Nướng than hoa vùng chín đổi theo từng mặt)
// CraftMinigames (5–8):
//   5. VeggiePrepMinigame   (🥗 Nhặt rau tươi nhanh)
//   6. SeasoningMinigame    (🧂 Nêm gia vị & topping đúng khẩu vị khách)
//   7. WokTossMinigame      (🍳 Hất chảo vòng lửa đổi cỡ liên tục)
//   8. LayerPourMinigame    (☕ Giữ & thả rót xếp tầng vạch biến đổi)
// SpecialMinigames (9–14):
//   9. SwirlWhiskMinigame   (🌀 Xoay tròn đánh mắm tôm / pha nước chấm sủi bọt)
//  10. RollWrapMinigame     (🌯 Vuốt 3 bước cuốn Gỏi Cuốn / Phở Cuốn / gói Bánh Nậm)
//  11. BlanchDipMinigame    (💧 Nhúng giỏ tre trụng phở vùng chín ngẫu nhiên)
//  12. SqueezeLimeMinigame  (🍋 Vắt chanh / tắc tươi, né rơi hạt chanh!)
//  13. IceCrushMinigame     (🧊 Chạm điểm nứt đập tảng đá lấy đá viên)
//  14. PourTrayMinigame     (🎨 Đổ 3 chén Bánh Bèo + tôm cháy mỡ hành)
// ArcadeMinigames (15–16 — NEW!):
//  15. WormCatchVeggieMinigame (🐛 Nhặt rau & bắt nhanh sâu trốn cực nhanh!)
//  16. FruitSliceMinigame      (🍉 Chém gia vị hành tỏi & hoa quả kiểu Fruit Ninja!)
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
  SeasoningMinigame,
  WokTossMinigame,
  LayerPourMinigame,
} from './CraftMinigames';
import {
  SwirlWhiskMinigame,
  RollWrapMinigame,
  BlanchDipMinigame,
  SqueezeLimeMinigame,
  IceCrushMinigame,
  PourTrayMinigame,
} from './SpecialMinigames';
import {
  WormCatchVeggieMinigame,
  FruitSliceMinigame,
} from './ArcadeMinigames';

/**
 * Create the right interactive minigame for a Prep Station or Dish Step!
 */
export function createMinigameForStep(
  ctx: MinigameContext,
  isLastStep: boolean,
): CookingMinigame {
  const { step, recipe, variationSeed } = ctx;
  const actionLower = step.action.toLowerCase();

  // ---- 1. Explicit Fruit-Ninja Aromatics / Produce Slicing Prep ----
  if (
    actionLower.includes('chém') ||
    actionLower.includes('hành tỏi') ||
    actionLower.includes('hoa quả') ||
    actionLower.includes('đồ chua')
  ) {
    return new FruitSliceMinigame(ctx);
  }

  // ---- 2. Signature Dish-Specific Minigame Overrides ----
  if (
    (recipe.id === 'banh_beo' && step.stationType === StationType.NOODLE) ||
    (recipe.id === 'banh_nam' && actionLower.includes('tráng'))
  ) {
    return new PourTrayMinigame(ctx);
  }

  if (
    actionLower.includes('cuốn') ||
    actionLower.includes('gói') ||
    ((recipe.id === 'pho_cuon' || recipe.id === 'spring_roll_platter' || recipe.id === 'banh_nam') &&
      step.stationType === StationType.VEGGIE)
  ) {
    return new RollWrapMinigame(ctx);
  }

  if (recipe.id === 'bun_dau_mam_tom' && step.stationType === StationType.SAUCE) {
    return new SwirlWhiskMinigame(ctx);
  }

  if (
    step.stationType === StationType.SAUCE &&
    actionLower.includes('pha') &&
    (!isLastStep || variationSeed % 2 === 1)
  ) {
    return new SwirlWhiskMinigame(ctx);
  }

  if (recipe.id === 'vn_coffee_cocktail' && actionLower.includes('cocktail')) {
    return new SwirlWhiskMinigame(ctx);
  }

  // ---- 3. Customer-Taste Finale for Drinks / Desserts without a SAUCE step ----
  if (
    isLastStep &&
    ctx.taste &&
    (step.stationType === StationType.DRINK || step.stationType === StationType.DESSERT) &&
    !recipe.steps.some((s) => s.stationType === StationType.SAUCE)
  ) {
    return new SeasoningMinigame(ctx);
  }

  // ---- 4. Station-Based Smart Variety Rotation ----
  switch (step.stationType) {
    case StationType.BROTH:
      return new FirePumpMinigame(ctx);

    case StationType.NOODLE:
      return variationSeed % 2 === 1
        ? new BlanchDipMinigame(ctx)
        : new TimingCutMinigame(ctx);

    case StationType.MEAT:
      return new SliceLineMinigame(ctx, false);

    case StationType.BREAD:
      return new SliceLineMinigame(ctx, true);

    case StationType.VEGGIE:
      // Featured Worm-Catching Herb Prep + alternating Lime Squeeze!
      return variationSeed % 3 === 2
        ? new SqueezeLimeMinigame(ctx)
        : new WormCatchVeggieMinigame(ctx);

    case StationType.SAUCE:
      // In Prep Phase (no specific customer taste yet), slice flying aromatics/fruits Ninja style
      // or whisk dipping sauces!
      if (!ctx.taste) {
        return variationSeed % 2 === 0
          ? new FruitSliceMinigame(ctx)
          : new SwirlWhiskMinigame(ctx);
      }
      return new SeasoningMinigame(ctx);

    case StationType.GRILL:
      return new GrillFlipMinigame(ctx);

    case StationType.WOK:
      return new WokTossMinigame(ctx);

    case StationType.DRINK:
    case StationType.DESSERT:
      if (actionLower.includes('đá') || variationSeed % 2 === 1) {
        return new IceCrushMinigame(ctx);
      }
      return new LayerPourMinigame(ctx);

    default:
      return new TimingCutMinigame(ctx);
  }
}
