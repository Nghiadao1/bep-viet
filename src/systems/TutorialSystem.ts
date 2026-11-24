// ============================================================
// TutorialSystem — Visual-Novel & Interactive Guided Tutorial
// starring the 2 Cat NPCs: Sư Phụ Mèo Tai Cụp & Tiểu Mèo Vàng
// ============================================================

import type { Engine } from '../core/Engine';
import type { Rect, Vec2 } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow } from '../utils/draw';

export type TutorialStage =
  | 'none'
  | 'intro_boss'
  | 'intro_golden'
  | 'prep_phase'
  | 'service_mix'
  | 'service_serve'
  | 'celebrate';

export interface TutorialTarget {
  rect: Rect;
  label?: string;
}

interface DialogueMeta {
  speaker: 'boss' | 'golden' | 'both';
  name: string;
  badgeColor: string;
  text: string;
  cta?: string;
  modal: boolean;
}

const DIALOGUES: Record<Exclude<TutorialStage, 'none'>, DialogueMeta> = {
  intro_boss: {
    speaker: 'boss',
    name: '👑 Vằn Bếp Trưởng',
    badgeColor: '#FCA311',
    text: 'Meow~! Ta là Vằn Bếp Trưởng! Khởi nghiệp từ chiếc Xe Đẩy Vỉa Hè nhỏ này, tụi mình sẽ chia mỗi ngày làm 2 Pha: Pha 1 Sơ Chế nguyên liệu trước, Pha 2 Mở Xe Đẩy bày bán Pick & Mix!',
    cta: 'Tiếp tục ▶',
    modal: true,
  },
  intro_golden: {
    speaker: 'golden',
    name: '🐾 Mèo Vàng Phụ Bếp',
    badgeColor: '#F4A261',
    text: 'Em là Mèo Vàng Phụ Bếp nè! Trong Pha 1 Sơ Chế, mục tiêu sẽ dịch chuyển liên tục — làm càng chuẩn càng nhiều phần dự trữ! Xong hết là mình bày ra khay để ghép món bán siêu tốc!',
    cta: 'Vào Pha 1 Sơ Chế! 🔥',
    modal: true,
  },
  prep_phase: {
    speaker: 'boss',
    name: '👑 Vằn Bếp Trưởng',
    badgeColor: '#FCA311',
    text: 'PHA 1 — SƠ CHẾ: Chạm vào các khay nguyên liệu phát sáng trên quầy để nấu nước dùng, thái thịt, bắt sâu rau & chém hành tỏi trước khi mở quán nhé!',
    modal: false,
  },
  service_mix: {
    speaker: 'golden',
    name: '🐾 Mèo Vàng Phụ Bếp',
    badgeColor: '#F4A261',
    text: 'PHA 2 — BÀY BÁN PICK & MIX: Chạm vào các khay nguyên liệu đã sơ chế (viền vàng sáng) + chọn đúng gia vị bên dưới theo phiếu khách gọi để ghép thành món!',
    modal: false,
  },
  service_serve: {
    speaker: 'golden',
    name: '🐾 Mèo Vàng Phụ Bếp',
    badgeColor: '#4CAF50',
    text: 'Ghép đủ nguyên liệu rồi!! Thêm gia vị khách muốn (tránh món bị cấm 🚫) rồi chạm vào Đĩa xanh "🍽️ GIAO!" hoặc chạm thẳng vào khách nhé!',
    modal: false,
  },
  celebrate: {
    speaker: 'both',
    name: '👑 Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp',
    badgeColor: '#4CAF50',
    text: 'Xuất sắc!! Đã hiểu trọn quy trình Sơ Chế → Pick & Mix rồi! Kiếm thật nhiều tiền nâng cấp từ Xe Đẩy lên Nhà Hàng 5 Sao và cẩn thận Mèo Giang Hồ đó nha! Meow~ ⭐',
    cta: 'Chiến tiếp thôi! 🔥',
    modal: true,
  },
};

export class TutorialSystem {
  private engine: Engine;
  private stage: TutorialStage = 'none';
  private elapsed = 0;
  private stageTime = 0;
  private dynamicHint = '';

  private skipBtn: Rect = { x: 842, y: 58, width: 96, height: 34 };
  private modalNextBtn: Rect = { x: 676, y: 454, width: 204, height: 46 };
  private modalBoxRect: Rect = { x: 64, y: 344, width: 832, height: 172 };

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /** Start the interactive tutorial from the beginning */
  start(): void {
    this.stage = 'intro_boss';
    this.elapsed = 0;
    this.stageTime = 0;
    this.dynamicHint = '';
  }

  /** Stop and mark tutorial as completed */
  finish(): void {
    this.stage = 'none';
    this.engine.save.update({ tutorialCompleted: true });
  }

  get currentStage(): TutorialStage {
    return this.stage;
  }

  get isActive(): boolean {
    return this.stage !== 'none';
  }

  /** True when the tutorial modal is blocking normal gameplay updates/clicks */
  get isModalBlocking(): boolean {
    if (this.stage === 'none') return false;
    return DIALOGUES[this.stage].modal;
  }

  /** True when customer patience & countdown should pause so player can learn comfortably */
  get shouldFreezeTimers(): boolean {
    return (
      this.stage === 'intro_boss' ||
      this.stage === 'intro_golden' ||
      this.stage === 'prep_phase' ||
      this.stage === 'service_mix' ||
      this.stage === 'celebrate'
    );
  }

  /** Notify tutorial when Prep Phase finishes and Service Phase opens */
  onServicePhaseStarted(): void {
    if (this.stage === 'prep_phase') {
      this.setStage('service_mix');
    }
  }

  /** Notify tutorial when the player has mixed all required base ingredients */
  onDishReadyToServe(): void {
    if (this.stage === 'service_mix') {
      this.setStage('service_serve');
    }
  }

  /** Update hint text for the current step */
  setDynamicHint(hint: string): void {
    this.dynamicHint = hint;
  }

  /** Notify tutorial when player serves their first dish successfully */
  onFirstCustomerServed(): void {
    if (this.stage !== 'none' && this.stage !== 'celebrate') {
      this.setStage('celebrate');
    }
  }

  private setStage(next: TutorialStage): void {
    this.stage = next;
    this.stageTime = 0;
    if (next !== 'none') {
      const sp = DIALOGUES[next].speaker;
      this.engine.audio.playCatVoice(sp);
    }
  }

  update(dt: number): void {
    if (this.stage === 'none') return;
    this.elapsed += dt;
    this.stageTime += dt;
  }

  /**
   * Handle click/tap. Returns true if the tutorial consumed the input
   * (e.g., modal dialogue or Skip button).
   */
  handleClick(pos: Vec2): boolean {
    if (this.stage === 'none') return false;

    const meta = DIALOGUES[this.stage];

    // Skip button is always tappable except on final celebration
    if (this.stage !== 'celebrate' && InputManager.hitTest(pos, this.skipBtn, 8)) {
      this.finish();
      return true;
    }

    // Modal dialogues consume taps anywhere on the dialogue card / CTA button
    if (meta.modal) {
      const fullText = meta.text;
      const charsShown = Math.floor(this.stageTime * 55);
      // First tap finishes typewriter immediately; second tap advances
      if (charsShown < fullText.length && InputManager.hitTest(pos, this.modalBoxRect, 20)) {
        this.stageTime = 10;
        return true;
      }

      if (
        InputManager.hitTest(pos, this.modalNextBtn, 10) ||
        InputManager.hitTest(pos, this.modalBoxRect, 12)
      ) {
        if (this.stage === 'intro_boss') {
          this.setStage('intro_golden');
        } else if (this.stage === 'intro_golden') {
          this.setStage('prep_phase');
        } else if (this.stage === 'celebrate') {
          this.finish();
        }
      }
      return true;
    }

    // Interactive steps: let clicks pass through to recipe cards & stations!
    return false;
  }

  render(ctx: CanvasRenderingContext2D, W: number, H: number, target?: TutorialTarget | null): void {
    if (this.stage === 'none') return;

    const meta = DIALOGUES[this.stage];
    if (meta.modal) {
      this.renderModalDialogue(ctx, W, H, meta);
    } else {
      this.renderInteractiveGuide(ctx, W, meta, target ?? null);
    }
  }

  // ---- Full Visual-Novel Modal (Intro & Celebration with both Cat NPCs) ----

  private renderModalDialogue(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    meta: DialogueMeta,
  ): void {
    ctx.save();

    // Soft dark vignette over game scene
    ctx.fillStyle = 'rgba(10, 12, 26, 0.72)';
    ctx.fillRect(0, 0, W, H);

    const bobA = Math.sin(this.elapsed * 3.2) * 5;
    const bobB = Math.sin(this.elapsed * 3.2 + 1.4) * 5;

    // Draw Cat NPC portraits standing cleanly right above the dialogue box
    ctx.imageSmoothingEnabled = true;

    // Left: Sư Phụ Mèo Tai Cụp (cat_boss)
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const active = meta.speaker === 'boss' || meta.speaker === 'both';
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.42;
      const scale = active ? 1 : 0.9;
      const img = this.engine.assets.getImage('npc_cat_boss');
      const drawH = 225 * scale;
      const drawW = (img.width / img.height) * drawH;
      const x = 92;
      const y = this.modalBoxRect.y - drawH + 26 + (active ? bobA : 0);

      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.restore();
    }

    // Right: Tiểu Mèo Vàng (cat_golden)
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const active = meta.speaker === 'golden' || meta.speaker === 'both';
      if (meta.speaker !== 'boss') {
        ctx.save();
        ctx.globalAlpha = active ? 1 : 0.42;
        const scale = active ? 1 : 0.9;
        const img = this.engine.assets.getImage('npc_cat_golden');
        const drawH = 195 * scale;
        const drawW = (img.width / img.height) * drawH;
        const x = W - drawW - 96;
        const y = this.modalBoxRect.y - drawH + 26 + (active ? bobB : 0);

        ctx.drawImage(img, x, y, drawW, drawH);
        ctx.restore();
      }
    }

    // Celebration sparkles when both cats cheer!
    if (meta.speaker === 'both') {
      const sparkles = [
        [240, 120], [480, 96], [710, 130], [360, 170], [600, 165],
      ];
      ctx.font = '24px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < sparkles.length; i++) {
        const [sx, sy] = sparkles[i];
        const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 5 + i);
        ctx.globalAlpha = pulse;
        ctx.fillText(i % 2 === 0 ? '✨' : '⭐', sx, sy + Math.sin(this.elapsed * 3 + i) * 6);
      }
      ctx.globalAlpha = 1;
    }

    // Dialogue box frame
    const box = this.modalBoxRect;
    roundRect(ctx, box.x, box.y, box.width, box.height, 18);
    const boxGrad = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
    boxGrad.addColorStop(0, 'rgba(24, 22, 42, 0.97)');
    boxGrad.addColorStop(1, 'rgba(15, 14, 28, 0.98)');
    ctx.fillStyle = boxGrad;
    ctx.fill();
    ctx.strokeStyle = meta.badgeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Speaker name pill sitting on top edge of dialogue box
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    const nameW = Math.max(210, ctx.measureText(meta.name).width + 36);
    const nameX = meta.speaker === 'golden' ? box.x + box.width - nameW - 24 : box.x + 24;
    const nameY = box.y - 18;
    roundRect(ctx, nameX, nameY, nameW, 34, 17);
    ctx.fillStyle = meta.badgeColor;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextShadow(ctx, meta.name, nameX + nameW / 2, nameY + 17, '#1a1418', 'rgba(255,255,255,0.25)', 1);

    // Typewriter dialogue text
    const visibleLen = Math.min(meta.text.length, Math.floor(this.stageTime * 55));
    const shownText = meta.text.slice(0, visibleLen);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapText(ctx, shownText, box.x + 28, box.y + 30, box.width - 56, 28);

    // CTA button
    const btn = this.modalNextBtn;
    const pulse = 1 + Math.sin(this.elapsed * 5) * 0.025;
    ctx.save();
    ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
    ctx.scale(pulse, pulse);
    roundRect(ctx, -btn.width / 2, -btn.height / 2, btn.width, btn.height, 12);
    ctx.fillStyle = this.stage === 'celebrate' ? '#2a9d8f' : '#E85D04';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, meta.cta ?? 'Tiếp tục ▶', 0, 0, '#fff');
    ctx.restore();

    // Tap hint left bottom of box
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Chạm khung thoại để tiếp tục...', box.x + 28, btn.y + btn.height / 2);

    // Skip button top-right of dialogue box (never collides with Pause button!)
    if (this.stage !== 'celebrate') {
      this.skipBtn = { x: box.x + box.width - 108, y: box.y + 12, width: 94, height: 30 };
      this.renderSkipButton(ctx);
    }

    ctx.restore();
  }

  // ---- Non-Blocking Interactive Guided Bubble + Cat Portrait + Spotlight Arrow ----

  private renderInteractiveGuide(
    ctx: CanvasRenderingContext2D,
    W: number,
    meta: DialogueMeta,
    target: TutorialTarget | null,
  ): void {
    ctx.save();

    // Highlight ring + bouncing arrow around target card/station
    if (target) {
      const r = target.rect;
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsed * 8);
      const pad = 6 + Math.sin(this.elapsed * 8) * 3;

      ctx.save();
      roundRect(ctx, r.x - pad, r.y - pad, r.width + pad * 2, r.height + pad * 2, 14);
      ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      // Animated bouncing hand pointer directly above target
      const bob = Math.sin(this.elapsed * 7) * 7;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '32px "Segoe UI"';
      ctx.fillText('👇', r.x + r.width / 2, r.y - 22 + bob);
    }

    // Floating Cat NPC Guide Card at upper-right (leaves left customer & counter totally clear!)
    const cardW = 540;
    const cardH = 92;
    const cardX = W - cardW - 18;
    const cardY = 56;

    roundRect(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fillStyle = 'rgba(17, 19, 38, 0.94)';
    ctx.fill();
    ctx.strokeStyle = meta.badgeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cat NPC avatar circle on left of floating card
    const avatarKey = meta.speaker === 'boss' ? 'npc_cat_boss' : 'npc_cat_golden';
    const avCx = cardX + 46;
    const avCy = cardY + cardH / 2;
    const avR = 36;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(252, 163, 17, 0.16)';
    ctx.fill();
    ctx.clip();

    if (this.engine.assets.hasImage(avatarKey)) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage(avatarKey);
      const aspect = img.width / img.height;
      const drawW = aspect >= 1 ? avR * 2.15 : avR * 2.15 * aspect;
      const drawH = aspect >= 1 ? (avR * 2.15) / aspect : avR * 2.15;
      ctx.drawImage(img, avCx - drawW / 2, avCy - drawH / 2 + 2, drawW, drawH);
    }
    ctx.restore();

    // Avatar gold ring
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.strokeStyle = meta.badgeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Speaker name
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = meta.badgeColor;
    ctx.fillText(meta.name, cardX + 94, cardY + 10);

    // Body text (with optional dynamic hint)
    const bodyText =
      this.dynamicHint && (this.stage === 'prep_phase' || this.stage === 'service_mix')
        ? this.dynamicHint
        : meta.text;

    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#f8f9fa';
    this.wrapText(ctx, bodyText, cardX + 94, cardY + 30, cardW - 116, 19);

    // Skip button top-right corner of the card
    this.skipBtn = { x: cardX + cardW - 86, y: cardY + 6, width: 78, height: 24 };
    this.renderSkipButton(ctx);

    ctx.restore();
  }

  private renderSkipButton(ctx: CanvasRenderingContext2D): void {
    const s = this.skipBtn;
    roundRect(ctx, s.x, s.y, s.width, s.height, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#FCA311';
    ctx.fillText('Bỏ qua ✕', s.x + s.width / 2, s.y + s.height / 2);
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
    if (line.trim()) {
      ctx.fillText(line.trim(), x, cy);
    }
  }
}
