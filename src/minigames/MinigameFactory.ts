// ============================================================
// MinigameFactory — Smart Router for ALL 14 Authentic Vietnamese
// Tactile Cooking Minigames!
// ============================================================
// ActionMinigames (1–4):
//   1. FirePumpMinigame     (🔥 Thổi lửa đun nước dùng)
//   2. TimingCutMinigame    (⏱️ Căn nhịp cắt bánh phở)
//   3. SliceLineMinigame    (🔪 Kéo dao theo đường kẻ thái thịt / xẻ bánh mì)
//   4. GrillFlipMinigame    (🔥 Nướng than hoa & lật 2 mặt vàng ươm)
// CraftMinigames (5–8):
//   5. VeggiePrepMinigame   (🥗 Nhặt rau tươi, tránh lá úa & sâu)
//   6. SeasoningMinigame    (🧂 Nêm gia vị & topping đúng khẩu vị khách)
//   7. WokTossMinigame      (🍳 Hất chảo xào lửa lớn theo vòng lửa)
//   8. LayerPourMinigame    (☕ Giữ & thả rót xếp tầng Chè / Cà Phê)
// SpecialMinigames (9–14):
//   9. SwirlWhiskMinigame   (🌀 Xoay tròn đánh mắm tôm / pha nước chấm sủi bọt)
//  10. RollWrapMinigame     (🌯 Vuốt 3 bước cuốn Gỏi Cuốn / Phở Cuốn / gói Bánh Nậm)
//  11. BlanchDipMinigame    (💧 Giữ nhúng giỏ tre trụng phở & thả đúng vùng xanh)
//  12. SqueezeLimeMinigame  (🍋 Vắt chanh / tắc tươi, né rơi hạt chanh!)
//  13. IceCrushMinigame     (🧊 Chạm điểm nứt đập tảng đá lấy đá viên)
//  14. PourTrayMinigame     (🎨 Giữ thả đổ 3 chén Bánh Bèo + tôm cháy mỡ hành)
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
import {
  SwirlWhiskMinigame,
  RollWrapMinigame,
  BlanchDipMinigame,
  SqueezeLimeMinigame,
  IceCrushMinigame,
  PourTrayMinigame,
} from './SpecialMinigames';

/**
 * Create the right interactive minigame for any dish step!
 * Combines dish-specific Vietnamese culinary signature mechanics with
 * `variationSeed` rotation so consecutive bowls stay fresh & never repetitive.
 */
export function createMinigameForStep(
  ctx: MinigameContext,
  isLastStep: boolean,
): CookingMinigame {
  const { step, recipe, variationSeed } = ctx;
  const actionLower = step.action.toLowerCase();

  // ---- 1. Signature Dish-Specific Minigame Overrides ----

  // Huế Bánh Bèo (and Bánh Nậm batter): Pour into 3 delicate porcelain saucers!
  if (
    (recipe.id === 'banh_beo' && step.stationType === StationType.NOODLE) ||
    (recipe.id === 'banh_nam' && actionLower.includes('tráng'))
  ) {
    return new PourTrayMinigame(ctx);
  }

  // Rolling / Wrapping specialties: Gỏi Cuốn, Phở Cuốn, Bánh Nậm lá dong!
  if (
    actionLower.includes('cuốn') ||
    actionLower.includes('gói') ||
    ((recipe.id === 'pho_cuon' || recipe.id === 'spring_roll_platter' || recipe.id === 'banh_nam') &&
      step.stationType === StationType.VEGGIE)
  ) {
    return new RollWrapMinigame(ctx);
  }

  // Hà Nội Bún Đậu Mắm Tôm: Always whisk shrimp paste into frothy purple foam!
  if (recipe.id === 'bun_dau_mam_tom' && step.stationType === StationType.SAUCE) {
    return new SwirlWhiskMinigame(ctx);
  }

  // Hand-whisked Vietnamese dipping sauces (Cơm Tấm, Bún Chả, Phở Cuốn, Bánh Bèo, Cơm Gà, Cocktail):
  // Alternate between SwirlWhisk and Customer-Taste Seasoning so players enjoy BOTH!
  if (
    step.stationType === StationType.SAUCE &&
    actionLower.includes('pha') &&
    (!isLastStep || variationSeed % 2 === 1)
  ) {
    return new SwirlWhiskMinigame(ctx);
  }

  // Cocktail mixing step
  if (recipe.id === 'vn_coffee_cocktail' && actionLower.includes('cocktail')) {
    return new SwirlWhiskMinigame(ctx);
  }

  // ---- 2. Customer-Taste Finale for Drinks / Desserts without a SAUCE step ----
  if (
    isLastStep &&
    ctx.taste &&
    (step.stationType === StationType.DRINK || step.stationType === StationType.DESSERT) &&
    !recipe.steps.some((s) => s.stationType === StationType.SAUCE)
  ) {
    return new SeasoningMinigame(ctx);
  }

  // ---- 3. Station-Based Smart Variety Rotation ----
  switch (step.stationType) {
    case StationType.BROTH:
      return new FirePumpMinigame(ctx);

    case StationType.NOODLE:
      // Alternate between Rhythm Cutting Bánh Phở & Bamboo-Basket Blanching!
      return variationSeed % 2 === 1
        ? new BlanchDipMinigame(ctx)
        : new TimingCutMinigame(ctx);

    case StationType.MEAT:
      return new SliceLineMinigame(ctx, false);

    case StationType.BREAD:
      return new SliceLineMinigame(ctx, true);

    case StationType.VEGGIE:
      // Alternate between Picking Fresh Herbs & Squeezing Fresh Lime (dodging seeds)!
      return variationSeed % 2 === 1
        ? new SqueezeLimeMinigame(ctx)
        : new VeggiePrepMinigame(ctx);

    case StationType.SAUCE:
      return new SeasoningMinigame(ctx);

    case StationType.GRILL:
      return new GrillFlipMinigame(ctx);

    case StationType.WOK:
      return new WokTossMinigame(ctx);

    case StationType.DRINK:
    case StationType.DESSERT:
      // Crush crystal ice on explicit ice steps or alternating drink/dessert preps!
      if (actionLower.includes('đá') || variationSeed % 2 === 1) {
        return new IceCrushMinigame(ctx);
      }
      return new LayerPourMinigame(ctx);

    default:
      return new TimingCutMinigame(ctx);
  }
}
