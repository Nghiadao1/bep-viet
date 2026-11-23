// ============================================================
// Bếp Việt — Upgrade Data
// ============================================================

import { Upgrade, StationType } from '../types';

export const UPGRADES: Upgrade[] = [
  // ========== Kitchen ==========
  {
    id: 'bep_nhanh',
    name: 'Bếp Nhanh',
    description: 'Nâng cấp bếp giúp nấu nhanh hơn 20% mỗi cấp.',
    category: 'kitchen',
    cost: 1000,
    effect: { cookSpeedMultiplier: 0.8 },
    icon: '🔥',
    maxLevel: 3,
  },
  {
    id: 'noi_lon',
    name: 'Nồi Lớn',
    description: 'Nồi nước dùng cỡ đại, nấu được nhiều phần hơn.',
    category: 'kitchen',
    cost: 1500,
    effect: { cookSpeedMultiplier: 0.9 },
    icon: '🍲',
    maxLevel: 3,
    requires: ['bep_nhanh'],
  },
  {
    id: 'chao_xao',
    name: 'Chảo Xào',
    description: 'Mở khóa trạm Xào — nấu được thêm nhiều món mới.',
    category: 'kitchen',
    cost: 2000,
    effect: { unlockStation: StationType.WOK },
    icon: '🥘',
    maxLevel: 1,
  },

  // ========== Restaurant ==========
  {
    id: 'them_ban',
    name: 'Thêm Bàn',
    description: 'Thêm 2 chỗ ngồi cho khách mỗi cấp nâng cấp.',
    category: 'restaurant',
    cost: 2000,
    effect: { maxCustomers: 2 },
    icon: '🪑',
    maxLevel: 3,
  },
  {
    id: 'trang_tri',
    name: 'Trang Trí Quán',
    description: 'Trang trí đẹp hơn, khách vui lòng bo thêm 10%.',
    category: 'restaurant',
    cost: 1200,
    effect: { tipMultiplier: 1.1 },
    icon: '🏮',
    maxLevel: 3,
  },
  {
    id: 'dieu_hoa',
    name: 'Điều Hòa',
    description: 'Lắp máy lạnh, khách hài lòng hơn 10% mỗi cấp.',
    category: 'restaurant',
    cost: 1800,
    effect: { satisfactionBonus: 0.1 },
    icon: '❄️',
    maxLevel: 3,
  },

  // ========== Staff ==========
  {
    id: 'phu_bep',
    name: 'Phụ Bếp',
    description: 'Thuê phụ bếp tự động hoàn thành 1 bước nấu.',
    category: 'staff',
    cost: 3000,
    effect: { autoCompleteSteps: 1 },
    icon: '👨‍🍳',
    maxLevel: 3,
  },
  {
    id: 'thu_ngan',
    name: 'Thu Ngân',
    description: 'Thu ngân giỏi giúp thu tiền tip nhiều hơn 15%.',
    category: 'staff',
    cost: 2500,
    effect: { tipMultiplier: 1.15 },
    icon: '💰',
    maxLevel: 3,
  },
  {
    id: 'bao_ve',
    name: 'Bảo Vệ',
    description: 'Giữ trật tự, khách kiên nhẫn hơn 20% mỗi cấp.',
    category: 'staff',
    cost: 2000,
    effect: { satisfactionBonus: 0.2 },
    icon: '💂',
    maxLevel: 3,
  },

  // ========== Ingredient ==========
  {
    id: 'nguyen_lieu_tuoi',
    name: 'Nguyên Liệu Tươi',
    description: 'Dùng nguyên liệu tươi ngon hơn, khách hài lòng +15%.',
    category: 'ingredient',
    cost: 500,
    effect: { satisfactionBonus: 0.15 },
    icon: '🥬',
    maxLevel: 3,
  },
  {
    id: 'gia_vi_dac_biet',
    name: 'Gia Vị Đặc Biệt',
    description: 'Gia vị cao cấp giúp tăng giá bán 20% mỗi cấp.',
    category: 'ingredient',
    cost: 3500,
    effect: { tipMultiplier: 1.2 },
    icon: '🧂',
    maxLevel: 3,
    requires: ['nguyen_lieu_tuoi'],
  },
  {
    id: 'nuoc_dung_dac_biet',
    name: 'Nước Dùng Đặc Biệt',
    description: 'Công thức nước dùng bí truyền, hài lòng +25%.',
    category: 'ingredient',
    cost: 5000,
    effect: { satisfactionBonus: 0.25 },
    icon: '🍜',
    maxLevel: 3,
    requires: ['nguyen_lieu_tuoi', 'gia_vi_dac_biet'],
  },
];
