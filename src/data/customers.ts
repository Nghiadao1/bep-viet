// ============================================================
// Bếp Việt — Customer Data
// ============================================================

import { CustomerConfig, CustomerType } from '../types';

export const CUSTOMERS: CustomerConfig[] = [
  {
    type: CustomerType.OFFICE_WORKER,
    name: 'Dân Văn Phòng',
    patience: 15000,
    tipMultiplier: 1.3,
    orderSize: [1, 2],
    sprite: 'customer_office_worker',
    speechBubbles: [
      'Nhanh lên anh ơi, 12h phải về họp rồi! 😤',
      'Cho tôi phần quen nhé, khỏi hỏi!',
      'Ăn xong còn phải chạy deadline nữa...',
      'Thêm đá vào cà phê giùm, hôm nay buồn ngủ quá!',
    ],
  },
  {
    type: CustomerType.ELDERLY,
    name: 'Ông Bà Lão',
    patience: 40000,
    tipMultiplier: 1.0,
    orderSize: [1, 1],
    sprite: 'customer_elderly',
    speechBubbles: [
      'Từ từ thôi con, bà không vội đâu ☺️',
      'Hồi xưa phở ngon hơn nhiều, nhưng thôi kệ...',
      'Cho bà ít ớt thôi nha, bà già rồi!',
      'Nhắc bà nhớ hồi còn con gái, hay ăn ở đây lắm...',
    ],
  },
  {
    type: CustomerType.FAMILY,
    name: 'Gia Đình',
    patience: 25000,
    tipMultiplier: 1.5,
    orderSize: [2, 3],
    sprite: 'customer_family',
    speechBubbles: [
      'Con muốn ăn chè! Không, con muốn phở! 🧒',
      'Cho cả nhà 3 phần nha, bé út thêm nước!',
      'Gia đình mình hiếm khi đi ăn ngoài, hôm nay đặc biệt!',
      'Anh ơi có ghế cho em bé không ạ?',
    ],
  },
  {
    type: CustomerType.SHIPPER,
    name: 'Tài Xế Grab',
    patience: 10000,
    tipMultiplier: 0.8,
    orderSize: [1, 1],
    sprite: 'customer_shipper',
    speechBubbles: [
      'Nhanh nha anh, khách đang chờ bên kia quận! 🏍️',
      'Gói kỹ giùm, xe chạy lung tung lắm!',
      'Đơn 5 sao mà giao trễ là tiêu...',
      'Sao hôm nay đông dữ vậy trời!',
    ],
  },
  {
    type: CustomerType.TOURIST,
    name: 'Khách Du Lịch',
    patience: 35000,
    tipMultiplier: 2.0,
    orderSize: [1, 2],
    sprite: 'customer_tourist',
    speechBubbles: [
      'Oh wow, this looks amazing! 📸',
      'Pho is the best thing I\'ve ever eaten!',
      'Can I get extra chili? I love spicy! 🌶️',
      'My friend told me this place is a hidden gem!',
    ],
  },
  {
    type: CustomerType.FOOD_BLOGGER,
    name: 'Food Blogger',
    patience: 20000,
    tipMultiplier: 2.5,
    orderSize: [1, 2],
    sprite: 'customer_food_blogger',
    speechBubbles: [
      'Đợi chút, để chụp hình đã! Ánh sáng chưa đẹp... 📱',
      'Review 5 sao nha, nhưng phải ngon thiệt mới được!',
      'Hôm nay quay TikTok, anh bưng ra từ từ giùm nha!',
      'Quán này mà lên xu hướng là cháy hàng luôn á!',
    ],
  },
];
