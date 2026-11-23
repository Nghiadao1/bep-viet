// ============================================================
// Bếp Việt — Chapter Stories
// ============================================================

export type ChapterStory = {
  title: string;
  subtitle: string;
  text: string;
  unlockText: string;
};

export const CHAPTER_STORIES: Record<number, ChapterStory> = {
  1: {
    title: 'Chương 1: Sài Gòn',
    subtitle: 'Gánh Hàng Rong',
    text:
      'Giữa phố phường Sài Gòn nhộn nhịp, bạn bắt đầu với một gánh phở nhỏ bên vỉa hè. ' +
      'Mùi nước dùng thơm lừng lan tỏa trong con hẻm chật hẹp, thu hút từng vị khách qua đường. ' +
      'Giấc mơ lớn bắt đầu từ những điều giản dị nhất — một nồi nước dùng, một tấm lòng, và niềm đam mê nấu ăn cháy bỏng.',
    unlockText: 'Hành trình bắt đầu từ đây — gánh hàng rong nhỏ bé giữa lòng Sài Gòn!',
  },
  2: {
    title: 'Chương 2: Huế',
    subtitle: 'Hương Vị Cung Đình',
    text:
      'Tiếng lành đồn xa, bạn được mời về cố đô Huế để học những bí quyết nấu ăn hoàng gia. ' +
      'Dưới chân thành cổ rêu phong, bạn khám phá ra rằng ẩm thực Huế là sự tinh tế trong từng chi tiết nhỏ nhất. ' +
      'Mỗi món ăn không chỉ ngon mà còn đẹp như một tác phẩm nghệ thuật, xứng đáng dâng lên vua chúa.',
    unlockText: 'Cố đô Huế mở cổng chào đón bạn — hãy chinh phục ẩm thực cung đình!',
  },
  3: {
    title: 'Chương 3: Hội An',
    subtitle: 'Phố Cổ Đèn Lồng',
    text:
      'Đèn lồng lung linh dọc phố cổ Hội An soi sáng con đường ẩm thực mới của bạn. ' +
      'Nơi đây, những món ăn mang hương vị riêng biệt không nơi nào có được — từ cao lầu giếng Bá Lễ đến mì Quảng vàng ươm. ' +
      'Quán nhỏ bên sông Thu Bồn của bạn dần trở thành điểm đến không thể bỏ qua cho du khách gần xa.',
    unlockText: 'Phố cổ Hội An đang chờ — khám phá những hương vị độc đáo nhất miền Trung!',
  },
  4: {
    title: 'Chương 4: Hà Nội',
    subtitle: 'Tinh Hoa Đất Bắc',
    text:
      'Trở về thủ đô ngàn năm văn hiến, bạn đối mặt với thử thách lớn nhất: chinh phục khẩu vị tinh tế của người Hà Nội. ' +
      'Phở Hà Nội thanh khiết, bún chả thơm lừng, trà đá vỉa hè — mỗi món ăn đều mang linh hồn của 36 phố phường. ' +
      'Từ quán nhỏ trong ngõ sâu, danh tiếng bạn đã vang xa khắp đất Bắc.',
    unlockText: 'Hà Nội 36 phố phường — nơi thử thách bản lĩnh đầu bếp đích thực!',
  },
  5: {
    title: 'Chương 5: Fusion',
    subtitle: 'Vươn Ra Thế Giới',
    text:
      'Từ gánh hàng rong nhỏ bé, giờ đây bạn đứng trong căn bếp nhà hàng 5 sao giữa lòng thành phố. ' +
      'Phở xào truffle, bánh mì wagyu, cocktail cà phê Việt — những sáng tạo đột phá nâng tầm ẩm thực Việt Nam ra thế giới. ' +
      'Hành trình này chứng minh rằng: từ vỉa hè đến fine dining, hương vị Việt Nam luôn chinh phục mọi trái tim.',
    unlockText: 'Nhà hàng 5 sao đã sẵn sàng — đưa ẩm thực Việt lên đỉnh cao thế giới!',
  },
};
