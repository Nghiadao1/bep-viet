// ============================================================
// Bếp Việt — Official Story & Chapter Cutscene Dialogues
// Starring: Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp
// ============================================================

export type StorySpeaker = 'boss' | 'golden' | 'both' | 'narrator';

export interface StoryLine {
  speaker: StorySpeaker;
  text: string;
}

export type ChapterStory = {
  title: string;
  subtitle: string;
  locationBadge: string;
  themeColors: [string, string];
  text: string;
  unlockText: string;
  lines: StoryLine[];
};

export const CHAPTER_STORIES: Record<number, ChapterStory> = {
  1: {
    title: 'Chương 1: Sài Gòn',
    subtitle: 'Xe Phở Con Hẻm Nhỏ',
    locationBadge: '📍 Hẻm Nhỏ Sài Gòn • Miền Nam',
    themeColors: ['#2a1829', '#141326'],
    text:
      'Một đêm mưa Sài Gòn, ông chủ già nghỉ hưu để lại cho Vằn Bếp Trưởng chiếc xe đẩy gỗ và Cuốn Sổ Vị Giác đã phai mờ 4 chương sau. ' +
      'Đúng lúc đó, Mèo Vàng bụng đói meo bị mùi nước phở quyến rũ ghé qua — và cặp bài trùng đầu bếp mèo chính thức ra đời!',
    unlockText: 'Hành trình chinh phục ẩm thực Việt bắt đầu từ con hẻm nhỏ Sài Gòn!',
    lines: [
      {
        speaker: 'narrator',
        text: 'Đêm mưa rả rích giữa con hẻm Sài Gòn... Ông chủ quán phở già trước khi nghỉ hưu đã trao lại chiếc xe đẩy gỗ và "Cuốn Sổ Vị Giác Việt Nam" cho Vằn Bếp Trưởng.',
      },
      {
        speaker: 'boss',
        text: 'Hừm... Cuốn sổ chỉ còn rõ đúng trang Phở Bò Sài Gòn. Bốn trang Huế, Hội An, Hà Nội và Trang Cuối đều phai nhòa theo năm tháng rồi... Ta nhất định phải đi khắp nước Việt tìm lại trọn vẹn hương vị này!',
      },
      {
        speaker: 'golden',
        text: 'Meo~ Anh ơi! Mùi xương bò ninh thơm xỉu cả con hẻm luôn! Cho em xin miếng nước dùng ấm bụng được không? Em ngửi thấy thiếu nửa nhánh quế với chút gừng nướng là chuẩn bài luôn á!',
      },
      {
        speaker: 'boss',
        text: '(Tai cụp khẽ rung) Ồ... chiếc mũi của nhóc nhạy đấy! Được rồi, từ hôm nay nhóc sẽ là Mèo Vàng Phụ Bếp của ta. Cùng nhau mở bán từ Sài Gòn rồi chinh phục khắp bản đồ Việt Nam thôi!',
      },
      {
        speaker: 'both',
        text: 'Bếp Việt — Catking chính thức khai trương! Nồi nước dùng sôi rồi, đón những vị khách Sài Gòn đầu tiên nào! Meow~ 🍜',
      },
    ],
  },

  2: {
    title: 'Chương 2: Huế',
    subtitle: 'Thử Thách Vị Giác Cung Đình',
    locationBadge: '📍 Cố Đô Huế • Sông Hương',
    themeColors: ['#2c1638', '#151226'],
    text:
      'Tiếng thơm từ xe phở Sài Gòn lan xa. Theo manh mối hương sả ớt trong trí nhớ ông chủ, Vằn Bếp Trưởng và Mèo Vàng Phụ Bếp lên tàu ra cố đô Huế chinh phục ẩm thực cung đình tinh tế.',
    unlockText: 'Cố đô Huế mở cổng — chinh phục vị giác cung đình bên dòng sông Hương!',
    lines: [
      {
        speaker: 'narrator',
        text: 'Chuyến tàu Bắc–Nam dừng bánh bên dòng sông Hương thơ mộng. Quán nhỏ của hai chú mèo dựng ngay dưới tán phượng bên thành cổ rêu phong.',
      },
      {
        speaker: 'golden',
        text: 'Oa anh Vằn ơi! Đĩa Bánh Bèo ở đây nhỏ xíu xinh như đồ chơi vậy! Để em... "kiểm duyệt chất lượng" một chén trước nha~',
      },
      {
        speaker: 'boss',
        text: 'Bỏ cái chân xuống ngay, Mèo Vàng! Ẩm thực Huế đề cao sự tinh tế trong từng chi tiết nhỏ nhất — từ chén bánh bèo rắc tôm cháy tới nồi Bún Bò Huế cay nồng thơm mùi mắm ruốc sả ớt!',
      },
      {
        speaker: 'golden',
        text: 'Hì hì em biết rồi mà! Em đã chuẩn bị sẵn sả đập dập và ruốc Huế chính gốc nè. Anh Vằn trổ tài đi, tụi mình sẽ làm các vị khách đất Thần Kinh trầm trồ luôn!',
      },
      {
        speaker: 'boss',
        text: 'Tốt! Nấu đủ chuẩn vị cố đô là trang thứ 2 của Cuốn Sổ Vị Giác sẽ sáng rõ. Lên lửa thôi! 🔥',
      },
    ],
  },

  3: {
    title: 'Chương 3: Hội An',
    subtitle: 'Đêm Đèn Lồng Sông Thu Bồn',
    locationBadge: '📍 Phố Cổ Hội An • Đèn Lồng',
    themeColors: ['#3b2114', '#161324'],
    text:
      'Dòng chữ ẩn từ Huế dẫn hai chú mèo đến phố cổ Hội An rực rỡ đèn lồng. Nơi đây có sợi Cao Lầu giếng cổ Bá Lễ, Mì Quảng vàng ươm và du khách từ khắp năm châu đổ về.',
    unlockText: 'Phố cổ Hội An rực sáng đèn lồng — chào đón hai đầu bếp mèo!',
    lines: [
      {
        speaker: 'narrator',
        text: 'Hoàng hôn buông xuống những mái ngói rêu phong tường vàng. Hàng trăm chiếc đèn lồng dọc sông Thu Bồn đồng loạt thắp sáng.',
      },
      {
        speaker: 'golden',
        text: 'Đẹp quá trời ơi anh Vằn! Du khách nước ngoài đông nghịt luôn! Mà mùi Bánh Mì Hội An với Mì Quảng có bánh tráng mè giòn rụm thơm không chịu nổi!',
      },
      {
        speaker: 'boss',
        text: 'Đừng để đèn lồng làm hoa mắt đấy, Mèo Vàng. Cao Lầu ở đây có sợi mì dai giòn rất đặc biệt, còn Cơm Gà Hội An phải có màu nghệ vàng ươm và rau răm thơm đúng độ.',
      },
      {
        speaker: 'golden',
        text: 'Yên tâm có em phụ một tay! Khách phương xa mà ăn xong tô Mì Quảng của tụi mình chắc chắn sẽ nhớ mãi hương vị Việt Nam luôn đó!',
      },
      {
        speaker: 'both',
        text: 'Thắp đèn lồng lên, mở quán ven sông Thu Bồn nào! Meow~ 🏮',
      },
    ],
  },

  4: {
    title: 'Chương 4: Hà Nội',
    subtitle: 'Linh Hồn 36 Phố Phường',
    locationBadge: '📍 Phố Cổ Hà Nội • Miền Bắc',
    themeColors: ['#132c25', '#101826'],
    text:
      'Gió heo may mùa thu đón hai chú mèo về với thủ đô ngàn năm văn hiến. Thử thách lớn nhất đang chờ đợi: chinh phục khẩu vị tinh tế bậc nhất của thực khách 36 phố phường!',
    unlockText: 'Hà Nội 36 phố phường — thử thách bản lĩnh của Vằn Bếp Trưởng & Mèo Vàng!',
    lines: [
      {
        speaker: 'narrator',
        text: 'Mùa thu Hà Nội se lạnh, lá vàng rơi khẽ bên góc phố cổ thoang thoảng mùi hoa sữa và khói than hoa quạt Bún Chả thơm ngào ngạt.',
      },
      {
        speaker: 'boss',
        text: 'Cuối cùng cũng tới Hà Nội rồi... Nghe kỹ đây Mèo Vàng: Phở Hà Nội phải giữ nước xương trong veo, ngọt thanh tự nhiên, rắc nhiều hành lá và ăn kèm quẩy nóng giòn — hoàn toàn khác phong cách miền Nam!',
      },
      {
        speaker: 'golden',
        text: 'Á! Còn hũ gì màu tím tím đậm mùi thế anh Vằn? Bún Đậu Mắm Tôm hả? Hơi nặng mùi xíu... Khoan! Anh vắt thêm quả tắc đánh sủi bọt lên xong chấm miếng đậu rán nóng... TRỜI ƠI NGON XỈU!!',
      },
      {
        speaker: 'boss',
        text: 'Haha, biết ngay nhóc sẽ ghiền mà! Xong chương Hà Nội này là đủ cả 4 trang cổ... nhưng lạ thật, trang thứ 5 cuối cuốn sổ lại hoàn toàn để trống.',
      },
      {
        speaker: 'golden',
        text: 'Em thấy có dòng chữ nhỏ ông chủ ghi nè: "Bốn miền dạy con gốc rễ — trang cuối cùng hãy để chính hai con viết nên!" Ngầu quá anh Vằn ơi! ✨',
      },
    ],
  },

  5: {
    title: 'Chương 5: Fusion 5 Sao',
    subtitle: 'Vua Mèo Đưa Bếp Việt Ra Thế Giới',
    locationBadge: '⭐ Nhà Hàng 5 Sao • Bếp Việt Fusion',
    themeColors: ['#2e2412', '#101324'],
    text:
      'Kết tinh trọn vẹn tinh hoa từ Sài Gòn, Huế, Hội An đến Hà Nội, Vằn Bếp Trưởng và Mèo Vàng Phụ Bếp mở nhà hàng 5 sao — tự tay viết nên trang huyền thoại cuối cùng cho ẩm thực Việt!',
    unlockText: 'Nhà hàng 5 sao Bếp Việt khai trương — đưa món Việt chinh phục thế giới!',
    lines: [
      {
        speaker: 'narrator',
        text: 'Ánh đèn pha lê rực rỡ khắp căn bếp 5 sao "Bếp Việt — Catking Fine Dining". Từ chiếc xe đẩy gỗ đêm mưa ngày nào, hai chú mèo đã đi trọn một hành trình kỳ diệu dọc dải đất hình chữ S.',
      },
      {
        speaker: 'golden',
        text: 'Anh Vằn ơi nhìn kìa! Phở Xào Nấm Truffle, Bánh Mì Wagyu, Gỏi Cuốn Fusion với Cocktail Cà Phê Việt — toàn những món tụi mình tự sáng tạo từ tinh hoa cả 3 miền đó!',
      },
      {
        speaker: 'boss',
        text: 'Trang thứ 5 của Cuốn Sổ Vị Giác cuối cùng cũng đã được viết đầy... Dù nấu ở nhà hàng 5 sao hay góc hẻm nhỏ, bí quyết lớn nhất vẫn không bao giờ đổi: nấu bằng cả trái tim.',
      },
      {
        speaker: 'golden',
        text: 'Mà anh Vằn hứa nhé, tối nay xong ca 5 sao rồi anh vẫn ninh cho em một tô Phở Bò nóng hổi giống đêm mưa đầu tiên nha~',
      },
      {
        speaker: 'both',
        text: 'Chắc chắn rồi! Nào, cùng nhau đưa hương vị Việt Nam tỏa sáng khắp thế giới! Meow~ 👑🍜⭐',
      },
    ],
  },
};
