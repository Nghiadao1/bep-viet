// ============================================================
// Bếp Việt — Micro-Session Level Progression (50 Levels)
// Designed around mobile casual retention best practices:
// - Short 35-65s customer-wave levels (2-5 customers -> instant win!)
// - Rapid dish unlocks (new dish almost every level in Ch.1!)
// - Rotating mission modes (classic, picky, rush, vip_critic)
// - Pre-level 2-Cat story dialogue (Vằn Bếp Trưởng & Mèo Vàng)
// - Generous clear reward chests to fuel Shop upgrades
// ============================================================

import { CustomerType, type LevelConfig, type LevelMissionType } from '../types';

const BASIC_CUSTOMERS = [CustomerType.OFFICE_WORKER, CustomerType.ELDERLY];
const MID_CUSTOMERS = [
  CustomerType.OFFICE_WORKER,
  CustomerType.ELDERLY,
  CustomerType.FAMILY,
  CustomerType.SHIPPER,
];
const ALL_CUSTOMERS = [
  CustomerType.OFFICE_WORKER,
  CustomerType.ELDERLY,
  CustomerType.FAMILY,
  CustomerType.SHIPPER,
  CustomerType.TOURIST,
  CustomerType.FOOD_BLOGGER,
];

interface LevelSeed {
  dayName: string;
  recipes: string[];
  customers: number;
  mission: LevelMissionType;
  customerTypes: CustomerType[];
  introBoss: string;
  introGolden: string;
}

const CH1_SEEDS: LevelSeed[] = [
  {
    dayName: 'Khai Trương Xe Phở',
    recipes: ['pho_bo'],
    customers: 2,
    mission: 'classic',
    customerTypes: [CustomerType.OFFICE_WORKER, CustomerType.ELDERLY],
    introBoss: 'Hôm nay khai trương con hẻm nhỏ! Chỉ cần phục vụ thật chuẩn 2 vị khách đầu tiên!',
    introGolden: 'Em chuẩn bị nồi nước dùng thơm lừng rồi nè anh Vằn! Chốt đơn đầu tay thôi! 🍜',
  },
  {
    dayName: 'Mở Khóa Phở Gà',
    recipes: ['pho_bo', 'pho_ga'],
    customers: 2,
    mission: 'picky',
    customerTypes: BASIC_CUSTOMERS,
    introBoss: 'Hôm nay có thêm món Phở Gà thanh đạm! Khách sẽ bắt đầu dặn khẩu vị riêng đó!',
    introGolden: 'Nhớ đọc kỹ ai đòi thêm chanh, ai dặn KHÔNG HÀNH nha anh/chị ơi! 🌿',
  },
  {
    dayName: 'Bánh Mì Giòn Ra Lò!',
    recipes: ['banh_mi_thit', 'pho_bo'],
    customers: 3,
    mission: 'classic',
    customerTypes: MID_CUSTOMERS,
    introBoss: 'Mới tậu được lò nướng Bánh Mì Sài Gòn! Xẻ bánh khéo, kẹp pate rồi nướng vàng 2 mặt!',
    introGolden: 'Mùi bánh mì nướng bơ thơm nức cả xóm luôn! Anh Shipper ghé mua rồi kìa! 🥖',
  },
  {
    dayName: 'Cơm Tấm Sườn Nướng',
    recipes: ['com_tam', 'banh_mi_thit', 'pho_bo'],
    customers: 3,
    mission: 'rush',
    customerTypes: MID_CUSTOMERS,
    introBoss: 'Giờ cơm trưa rồi! Bếp than hoa nướng sườn Cơm Tấm đã đỏ rực — lật sườn đúng nhịp nhé!',
    introGolden: 'Khách văn phòng tan tầm kéo tới đông ghê! Giữ Combo x3 kiếm thật nhiều tiền thưởng! 🔥',
  },
  {
    dayName: 'Giải Nhiệt Chè Ba Màu',
    recipes: ['che_ba_mau', 'com_tam', 'banh_mi_thit'],
    customers: 3,
    mission: 'picky',
    customerTypes: MID_CUSTOMERS,
    introBoss: 'Trưa Sài Gòn nắng quá, bán thêm Chè Ba Màu! Canh vạch rót từng tầng thật đẹp mắt!',
    introGolden: 'Đậu đỏ, đậu xanh, thạch lá dứa với cốt dừa béo ngậy... cho em một ly với nha~ 🍧',
  },
  {
    dayName: 'Cà Phê Sữa Đá Sáng',
    recipes: ['ca_phe_sua_da', 'banh_mi_thit', 'pho_bo'],
    customers: 3,
    mission: 'rush',
    customerTypes: [...MID_CUSTOMERS, CustomerType.TOURIST],
    introBoss: 'Combo huyền thoại Sài Gòn: Bánh Mì + Cà Phê Sữa Đá! Phục vụ thần tốc nào!',
    introGolden: 'Giọt cà phê phin nhỏ xuống lớp sữa đặc nhìn mê quá trời luôn! ☕',
  },
  {
    dayName: 'Khách Khó Tính Hẻm Nhỏ',
    recipes: ['pho_bo', 'pho_ga', 'com_tam', 'che_ba_mau'],
    customers: 4,
    mission: 'picky',
    customerTypes: ALL_CUSTOMERS,
    introBoss: 'Hôm nay toàn thực khách sành ăn đặt yêu cầu khắt khe — nêm đúng khẩu vị thưởng tip x2!',
    introGolden: 'Đừng lo có mũi thần của Mèo Vàng canh giùm phiếu khẩu vị cho! 🌶️',
  },
  {
    dayName: 'Cơn Lốc Shipper',
    recipes: ['banh_mi_thit', 'ca_phe_sua_da', 'com_tam', 'pho_bo'],
    customers: 4,
    mission: 'rush',
    customerTypes: [CustomerType.SHIPPER, CustomerType.OFFICE_WORKER, CustomerType.TOURIST],
    introBoss: 'Đơn đặt mang đi nổ liên tục! Mấy anh Shipper áo xanh vội lắm, nhanh tay lên!',
    introGolden: 'Vừa nướng bánh mì vừa pha cà phê — cảm giác như siêu đầu bếp vậy! ⚡',
  },
  {
    dayName: 'Đêm Sài Gòn Rực Rỡ',
    recipes: ['pho_bo', 'com_tam', 'banh_mi_thit', 'che_ba_mau', 'ca_phe_sua_da'],
    customers: 4,
    mission: 'classic',
    customerTypes: ALL_CUSTOMERS,
    introBoss: 'Quán ta giờ nổi tiếng khắp quận rồi! Chuẩn bị tinh thần đón một vị khách rất đặc biệt ngày mai.',
    introGolden: 'Còn 1 màn nữa là tụi mình chinh phục xong Sài Gòn rồi lên tàu ra Huế đó anh Vằn! 🏮',
  },
  {
    dayName: '⭐ BOSS: Food Blogger Sài Gòn',
    recipes: ['pho_bo', 'banh_mi_thit', 'com_tam', 'ca_phe_sua_da'],
    customers: 4,
    mission: 'vip_critic',
    customerTypes: [CustomerType.FOOD_BLOGGER, CustomerType.TOURIST, CustomerType.FAMILY],
    introBoss: 'Food Blogger nổi tiếng ghé quay review quán ta! Phải đạt thật nhiều PERFECT để mở đường ra Huế!',
    introGolden: 'Cười tươi lên máy quay nào anh Vằn! Tụi mình nhất định giành 3 sao vàng! ⭐📸',
  },
];

const CHAPTER_TEMPLATES: Record<
  number,
  {
    avgPayout: number;
    pool: string[];
    names: string[];
    bossLines: string[];
    goldenLines: string[];
  }
> = {
  2: {
    avgPayout: 68,
    pool: ['bun_bo_hue', 'banh_beo', 'banh_nam', 'com_hen', 'che_hue'],
    names: [
      'Chào Cố Đô Huế!',
      'Bánh Bèo Chén Xinh',
      'Bánh Nậm Lá Chuối',
      'Khẩu Vị Cung Đình',
      'Cơm Hến Đậm Đà',
      'Mưa Phùn Sông Hương',
      'Chè Huế Thanh Tao',
      'Giờ Cao Điểm Kinh Thành',
      'Tiệc Đêm Hoàng Cung',
      '⭐ BOSS: Giám Khảo Đất Huế',
    ],
    bossLines: [
      'Bún Bò Huế phải đậm hương mắm ruốc sả ớt — đun lửa chuẩn tay nhé!',
      'Bánh Bèo chén nhỏ tinh tế lắm, Mèo Vàng cấm ăn vụng!',
      'Lá chuối gói Bánh Nậm thơm dịu, nấu thật khéo vào!',
      'Người Huế rất sành vị cay nồng — đọc kỹ phiếu khẩu vị nhé!',
      'Cơm Hến nhỏ mà có võ, xào hến dậy mùi rồi rắc đậu phộng giòn!',
    ],
    goldenLines: [
      'Mùi sả ớt Bún Bò Huế thơm tới bờ bên kia sông Hương luôn! 🍜',
      'Chén Bánh Bèo nhỏ xíu dễ thương quá em suýt húp nhầm hihi~',
      'Khách Huế khen tụi mình nấu khéo quá trời anh Vằn ơi! ✨',
      'Cố lên còn vài màn nữa là Trang Bí Kíp thứ 2 sáng rõ rồi!',
      'Trời mưa ăn Bún Bò nóng với Chè Huế thì còn gì bằng! 🌧️',
    ],
  },
  3: {
    avgPayout: 74,
    pool: ['mi_quang', 'cao_lau', 'banh_mi_hoi_an', 'com_ga_hoi_an'],
    names: [
      'Đèn Lồng Phố Cổ',
      'Mì Quảng Bánh Tráng',
      'Cao Lầu Giếng Bá Lễ',
      'Du Khách Năm Châu',
      'Bánh Mì Phượng Hội An',
      'Cơm Gà Phố Hội',
      'Đêm Hoa Đăng Thu Bồn',
      'Thực Khách Khó Tính',
      'Lễ Hội Đèn Lồng',
      '⭐ BOSS: Du Khách Quốc Tế',
    ],
    bossLines: [
      'Tới Hội An rồi! Mì Quảng ít nước dùng nhưng phải thật đậm đà, nhớ bánh tráng mè!',
      'Sợi Cao Lầu dai giòn kết hợp xá xíu mềm thơm — cắt thịt thật chuẩn tay!',
      'Bánh Mì Hội An trứ danh thế giới: xẻ giòn, đủ nhân, nướng vàng ươm!',
      'Du khách quốc tế đổ về đêm hoa đăng đông lắm — giữ vững phong độ!',
      'Cơm Gà Hội An vàng ươm màu nghệ, nhớ nêm đủ rau răm hành tây nhé!',
    ],
    goldenLines: [
      'Đèn lồng bên sông Thu Bồn lung linh quá anh Vằn ơi! 🏮',
      'Bánh tráng mè giòn rụm ăn chung Mì Quảng ngon xỉu luôn!',
      'Mấy bạn du khách chụp hình tụi mình liên tục kìa! Meow~ 📸',
      'Quán nhỏ phố cổ sắp nổi tiếng toàn cầu rồi đó nha! ✨',
      'Chinh phục xong Hội An là tụi mình thẳng tiến ra thủ đô Hà Nội! 🗺️',
    ],
  },
  4: {
    avgPayout: 78,
    pool: ['pho_ha_noi', 'bun_cha', 'bun_dau_mam_tom', 'pho_cuon', 'tra_da'],
    names: [
      'Mùa Thu 36 Phố Phường',
      'Phở Hà Nội & Quẩy Nóng',
      'Bún Chả Quạt Than Hoa',
      'Bún Đậu Mắm Tôm!',
      'Phở Cuốn Ngũ Xã',
      'Trà Đá Vỉa Hè',
      'Phố Cổ Giờ Cao Điểm',
      'Thực Khách Sành Ăn',
      'Đêm Thu Hồ Gươm',
      '⭐ BOSS: Nghệ Nhân Phố Cổ',
    ],
    bossLines: [
      'Hà Nội 36 phố phường! Phở Bắc phải trong veo, nhiều hành lá và quẩy nóng giòn!',
      'Quạt bếp than hoa nướng Bún Chả cho thơm lừng cả con ngõ nhỏ nào!',
      'Bún Đậu Mắm Tôm: đánh mắm tôm sủi bọt với tắc, đậu rán vàng ruộm!',
      'Người Hà Nội chấm điểm cực kỳ tinh tế — đừng bỏ sai gia vị nhé!',
      'Trang bí kíp thứ 4 sắp hoàn tất — tập trung cao độ nào cộng sự!',
    ],
    goldenLines: [
      'Gió heo may mát quá! Ăn tô Phở Hà Nội nóng hổi chấm quẩy là nhất! 🍜',
      'Mắm tôm lúc đầu hơi nồng mà vắt tắc vào chấm đậu ngon ghiền luôn anh Vằn ơi!!',
      'Khói Bún Chả bay thơm ngào ngạt làm bụng em réo nữa rồi~ 🔥',
      'Thêm ly Trà Đá mát lạnh vỉa hè đúng chất Hà Nội luôn! 🧊',
      'Xong Hà Nội là mở khóa Trang Vàng bí ẩn cuối cùng của Cuốn Sổ đó! ✨',
    ],
  },
  5: {
    avgPayout: 120,
    pool: ['pho_xao_truffle', 'banh_mi_wagyu', 'spring_roll_platter', 'vn_coffee_cocktail'],
    names: [
      'Khai Trương 5 Sao!',
      'Phở Xào Nấm Truffle',
      'Bánh Mì Bò Wagyu',
      'Gỏi Cuốn Fine Dining',
      'Cocktail Cà Phê Việt',
      'Dạ Tiệc Thượng Lưu',
      'Siêu Tốc Bếp 5 Sao',
      'Khẩu Vị Ngôi Sao',
      'Đêm Trao Giải Ẩm Thực',
      '👑 CHUNG KẾT: Huyền Thoại Bếp Việt',
    ],
    bossLines: [
      'Nhà hàng 5 sao Catking Fine Dining khai trương! Hất chảo Phở Xào Truffle thật điệu nghệ!',
      'Bò Wagyu nướng áp chảo phải chín vừa tới — lật sai một giây là phí cả miếng thịt quý!',
      'Tụi mình đang tự viết nên Trang Thứ 5 huyền thoại cho ẩm thực Việt Nam!',
      'Thực khách từ khắp thế giới đặt bàn trước cả tháng — cho họ thấy đẳng cấp Bếp Việt!',
      'Màn cuối cùng rồi Mèo Vàng! Cùng nhau giành danh hiệu Vua Ẩm Thực Việt Nam thôi! 👑',
    ],
    goldenLines: [
      'Từ xe phở hẻm nhỏ Sài Gòn tới tận bếp 5 sao — như giấc mơ vậy anh Vằn ơi! ✨',
      'Cocktail Cà Phê Việt rót phân tầng đẹp mê hồn luôn! ☕',
      'Tụi mình phối hợp bao nhiêu chương rồi, trận nào cũng PERFECT hết! 🐾',
      'Khách vỗ tay rần rần kìa anh Vằn!! Đỉnh nóc kịch trần!! 🎉',
      'Xong màn chung kết này anh nhớ nấu cho em tô Phở Bò nóng như đêm mưa đầu tiên nha~ 💕',
    ],
  },
};

function buildAllLevels(): LevelConfig[] {
  const result: LevelConfig[] = [];

  // Chapter 1: Handcrafted rapid-unlock sequence
  CH1_SEEDS.forEach((seed, idx) => {
    const id = idx + 1;
    const avgPayout = 56;
    const targetScore = Math.round((seed.customers * avgPayout) / 10) * 10;
    const minScore = Math.round((targetScore * 0.55) / 10) * 10;

    result.push({
      id,
      chapter: 1,
      dayName: seed.dayName,
      targetScore,
      minScore,
      timeLimit: 55 + seed.customers * 12,
      targetCustomers: seed.customers,
      missionType: seed.mission,
      rewardBonus: 50 + idx * 15,
      introBoss: seed.introBoss,
      introGolden: seed.introGolden,
      availableRecipes: seed.recipes,
      customerSpawnRate: seed.mission === 'rush' ? 2400 : 3400,
      maxCustomers: Math.min(4, Math.max(2, seed.customers)),
      customerTypes: seed.customerTypes,
      specialEvents: seed.mission === 'vip_critic' ? ['food_critic'] : undefined,
    });
  });

  // Chapters 2..5: Structured variety + brisk 3-5 customer waves!
  const missionCycle: LevelMissionType[] = [
    'classic',
    'picky',
    'classic',
    'rush',
    'classic',
    'picky',
    'rush',
    'picky',
    'rush',
    'vip_critic',
  ];

  for (let ch = 2; ch <= 5; ch++) {
    const tpl = CHAPTER_TEMPLATES[ch];
    for (let pos = 0; pos < 10; pos++) {
      const id = (ch - 1) * 10 + pos + 1;
      const mission = missionCycle[pos];
      // Unlock 1 new recipe every 1-2 levels inside each chapter!
      const recipeCount = Math.min(tpl.pool.length, 1 + Math.floor((pos + 1) / 2));
      const availableRecipes = tpl.pool.slice(0, recipeCount);

      // Short brisk waves: 3 customers early in chapter -> 5 customers at chapter boss!
      const targetCustomers = Math.min(5, 3 + Math.floor(pos / 4));
      const targetScore = Math.round((targetCustomers * tpl.avgPayout) / 10) * 10;
      const minScore = Math.round((targetScore * 0.55) / 10) * 10;

      result.push({
        id,
        chapter: ch,
        dayName: tpl.names[pos],
        targetScore,
        minScore,
        timeLimit: 55 + targetCustomers * 11,
        targetCustomers,
        missionType: mission,
        rewardBonus: 80 + (ch - 1) * 40 + pos * 15,
        introBoss: tpl.bossLines[pos % tpl.bossLines.length],
        introGolden: tpl.goldenLines[pos % tpl.goldenLines.length],
        availableRecipes,
        customerSpawnRate: mission === 'rush' ? 2200 : 3100,
        maxCustomers: Math.min(5, Math.max(3, targetCustomers)),
        customerTypes: ch >= 4 ? ALL_CUSTOMERS : pos < 4 ? MID_CUSTOMERS : ALL_CUSTOMERS,
        specialEvents: mission === 'vip_critic' ? ['food_critic'] : undefined,
      });
    }
  }

  return result;
}

export const LEVELS: LevelConfig[] = buildAllLevels();

// Chapter metadata for MapScene
export const CHAPTERS = [
  { id: 1, name: 'Sài Gòn', subtitle: 'Xe Phở Con Hẻm Nhỏ', region: 'Miền Nam', color: '#E74C3C', levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 2, name: 'Huế', subtitle: 'Vị Giác Cung Đình', region: 'Miền Trung', color: '#9B59B6', levels: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { id: 3, name: 'Hội An', subtitle: 'Đêm Đèn Lồng Thu Bồn', region: 'Miền Trung', color: '#F39C12', levels: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  { id: 4, name: 'Hà Nội', subtitle: 'Linh Hồn 36 Phố Phường', region: 'Miền Bắc', color: '#27AE60', levels: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] },
  { id: 5, name: 'Fusion', subtitle: 'Nhà Hàng 5 Sao Catking', region: 'Quốc Tế', color: '#D97706', levels: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50] },
];

/** Get level config by ID */
export function getLevel(id: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** Get all levels in a chapter */
export function getLevelsByChapter(chapter: number): LevelConfig[] {
  return LEVELS.filter((l) => l.chapter === chapter);
}

/** Find any recipe newly unlocked specifically at this level ID */
export function getNewlyUnlockedRecipes(levelId: number): string[] {
  const cur = getLevel(levelId);
  if (!cur) return [];
  if (levelId === 1) return cur.availableRecipes;
  const prev = getLevel(levelId - 1);
  if (!prev) return cur.availableRecipes;
  const prevSet = new Set(prev.availableRecipes);
  return cur.availableRecipes.filter((r) => !prevSet.has(r));
}
