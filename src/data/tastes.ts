// ============================================================
// Bếp Việt — Customer Custom Taste & Topping Preferences
// Generates authentic Vietnamese customizations per dish type
// (e.g. +Quẩy, +Tương ớt, 🚫 Không hành, +Pate, +Cốt dừa...)
// ============================================================

import type { LevelMissionType, Recipe } from '../types';
import { randPick, shuffle } from '../utils/math';

export interface ToppingOption {
  id: string;
  label: string;
  shortLabel: string;
  emoji: string;
  color: string;
}

export interface CustomerTasteOrder {
  /** Toppings the customer explicitly WANTS added */
  wanted: ToppingOption[];
  /** Optional topping the customer explicitly FORBIDS (e.g. "Không hành!") */
  forbidden: ToppingOption | null;
  /** Full tray of 6 toppings shown in the Seasoning minigame */
  tray: ToppingOption[];
  /** Short badge summary displayed on the customer's order bubble */
  summaryBadges: string[];
}

// ---- Dish-specific Authentic Vietnamese Topping Pools ----

const PHO_NOODLE_TOPPINGS: ToppingOption[] = [
  { id: 'hanh', label: 'Hành lá', shortLabel: 'Hành', emoji: '🌿', color: '#2d9348' },
  { id: 'tuong_ot', label: 'Tương ớt', shortLabel: 'Ớt', emoji: '🌶️', color: '#e63946' },
  { id: 'quay', label: 'Quẩy nóng', shortLabel: 'Quẩy', emoji: '🥖', color: '#e09f3e' },
  { id: 'nuoc_mam', label: 'Nước mắm', shortLabel: 'Mắm', emoji: '🥢', color: '#b5651d' },
  { id: 'chanh', label: 'Chanh tươi', shortLabel: 'Chanh', emoji: '🍋', color: '#80ed99' },
  { id: 'gia', label: 'Giá đỗ', shortLabel: 'Giá', emoji: '🌱', color: '#e9c46a' },
];

const BANH_MI_TOPPINGS: ToppingOption[] = [
  { id: 'pate', label: 'Pate béo', shortLabel: 'Pate', emoji: '🧈', color: '#c98a5b' },
  { id: 'do_chua', label: 'Đồ chua', shortLabel: 'Đồ chua', emoji: '🥕', color: '#f47b20' },
  { id: 'dua_leo', label: 'Dưa leo', shortLabel: 'Dưa leo', emoji: '🥒', color: '#52b768' },
  { id: 'ngo', label: 'Ngò rí', shortLabel: 'Ngò', emoji: '🌿', color: '#2d9348' },
  { id: 'ot_tuoi', label: 'Ớt cay', shortLabel: 'Ớt', emoji: '🌶️', color: '#e63946' },
  { id: 'nuoc_tuong', label: 'Nước tương', shortLabel: 'Xì dầu', emoji: '🥫', color: '#6b3b1e' },
];

const RICE_BUN_TOPPINGS: ToppingOption[] = [
  { id: 'nuoc_mam', label: 'Nước mắm pha', shortLabel: 'Mắm pha', emoji: '🥢', color: '#e86f1c' },
  { id: 'mo_hanh', label: 'Mỡ hành', shortLabel: 'Mỡ hành', emoji: '🌿', color: '#40916c' },
  { id: 'do_chua', label: 'Đồ chua', shortLabel: 'Đồ chua', emoji: '🥕', color: '#f47b20' },
  { id: 'ot_bam', label: 'Ớt băm', shortLabel: 'Ớt', emoji: '🌶️', color: '#e63946' },
  { id: 'dau_phong', label: 'Đậu phộng', shortLabel: 'Đậu phộng', emoji: '🥜', color: '#d4a373' },
  { id: 'mam_tom', label: 'Mắm tôm', shortLabel: 'Mắm tôm', emoji: '🟣', color: '#7b2cbf' },
];

const DRINK_TOPPINGS: ToppingOption[] = [
  { id: 'sua_dac', label: 'Sữa đặc', shortLabel: 'Sữa', emoji: '🥛', color: '#f7ebd2' },
  { id: 'da_vien', label: 'Thêm đá', shortLabel: 'Đá', emoji: '🧊', color: '#90e0ef' },
  { id: 'duong', label: 'Đường', shortLabel: 'Đường', emoji: '🍬', color: '#ffd166' },
  { id: 'chanh', label: 'Lát chanh', shortLabel: 'Chanh', emoji: '🍋', color: '#80ed99' },
  { id: 'que', label: 'Quế thơm', shortLabel: 'Quế', emoji: '🪵', color: '#a47148' },
  { id: 'kem_trung', label: 'Kem béo', shortLabel: 'Kem', emoji: '🍮', color: '#fae19c' },
];

const DESSERT_TOPPINGS: ToppingOption[] = [
  { id: 'cot_dua', label: 'Cốt dừa', shortLabel: 'Cốt dừa', emoji: '🥥', color: '#f8f9fa' },
  { id: 'da_bao', label: 'Đá bào', shortLabel: 'Đá bào', emoji: '🧊', color: '#a2d2ff' },
  { id: 'thach', label: 'Thạch dứa', shortLabel: 'Thạch', emoji: '🟢', color: '#2d9348' },
  { id: 'dau_phong', label: 'Đậu phộng', shortLabel: 'Đậu phộng', emoji: '🥜', color: '#d4a373' },
  { id: 'hat_sen', label: 'Hạt sen', shortLabel: 'Hạt sen', emoji: '🟡', color: '#f4c430' },
  { id: 'tran_chau', label: 'Trân châu', shortLabel: 'Trân châu', emoji: '⚫', color: '#495057' },
];

/** Pick the authentic 6-topping tray matching any of the 24 Vietnamese dishes */
export function getToppingPoolForRecipe(recipe: Recipe): ToppingOption[] {
  const id = recipe.id;
  if (id.includes('banh_mi')) return BANH_MI_TOPPINGS;
  if (id.includes('che_')) return DESSERT_TOPPINGS;
  if (id.includes('ca_phe') || id.includes('tra_da') || id.includes('cocktail')) return DRINK_TOPPINGS;
  if (id.includes('com_') || id.includes('bun_cha') || id.includes('bun_dau') || id.includes('banh_beo') || id.includes('banh_nam') || id.includes('spring_roll') || id.includes('pho_cuon')) {
    return RICE_BUN_TOPPINGS;
  }
  return PHO_NOODLE_TOPPINGS;
}

/**
 * Generate a realistic Vietnamese customer taste order scaled by level difficulty!
 * - Early levels (difficulty < 0.12): 1-2 wanted, gentle forbidden chance (35%)
 * - Mid levels (0.12..0.55): 2 wanted, 70% forbidden chance
 * - Late levels / Picky / VIP Boss: 2-3 wanted, 90% forbidden chance!
 */
export function generateCustomerTaste(
  recipe: Recipe,
  difficulty = 0,
  missionType: LevelMissionType = 'classic',
): CustomerTasteOrder {
  const pool = getToppingPoolForRecipe(recipe);
  const shuffled = shuffle([...pool]);

  const isPicky = missionType === 'picky' || missionType === 'vip_critic';
  let wantedCount = 2;
  if (difficulty < 0.04 && !isPicky) {
    wantedCount = 1; // Level 1-2 ultra approachable!
  } else if (difficulty >= 0.45 || (isPicky && difficulty >= 0.15)) {
    wantedCount = 3; // Challenging 3-topping combinations in later chapters!
  }
  const wanted = shuffled.slice(0, wantedCount);

  const forbidChance = isPicky ? 0.92 : Math.min(0.88, 0.35 + difficulty * 0.65);
  const forbidCandidates = shuffled.slice(wantedCount).filter(
    (t) =>
      t.id === 'hanh' ||
      t.id === 'ngo' ||
      t.id === 'tuong_ot' ||
      t.id === 'ot_tuoi' ||
      t.id === 'ot_bam' ||
      t.id === 'gia' ||
      t.id === 'mam_tom' ||
      t.id === 'da_vien',
  );
  const forbidden =
    forbidCandidates.length > 0 && Math.random() < forbidChance
      ? randPick(forbidCandidates)
      : null;

  const summaryBadges: string[] = wanted.map((w) => `+${w.emoji}`);
  if (forbidden) {
    summaryBadges.push(`🚫${forbidden.emoji}`);
  }

  return {
    wanted,
    forbidden,
    tray: pool,
    summaryBadges,
  };
}

/** Human-readable Vietnamese sentence of what the customer requested (for Cat NPC chatter!) */
export function formatTasteSpeech(recipe: Recipe, taste: CustomerTasteOrder): string {
  const wants = taste.wanted.map((w) => w.shortLabel).join(', ');
  if (taste.forbidden) {
    return `${recipe.name}: thêm ${wants}, nhớ KHÔNG ${taste.forbidden.shortLabel.toUpperCase()} nha!`;
  }
  return `${recipe.name}: nhớ thêm ${wants} cho đậm vị nha!`;
}
