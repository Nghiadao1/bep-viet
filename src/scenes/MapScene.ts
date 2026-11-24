// ============================================================
// MapScene — Interactive S-shaped Map of Vietnam (Bản đồ VN)
// featuring accurate mainland coastline, Phú Quốc, Hoàng Sa,
// Trường Sa, glowing chapter pins, level grid & Cat NPC guide
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';
import { CHAPTERS, getLevelsByChapter } from '../data/levels';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { StoryScene } from './StoryScene';
import { ShopScene } from './ShopScene';
import { MarketRunnerScene } from './MarketRunnerScene';
import { GangsterBattleScene } from './GangsterBattleScene';
import { formatMoney } from '../utils/math';

// Accurate geographic coastline waypoints [lon, lat] of Mainland Vietnam (clockwise from Hà Giang)
const VIETNAM_MAINLAND_GEO: ReadonlyArray<[number, number]> = [
  [105.32, 23.38], // Lũng Cú, Hà Giang (Northernmost)
  [106.35, 22.90], // Cao Bằng
  [106.78, 22.05], // Lạng Sơn
  [108.05, 21.52], // Móng Cái, Quảng Ninh
  [107.18, 20.96], // Vịnh Hạ Long
  [106.72, 20.72], // Hải Phòng
  [106.50, 20.18], // Nam Định / Thái Bình
  [105.90, 19.75], // Thanh Hóa
  [105.72, 18.70], // Vinh, Nghệ An
  [106.42, 18.02], // Hà Tĩnh
  [106.66, 17.45], // Đồng Hới, Quảng Bình
  [107.35, 16.82], // Quảng Trị
  [107.74, 16.52], // Huế
  [108.26, 16.12], // Đà Nẵng
  [108.45, 15.84], // Hội An
  [108.92, 15.14], // Quảng Ngãi
  [109.25, 13.78], // Quy Nhơn
  [109.46, 12.66], // Mũi Đôi, Khánh Hòa (Easternmost)
  [109.20, 12.22], // Nha Trang
  [109.02, 11.54], // Phan Rang
  [108.15, 10.92], // Phan Thiết
  [107.12, 10.35], // Vũng Tàu
  [106.75, 10.00], // Bến Tre
  [106.20, 9.52],  // Sóc Trăng
  [105.35, 8.95],  // Bạc Liêu
  [104.80, 8.58],  // Mũi Cà Mau (Southernmost)
  [104.82, 9.15],  // U Minh
  [105.08, 9.95],  // Rạch Giá
  [104.48, 10.38], // Hà Tiên
  [105.25, 10.92], // An Giang / Đồng Tháp
  [106.05, 11.45], // Tây Ninh
  [106.85, 11.95], // Bình Phước
  [107.60, 12.65], // Đắk Lắk
  [107.55, 14.20], // Kon Tum
  [107.32, 15.55], // Quảng Nam west
  [106.58, 16.65], // Lao Bảo (narrow central waist)
  [105.75, 17.85], // Quảng Bình west
  [105.18, 18.60], // Hà Tĩnh west
  [104.08, 19.35], // Kỳ Sơn, Nghệ An
  [104.85, 20.25], // Thanh Hóa west
  [103.50, 20.95], // Sơn La
  [102.18, 22.38], // A Pa Chải, Điện Biên (Westernmost)
  [102.85, 22.75], // Lai Châu
  [103.95, 22.65], // Lào Cai / Sa Pa
  [104.70, 22.92], // Hà Giang west
];

// Phú Quốc Island
const PHU_QUOC_GEO: ReadonlyArray<[number, number]> = [
  [103.85, 10.42],
  [104.05, 10.36],
  [104.03, 10.05],
  [103.93, 9.98],
  [103.84, 10.22],
];

// Geographic pin coordinates + label offsets for the 5 chapters
interface ChapterPinSpec {
  chapterId: number;
  lon: number;
  lat: number;
  labelAlign: 'left' | 'right';
  labelDx: number;
  labelDy: number;
  catSpeaker: 'boss' | 'golden';
  catTip: string;
}

const CHAPTER_PINS: ChapterPinSpec[] = [
  {
    chapterId: 1,
    lon: 106.66,
    lat: 10.82,
    labelAlign: 'left',
    labelDx: -16,
    labelDy: 0,
    catSpeaker: 'boss',
    catTip: 'Sài Gòn nhộn nhịp! Bắt đầu từ xe Phở Bò, Bánh Mì, Cơm Tấm và Cà Phê Sữa Đá nhé!',
  },
  {
    chapterId: 2,
    lon: 107.56,
    lat: 16.64,
    labelAlign: 'left',
    labelDx: -16,
    labelDy: -6,
    catSpeaker: 'golden',
    catTip: 'Cố đô Huế mộng mơ với Bún Bò Huế cay nồng, Bánh Bèo và Chè Cung Đình!',
  },
  {
    chapterId: 3,
    lon: 108.48,
    lat: 15.62,
    labelAlign: 'right',
    labelDx: 16,
    labelDy: 6,
    catSpeaker: 'boss',
    catTip: 'Phố cổ Hội An rực rỡ đèn lồng — Mì Quảng, Cao Lầu và Cơm Gà trứ danh!',
  },
  {
    chapterId: 4,
    lon: 105.85,
    lat: 21.03,
    labelAlign: 'right',
    labelDx: 16,
    labelDy: -4,
    catSpeaker: 'golden',
    catTip: 'Phố cổ Hà Nội ngàn năm văn hiến — Phở chuẩn Bắc, Bún Chả & Bún Đậu Mắm Tôm!',
  },
  {
    chapterId: 5,
    lon: 112.1,
    lat: 20.5,
    labelAlign: 'right',
    labelDx: 16,
    labelDy: 0,
    catSpeaker: 'boss',
    catTip: 'Đỉnh cao ẩm thực Fusion 5 Sao — đưa hương vị Việt vươn tầm thế giới! Meow~',
  },
];

// Project [lon, lat] onto the left-side Vietnam map box (x: 24..496, y: 64..524)
function projectVN(lon: number, lat: number): Vec2 {
  const scale = 27.6;
  const x = 68 + (lon - 102.0) * scale * 0.96;
  const y = 84 + (23.45 - lat) * scale;
  return { x, y };
}

export class MapScene implements Scene {
  private engine: Engine;
  private selectedChapterIdx = 0;
  private elapsed = 0;

  // Click hit regions
  private pinHitRects: { chapterIdx: number; rect: Rect; pos: Vec2 }[] = [];
  private levelRects: Rect[] = [];
  private backBtn: Rect = { x: 18, y: 12, width: 108, height: 42 };
  private marketBtn: Rect = { x: 356, y: 12, width: 130, height: 42 };
  private gangsterBtn: Rect = { x: 494, y: 12, width: 142, height: 42 };
  private storyBtn: Rect = { x: 760, y: 98, width: 164, height: 34 };
  private shopBtn: Rect = { x: 644, y: 12, width: 158, height: 42 };
  private tutorialBtn: Rect = { x: 810, y: 12, width: 132, height: 42 };

  // Cached projected polygons
  private mainlandPts: Vec2[] = [];
  private phuQuocPts: Vec2[] = [];

  private removeClick?: () => void;

  constructor(engine: Engine) {
    this.engine = engine;
    this.mainlandPts = VIETNAM_MAINLAND_GEO.map(([lon, lat]) => projectVN(lon, lat));
    this.phuQuocPts = PHU_QUOC_GEO.map(([lon, lat]) => projectVN(lon, lat));
  }

  enter(): void {
    this.engine.input.clear();
    this.elapsed = 0;

    // Default to the player's current active chapter
    const curLv = this.engine.save.current.currentLevel;
    const activeChIdx = CHAPTERS.findIndex((c) => c.levels.includes(curLv));
    this.selectedChapterIdx = activeChIdx >= 0 ? activeChIdx : 0;

    // Precompute pin hit targets
    this.pinHitRects = CHAPTER_PINS.map((pin) => {
      const pos = projectVN(pin.lon, pin.lat);
      const chapterIdx = CHAPTERS.findIndex((c) => c.id === pin.chapterId);
      return {
        chapterIdx,
        pos,
        rect: { x: pos.x - 28, y: pos.y - 28, width: 56, height: 56 },
      };
    });

    this.removeClick = this.engine.input.onClick((pos) => {
      // Back to Menu
      if (InputManager.hitTest(pos, this.backBtn, 6)) {
        this.engine.scenes.replace(new MenuScene(this.engine));
        return;
      }

      // Quick-play Emergency Market Runner (Subway Surfers dash)!
      if (InputManager.hitTest(pos, this.marketBtn, 6)) {
        this.engine.scenes.replace(
          new MarketRunnerScene(this.engine, (bonusStock) => {
            const cur = this.engine.save.current.currentLevel;
            this.engine.scenes.replace(new GameScene(this.engine, cur, false, bonusStock));
          }),
        );
        return;
      }

      // Quick-play Gangster Cat Defense (Rock-Paper-Scissors brawl)!
      if (InputManager.hitTest(pos, this.gangsterBtn, 6)) {
        this.engine.scenes.replace(
          new GangsterBattleScene(this.engine, () => {
            this.engine.scenes.replace(new MapScene(this.engine));
          }),
        );
        return;
      }

      // Open Upgrade Shop!
      if (InputManager.hitTest(pos, this.shopBtn, 6)) {
        this.engine.scenes.replace(new ShopScene(this.engine, 'map'));
        return;
      }

      // Replay tutorial in Level 1
      if (InputManager.hitTest(pos, this.tutorialBtn, 6)) {
        this.engine.scenes.replace(new GameScene(this.engine, 1, true));
        return;
      }

      // Watch selected chapter's Visual-Novel Story Cutscene!
      if (InputManager.hitTest(pos, this.storyBtn, 6)) {
        const chapter = CHAPTERS[this.selectedChapterIdx];
        this.engine.scenes.replace(
          new StoryScene(this.engine, chapter.id, () => {
            this.engine.scenes.replace(new MapScene(this.engine));
          }),
        );
        return;
      }

      // Click a city pin on the Vietnam Map
      for (const pin of this.pinHitRects) {
        if (InputManager.hitTest(pos, pin.rect, 6)) {
          this.selectedChapterIdx = pin.chapterIdx;
          return;
        }
      }

      // Click a level circle in the right-hand panel
      const chapter = CHAPTERS[this.selectedChapterIdx];
      const levels = getLevelsByChapter(chapter.id);
      const save = this.engine.save.current;
      for (let i = 0; i < this.levelRects.length; i++) {
        if (InputManager.hitTest(pos, this.levelRects[i], 6)) {
          const level = levels[i];
          if (level && level.id <= save.currentLevel) {
            const seen = save.seenChapters ?? [];
            // Auto-play Chapter Opening Story Cutscene on first entry into any region!
            if (i === 0 && !seen.includes(chapter.id)) {
              this.engine.save.update({ seenChapters: [...seen, chapter.id] });
              this.engine.scenes.replace(
                new StoryScene(this.engine, chapter.id, () => {
                  this.engine.scenes.replace(new GameScene(this.engine, level.id));
                }),
              );
            } else {
              this.engine.scenes.replace(new GameScene(this.engine, level.id));
            }
          }
          return;
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  update(dt: number): void {
    this.elapsed += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;

    // Deep background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(1, '#131d36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Header
    this.renderHeader(ctx, W);

    // Left panel: Authentic S-shaped Vietnam Map
    this.renderVietnamMap(ctx);

    // Right panel: Selected Region & 10 Levels + Cat NPC guide
    this.renderLevelPanel(ctx);
  }

  private renderHeader(ctx: CanvasRenderingContext2D, W: number): void {
    // Back button
    const backHover = InputManager.hitTest(this.engine.input.pointer, this.backBtn);
    roundRect(ctx, this.backBtn.x, this.backBtn.y, this.backBtn.width, this.backBtn.height, 10);
    ctx.fillStyle = backHover ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      '← Quay lại',
      this.backBtn.x + this.backBtn.width / 2,
      this.backBtn.y + this.backBtn.height / 2,
    );

    // Title
    ctx.font = 'bold 21px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🗺 Bản Đồ Bếp Việt', 240, 33, '#FCA311');

    // Quick-play Event 1: Emergency Market Runner
    const mktHover = InputManager.hitTest(this.engine.input.pointer, this.marketBtn);
    roundRect(ctx, this.marketBtn.x, this.marketBtn.y, this.marketBtn.width, this.marketBtn.height, 10);
    ctx.fillStyle = mktHover ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🏃 Chạy Chợ', this.marketBtn.x + this.marketBtn.width / 2, this.marketBtn.y + this.marketBtn.height / 2, '#7dd3fc');

    // Quick-play Event 2: Defend Stall vs Gangster Cat!
    const gngHover = InputManager.hitTest(this.engine.input.pointer, this.gangsterBtn);
    roundRect(ctx, this.gangsterBtn.x, this.gangsterBtn.y, this.gangsterBtn.width, this.gangsterBtn.height, 10);
    ctx.fillStyle = gngHover ? 'rgba(230, 57, 70, 0.42)' : 'rgba(230, 57, 70, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🥊 Đuổi Giang Hồ', this.gangsterBtn.x + this.gangsterBtn.width / 2, this.gangsterBtn.y + this.gangsterBtn.height / 2, '#fca5a5');

    // Upgrade Shop button with current money!
    const shopHover = InputManager.hitTest(this.engine.input.pointer, this.shopBtn);
    roundRect(ctx, this.shopBtn.x, this.shopBtn.y, this.shopBtn.width, this.shopBtn.height, 10);
    ctx.fillStyle = shopHover ? 'rgba(76,175,80,0.4)' : 'rgba(76,175,80,0.22)';
    ctx.fill();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      `🏪 Nâng cấp (${formatMoney(this.engine.save.current.money)})`,
      this.shopBtn.x + this.shopBtn.width / 2,
      this.shopBtn.y + this.shopBtn.height / 2,
      '#80ed99',
    );

    // Replay Tutorial button (top-right)
    const tutHover = InputManager.hitTest(this.engine.input.pointer, this.tutorialBtn);
    roundRect(ctx, this.tutorialBtn.x, this.tutorialBtn.y, this.tutorialBtn.width, this.tutorialBtn.height, 10);
    ctx.fillStyle = tutHover ? 'rgba(252,163,17,0.3)' : 'rgba(252,163,17,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252,163,17,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      '🐾 Hướng dẫn',
      this.tutorialBtn.x + this.tutorialBtn.width / 2,
      this.tutorialBtn.y + this.tutorialBtn.height / 2,
      '#FCA311',
    );
  }

  private renderVietnamMap(ctx: CanvasRenderingContext2D): void {
    const mapRect: Rect = { x: 20, y: 64, width: 472, height: 460 };

    ctx.save();

    // Clip to ocean map frame
    roundRect(ctx, mapRect.x, mapRect.y, mapRect.width, mapRect.height, 16);
    const seaGrad = ctx.createLinearGradient(mapRect.x, mapRect.y, mapRect.x + mapRect.width, mapRect.y + mapRect.height);
    seaGrad.addColorStop(0, '#0b324d');
    seaGrad.addColorStop(0.55, '#0e4466');
    seaGrad.addColorStop(1, '#0a2940');
    ctx.fillStyle = seaGrad;
    ctx.fill();

    ctx.save();
    roundRect(ctx, mapRect.x, mapRect.y, mapRect.width, mapRect.height, 16);
    ctx.clip();

    // Subtle vintage latitude / longitude grid lines
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.08)';
    ctx.lineWidth = 1;
    for (let x = mapRect.x + 40; x < mapRect.x + mapRect.width; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, mapRect.y);
      ctx.lineTo(x, mapRect.y + mapRect.height);
      ctx.stroke();
    }
    for (let y = mapRect.y + 40; y < mapRect.y + mapRect.height; y += 52) {
      ctx.beginPath();
      ctx.moveTo(mapRect.x, y);
      ctx.lineTo(mapRect.x + mapRect.width, y);
      ctx.stroke();
    }

    // Stylized ocean waves in Biển Đông
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.14)';
    ctx.lineWidth = 1.5;
    const waveSpots = [
      [330, 210], [395, 225], [320, 340], [415, 360], [315, 420], [82, 345], [88, 410],
    ];
    for (let i = 0; i < waveSpots.length; i++) {
      const [wx, wy] = waveSpots[i];
      const shift = Math.sin(this.elapsed * 1.4 + i) * 3;
      ctx.beginPath();
      ctx.arc(wx + shift, wy, 7, Math.PI * 1.15, Math.PI * 1.85);
      ctx.arc(wx + 12 + shift, wy, 7, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // "BIỂN ĐÔNG" nautical label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(144, 224, 239, 0.25)';
    ctx.fillText('B I Ể N   Đ Ô N G', 384, 345);

    // Subtle neighboring sea shadow + Mainland Vietnam S-shape!
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 5;

    const landGrad = ctx.createLinearGradient(120, 80, 260, 500);
    landGrad.addColorStop(0, '#2a8f58');   // Northern lush highlands
    landGrad.addColorStop(0.45, '#3aa366'); // Central jade coast
    landGrad.addColorStop(1, '#52b768');   // Southern Mekong delta

    this.tracePolygon(ctx, this.mainlandPts);
    ctx.fillStyle = landGrad;
    ctx.fill();
    ctx.restore();

    // Inner highland texture tint & crisp golden border along Vietnam's S-coastline
    this.tracePolygon(ctx, this.mainlandPts);
    ctx.strokeStyle = '#f4d35e';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Đảo Phú Quốc (Southwest)
    this.tracePolygon(ctx, this.phuQuocPts);
    ctx.fillStyle = '#40916c';
    ctx.fill();
    ctx.strokeStyle = '#f4d35e';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const pq = projectVN(103.95, 10.18);
    ctx.textAlign = 'right';
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Phú Quốc', pq.x - 8, pq.y + 4);

    // Côn Đảo
    const cd = projectVN(106.60, 8.68);
    ctx.beginPath();
    ctx.arc(cd.x, cd.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#52b768';
    ctx.fill();
    ctx.strokeStyle = '#f4d35e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Quần đảo Hoàng Sa (Paracel Islands) — respectfully charted in Biển Đông
    this.renderArchipelago(
      ctx,
      368,
      274,
      [[-10, -4], [0, -7], [11, -2], [-5, 6], [6, 5], [16, 4]],
      'Quần đảo Hoàng Sa',
    );

    // Quần đảo Trường Sa (Spratly Islands) — respectfully charted in Biển Đông
    this.renderArchipelago(
      ctx,
      392,
      446,
      [[-14, -8], [-2, -12], [12, -5], [-10, 5], [3, 3], [16, 9], [-3, 13]],
      'Quần đảo Trường Sa',
    );

    // Vintage Compass Rose (bottom-left corner of map)
    this.renderCompass(ctx, 64, 480);

    // Animated golden dotted journey trail: Ch.1 -> Ch.2 -> Ch.3 -> Ch.4 -> Ch.5
    const journeyOrder = [1, 2, 3, 4, 5];
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < journeyOrder.length; i++) {
      const pin = CHAPTER_PINS.find((p) => p.chapterId === journeyOrder[i])!;
      const pt = projectVN(pin.lon, pin.lat);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -this.elapsed * 18;
    ctx.stroke();
    ctx.restore();

    // Interactive Chapter Pins directly on the Vietnam Map
    const save = this.engine.save.current;
    for (const pin of CHAPTER_PINS) {
      const chIdx = CHAPTERS.findIndex((c) => c.id === pin.chapterId);
      const ch = CHAPTERS[chIdx];
      const pt = projectVN(pin.lon, pin.lat);
      const unlocked = ch.levels[0] <= save.currentLevel;
      const isSelected = chIdx === this.selectedChapterIdx;

      // Pulsing radar ring on selected city
      if (isSelected) {
        const ringR = 16 + ((this.elapsed * 22) % 16);
        const ringAlpha = Math.max(0, 1 - (ringR - 16) / 16);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(252, 163, 17, ${ringAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Pin outer glow / circle
      const pinR = isSelected ? 15 : 12;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pinR, 0, Math.PI * 2);
      ctx.fillStyle = unlocked ? ch.color : '#475569';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#fff3b0' : '#fff';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Chapter number or lock icon inside pin
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = isSelected ? 'bold 13px monospace' : 'bold 11px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(unlocked ? `${ch.id}` : '🔒', pt.x, pt.y + 0.5);

      // City pill label beside pin
      const tagText = `${ch.name}`;
      ctx.font = isSelected ? 'bold 13px "Segoe UI", system-ui, sans-serif' : 'bold 11px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(tagText).width + 14;
      const th = 22;
      const tx = pin.labelAlign === 'left' ? pt.x + pin.labelDx - tw : pt.x + pin.labelDx;
      const ty = pt.y + pin.labelDy - th / 2;

      roundRect(ctx, tx, ty, tw, th, 6);
      ctx.fillStyle = isSelected ? 'rgba(17, 19, 38, 0.94)' : 'rgba(15, 23, 42, 0.78)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FCA311' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = isSelected ? 1.8 : 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#FCA311' : unlocked ? '#fff' : '#94a3b8';
      ctx.fillText(tagText, tx + tw / 2, ty + th / 2);
    }

    ctx.restore(); // end clip

    // Map border frame
    roundRect(ctx, mapRect.x, mapRect.y, mapRect.width, mapRect.height, 16);
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private renderArchipelago(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    dots: Array<[number, number]>,
    label: string,
  ): void {
    ctx.save();
    // Subtle maritime dashed box
    roundRect(ctx, cx - 32, cy - 20, 64, 40, 8);
    ctx.strokeStyle = 'rgba(244, 211, 94, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Island dots
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#52b768';
      ctx.fill();
      ctx.strokeStyle = '#f4d35e';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 9.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 243, 176, 0.72)';
    ctx.fillText(label, cx, cy + 23);
    ctx.restore();
  }

  private renderCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();

    // North arrow
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fillStyle = '#E63946';
    ctx.fill();

    // South arrow
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('B', 0, -20); // Bắc
    ctx.restore();
  }

  private tracePolygon(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
    if (pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
  }

  private renderLevelPanel(ctx: CanvasRenderingContext2D): void {
    const panel: Rect = { x: 508, y: 64, width: 432, height: 460 };
    const chapter = CHAPTERS[this.selectedChapterIdx];
    const levels = getLevelsByChapter(chapter.id);
    const save = this.engine.save.current;
    const chapterUnlocked = chapter.levels[0] <= save.currentLevel;

    let earnedStars = 0;
    const totalStars = chapter.levels.length * 3;
    for (const lv of chapter.levels) {
      earnedStars += save.levelStars[lv] ?? 0;
    }

    // Panel container
    roundRect(ctx, panel.x, panel.y, panel.width, panel.height, 16);
    ctx.fillStyle = 'rgba(22, 27, 48, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top colored region header
    roundRect(ctx, panel.x, panel.y, panel.width, 82, 16);
    ctx.fillStyle = chapterUnlocked ? chapter.color : '#334155';
    ctx.fill();
    ctx.fillStyle = 'rgba(22, 27, 48, 0.92)';
    ctx.fillRect(panel.x, panel.y + 66, panel.width, 16);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      `${chapterUnlocked ? '📍' : '🔒'} Ch.${chapter.id}: ${chapter.name}`,
      panel.x + 18,
      panel.y + 26,
      '#fff',
    );

    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${chapter.subtitle} • ${chapter.region}`, panel.x + 20, panel.y + 50);

    // Stars pill + Story Cutscene button on banner
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px monospace';
    drawTextShadow(ctx, `⭐ ${earnedStars}/${totalStars}`, panel.x + panel.width - 18, panel.y + 22, '#fff3b0');

    // "📖 Cốt truyện" button
    const sb = this.storyBtn;
    const sbHover = InputManager.hitTest(this.engine.input.pointer, sb);
    roundRect(ctx, sb.x, sb.y, sb.width, sb.height, 8);
    ctx.fillStyle = sbHover ? 'rgba(255,255,255,0.32)' : 'rgba(15, 19, 36, 0.52)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 243, 176, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `📖 Cốt truyện Ch.${chapter.id}`, sb.x + sb.width / 2, sb.y + sb.height / 2, '#fff3b0');

    // 5 columns × 2 rows of touch-friendly level circles
    const cols = 5;
    const circR = 31;
    const gapX = 78;
    const gapY = 98;
    const gridStartX = panel.x + (panel.width - (cols - 1) * gapX) / 2;
    const gridStartY = panel.y + 136;

    this.levelRects = [];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridStartX + col * gapX;
      const cy = gridStartY + row * gapY;

      const rect: Rect = { x: cx - circR, y: cy - circR, width: circR * 2, height: circR * 2 };
      this.levelRects.push(rect);

      const unlocked = level.id <= save.currentLevel;
      const isCurrent = level.id === save.currentLevel;
      const stars = save.levelStars[level.id] ?? 0;
      const hover = InputManager.hitTest(this.engine.input.pointer, rect);

      // Dashed connector to next level
      if (i < levels.length - 1 && col < cols - 1) {
        ctx.beginPath();
        ctx.moveTo(cx + circR + 2, cy);
        ctx.lineTo(cx + gapX - circR - 2, cy);
        ctx.strokeStyle = unlocked ? 'rgba(252,163,17,0.35)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, circR, 0, Math.PI * 2);
      if (!unlocked) {
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = hover || isCurrent ? chapter.color : this.darken(chapter.color, 0.25);
        ctx.fill();
        ctx.strokeStyle = isCurrent ? '#FCA311' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = isCurrent ? 3 : 2;
      }
      ctx.stroke();

      // Number or lock
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (unlocked) {
        ctx.font = 'bold 20px monospace';
        drawTextShadow(ctx, `${i + 1}`, cx, cy - 2, '#fff');
        const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        ctx.font = '11px "Segoe UI"';
        ctx.fillStyle = '#FCA311';
        ctx.fillText(starStr, cx, cy + circR + 14);
      } else {
        ctx.font = '18px "Segoe UI"';
        ctx.fillStyle = '#64748b';
        ctx.fillText('🔒', cx, cy + 1);
      }
    }

    // Bottom Cat NPC Regional Commentary Card
    const pinSpec = CHAPTER_PINS.find((p) => p.chapterId === chapter.id) ?? CHAPTER_PINS[0];
    const tipY = panel.y + panel.height - 104;
    const tipX = panel.x + 14;
    const tipW = panel.width - 28;
    const tipH = 90;

    roundRect(ctx, tipX, tipY, tipW, tipH, 12);
    ctx.fillStyle = 'rgba(15, 19, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(252, 163, 17, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cat avatar circle
    const avKey = pinSpec.catSpeaker === 'boss' ? 'npc_cat_boss' : 'npc_cat_golden';
    const avCx = tipX + 42;
    const avCy = tipY + tipH / 2;
    const avR = 32;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(252,163,17,0.14)';
    ctx.fill();
    ctx.clip();
    if (this.engine.assets.hasImage(avKey)) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage(avKey);
      const aspect = img.width / img.height;
      const drawW = aspect >= 1 ? avR * 2.15 : avR * 2.15 * aspect;
      const drawH = aspect >= 1 ? (avR * 2.15) / aspect : avR * 2.15;
      ctx.drawImage(img, avCx - drawW / 2, avCy - drawH / 2 + 2, drawW, drawH);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.strokeStyle = '#FCA311';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cat name & regional quote
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText(
      pinSpec.catSpeaker === 'boss' ? '👑 Vằn Bếp Trưởng' : '🐾 Mèo Vàng Phụ Bếp',
      tipX + 84,
      tipY + 10,
    );

    const tipMsg = chapterUnlocked
      ? pinSpec.catTip
      : `Hoàn thành các màn trước để mở khóa vùng ${chapter.name} nhé! Meow~`;
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    this.wrapText(ctx, tipMsg, tipX + 84, tipY + 28, tipW - 96, 18);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, cy);
        line = word + ' ';
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), x, cy);
  }

  private darken(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - amount))}, ${Math.floor(g * (1 - amount))}, ${Math.floor(b * (1 - amount))})`;
  }
}
