// ============================================================
// GangsterBattleScene — 🥊 Bảo Vệ Quán: Vằn & Mèo Vàng vs Mèo Giang Hồ!
// Tag-Team Rock-Paper-Scissors (Oẳn Tù Tì) Street Alley Showdown:
// - Vằn Bếp Trưởng & Mèo Vàng Phụ Bếp take turns fighting!
// - Uses the user's uploaded menacing Gangster Cat photo (npc_cat_gangster).
// - Winner of each round unleashes a hilarious animated brawl cloud!
// - Win: Gangster flees & game continues (+bonus tip).
// - Lose: Gangster steals 50% of the player's money!
// ============================================================

import type { Engine } from '../core/Engine';
import type { Scene, Rect } from '../types';
import { InputManager } from '../core/InputManager';
import { roundRect, drawTextShadow, drawProgressBar } from '../utils/draw';
import { clamp, formatMoney, randPick } from '../utils/math';
import { ParticleSystem } from '../systems/ParticleSystem';

type RpsMove = 'rock' | 'scissors' | 'paper';
type BattlePhase = 'intro' | 'choose' | 'countdown' | 'brawl' | 'victory' | 'defeat';

const RPS_META: Record<RpsMove, { label: string; emoji: string; sprite: string; color: string }> = {
  rock: { label: 'BÚA', emoji: '✊', sprite: 'rps_rock', color: '#E85D04' },
  scissors: { label: 'KÉO', emoji: '✌️', sprite: 'rps_scissors', color: '#E63946' },
  paper: { label: 'BAO', emoji: '✋', sprite: 'rps_paper', color: '#2A9D8F' },
};

const COMIC_HITS = ['💥 BỐP!!', '🐾 CÀO MÈO!!', '⚡ CHÁT!!', '🔥 MEOW KICK!!', '💢 ĐÁ XOÁY!!'];

export class GangsterBattleScene implements Scene {
  private engine: Engine;
  private onComplete: () => void;
  private particles = new ParticleSystem();

  private phase: BattlePhase = 'intro';
  private elapsed = 0;
  private phaseTimer = 0;

  // Tag-team fighter toggle: Vằn Bếp Trưởng & Mèo Vàng alternate every round!
  private activeHero: 'boss' | 'golden' = 'boss';
  private roundNumber = 1;

  // Health bars (3 HP each)
  private heroHp = 3;
  private readonly maxHp = 3;
  private gangsterHp = 3;

  // RPS round state
  private playerMove: RpsMove | null = null;
  private gangsterMove: RpsMove | null = null;
  private roundWinner: 'hero' | 'gangster' | 'tie' | null = null;
  private damageApplied = false;
  private hitWord = '💥 BỐP!!';
  private lostMoneyAmount = 0;
  private rewardMoney = 60;

  private bannerText = '🕶️ Đại Ca Mèo Giang Hồ chặn cửa đòi tiền bảo kê!!';
  private subText = 'Vằn Bếp Trưởng & Mèo Vàng sẽ luân phiên xuất trận Oẳn Tù Tì bảo vệ quán!';

  // Interactive buttons
  private rpsBtns: Array<{ move: RpsMove; rect: Rect }> = [
    { move: 'rock', rect: { x: 224, y: 422, width: 156, height: 92 } },
    { move: 'scissors', rect: { x: 402, y: 422, width: 156, height: 92 } },
    { move: 'paper', rect: { x: 580, y: 422, width: 156, height: 92 } },
  ];
  private actionBtn: Rect = { x: 340, y: 432, width: 280, height: 56 };
  private removeClick?: () => void;

  constructor(engine: Engine, onComplete: () => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('action');
    this.engine.audio.playSfx('meow');
    this.phase = 'intro';
    this.elapsed = 0;
    this.phaseTimer = 0;
    this.activeHero = 'boss';
    this.roundNumber = 1;
    this.heroHp = this.maxHp;
    this.gangsterHp = this.maxHp;
    this.playerMove = null;
    this.gangsterMove = null;
    this.roundWinner = null;
    this.damageApplied = false;
    this.lostMoneyAmount = 0;
    this.particles.clear();

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.phase = 'choose';
          this.bannerText = '👑 Lượt 1: Vằn Bếp Trưởng xuất trận!!';
          this.subText = 'Chọn BÚA ✊, KÉO ✌️ hoặc BAO ✋ để hạ gục Đại Ca Mèo Giang Hồ!';
        }
        return;
      }

      if (this.phase === 'choose') {
        for (const { move, rect } of this.rpsBtns) {
          if (InputManager.hitTest(pos, rect, 8)) {
            this.pickMove(move);
            return;
          }
        }
        return;
      }

      if (this.phase === 'victory' || this.phase === 'defeat') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.phaseTimer > 0.45) {
          this.onComplete();
        }
      }
    });
  }

  exit(): void {
    this.removeClick?.();
    this.removeClick = undefined;
  }

  private pickMove(move: RpsMove): void {
    this.engine.audio.playSfx('click');
    this.playerMove = move;
    this.gangsterMove = randPick<RpsMove>(['rock', 'scissors', 'paper']);
    this.roundWinner = this.resolveRps(move, this.gangsterMove);
    this.damageApplied = false;
    this.hitWord = randPick(COMIC_HITS);
    this.phase = 'countdown';
    this.phaseTimer = 0;
    this.bannerText = 'OẲN... TÙ... TÌ!! 🔥';
    this.subText = 'Cả hai bên tung chiêu!!';
  }

  private resolveRps(p: RpsMove, g: RpsMove): 'hero' | 'gangster' | 'tie' {
    if (p === g) return 'tie';
    if (
      (p === 'rock' && g === 'scissors') ||
      (p === 'scissors' && g === 'paper') ||
      (p === 'paper' && g === 'rock')
    ) {
      return 'hero';
    }
    return 'gangster';
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.phaseTimer += dt;
    this.particles.update(dt);

    if (this.phase === 'countdown') {
      if (this.phaseTimer >= 0.55) {
        this.phase = 'brawl';
        this.phaseTimer = 0;

        if (this.roundWinner === 'tie') {
          this.engine.audio.playSfx('pop');
          this.particles.emitStarburst(480, 260, '#ffd166', 18);
          this.bannerText = '⚡ HÒA NHAU!! TRÙNG CHIÊU RỒI!!';
          this.subText = 'Hai bên lườm nhau tóe lửa — chuẩn bị ra chiêu tiếp theo!';
        } else if (this.roundWinner === 'hero') {
          this.engine.audio.playSfx('punch');
          const heroName = this.activeHero === 'boss' ? '👑 Vằn Bếp Trưởng' : '🐾 Mèo Vàng';
          this.bannerText = `${heroName} THẮNG HIỆP ${this.roundNumber}!! LAO VÀO TẨN GIANG HỒ!!`;
          this.subText = `${this.hitWord} Đại Ca Mèo Giang Hồ lãnh trọn liên hoàn cước!`;
          this.particles.shake(9, 0.55);
        } else {
          this.engine.audio.playSfx('punch');
          this.bannerText = '🙀 ĐẠI CA MÈO GIANG HỒ PHẢN CÔNG!!';
          this.subText = `${this.hitWord} Ôi đau quá! Đổi đồng đội vào gánh tiếp thôi!!`;
          this.particles.shake(9, 0.55);
        }
      }
      return;
    }

    if (this.phase === 'brawl') {
      // Continuous comic dust sparks during brawl cloud!
      if (this.roundWinner !== 'tie' && this.phaseTimer < 1.0 && Math.random() < dt * 26) {
        const bx = this.roundWinner === 'hero' ? 620 : 340;
        this.particles.emitFireSparks(bx + (Math.random() - 0.5) * 90, 270 + (Math.random() - 0.5) * 70, 2);
      }

      // Apply HP hit midway through brawl animation!
      if (!this.damageApplied && this.phaseTimer >= 0.55) {
        this.damageApplied = true;
        this.engine.audio.playSfx('punch');
        if (this.roundWinner === 'hero') {
          this.gangsterHp = Math.max(0, this.gangsterHp - 1);
          this.particles.emitStarburst(650, 260, '#ffd166', 24);
          this.particles.emitFloatingText(650, 195, `${this.hitWord} -1 HP`, '#ffd166', 24);
        } else if (this.roundWinner === 'gangster') {
          this.heroHp = Math.max(0, this.heroHp - 1);
          this.particles.emitAngryPuff(300, 260);
          this.particles.emitFloatingText(300, 195, `${this.hitWord} -1 HP`, '#E63946', 24);
        }
      }

      const endDur = this.roundWinner === 'tie' ? 0.95 : 1.45;
      if (this.phaseTimer >= endDur) {
        if (this.gangsterHp <= 0) {
          this.phase = 'victory';
          this.phaseTimer = 0;
          this.engine.audio.playSfx('win');
          this.engine.save.addMoney(this.rewardMoney);
          this.particles.emitStarburst(480, 240, '#4CAF50', 36);
          this.particles.emitCoinShower(650, 250, 480, 120, 10);
          return;
        }
        if (this.heroHp <= 0) {
          this.phase = 'defeat';
          this.phaseTimer = 0;
          this.engine.audio.playSfx('lose');
          // Penalty: lose 50% of current money!
          const curMoney = this.engine.save.current.money;
          this.lostMoneyAmount = Math.floor(curMoney / 2);
          if (this.lostMoneyAmount > 0) {
            this.engine.save.spendMoney(this.lostMoneyAmount);
          }
          this.particles.emitAngryPuff(320, 260);
          this.particles.shake(8, 0.35);
          return;
        }

        // Next round: TAG-TEAM SWAP between Vằn Bếp Trưởng & Mèo Vàng!
        this.roundNumber++;
        this.activeHero = this.activeHero === 'boss' ? 'golden' : 'boss';
        this.playerMove = null;
        this.gangsterMove = null;
        this.roundWinner = null;
        this.phase = 'choose';
        this.phaseTimer = 0;
        if (this.activeHero === 'boss') {
          this.bannerText = `🔄 ĐỔI NGƯỜI! 👑 Vằn Bếp Trưởng bước lên võ đài (Hiệp ${this.roundNumber})!`;
          this.subText = 'Vằn: "Tránh ra để Bếp Trưởng dạy cho tên giang hồ một bài học!"';
        } else {
          this.bannerText = `🔄 ĐỔI NGƯỜI! 🐾 Mèo Vàng Phụ Bếp xung phong (Hiệp ${this.roundNumber})!`;
          this.subText = 'Mèo Vàng: "Tới lượt em gánh team!! Chọn Búa, Kéo hay Bao đây anh/chị ơi?"';
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Dramatic Neon Saigon Night Back-Alley Fighting Arena!
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_alley_arena')) {
      ctx.drawImage(this.engine.assets.getImage('bg_alley_arena'), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#141326';
      ctx.fillRect(0, 0, W, H);
    }

    // Subtle dark vignette for crisp readability
    ctx.fillStyle = 'rgba(10, 10, 22, 0.32)';
    ctx.fillRect(0, 0, W, H);

    // 2. Top Arcade Fighting Health Bars!
    this.renderHealthBars(ctx, W);

    // 3. Fighters on Stage!
    this.renderFighters(ctx);

    // 4. Center RPS Clash & Comic Brawl Cloud FX!
    this.renderCenterClash(ctx);

    // 5. Status Banner Strip above RPS buttons
    if (this.phase !== 'intro' && this.phase !== 'victory' && this.phase !== 'defeat') {
      roundRect(ctx, 110, 356, 740, 54, 14);
      ctx.fillStyle = 'rgba(15, 16, 32, 0.88)';
      ctx.fill();
      ctx.strokeStyle = '#FCA311';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, this.bannerText, W / 2, 374, '#FCA311');
      ctx.font = '13.5px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(this.subText, W / 2, 396);
    }

    // 6. RPS Choice Buttons during `choose` phase
    if (this.phase === 'choose') {
      const pointer = this.engine.input.pointer;
      for (const { move, rect } of this.rpsBtns) {
        const meta = RPS_META[move];
        const hover = InputManager.hitTest(pointer, rect);
        roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 16);
        ctx.fillStyle = hover ? meta.color : 'rgba(22, 22, 42, 0.92)';
        ctx.fill();
        ctx.strokeStyle = hover ? '#ffd166' : meta.color;
        ctx.lineWidth = hover ? 3.5 : 2.5;
        ctx.stroke();

        if (this.engine.assets.hasImage(meta.sprite)) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.engine.assets.getImage(meta.sprite), rect.x + rect.width / 2 - 28, rect.y + 8, 56, 56);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
        drawTextShadow(ctx, `${meta.emoji} ${meta.label}`, rect.x + rect.width / 2, rect.y + 76, '#fff');
      }
    }

    // 7. Particles
    this.particles.render(ctx);

    // 8. Intro / Victory / Defeat Modals
    if (this.phase === 'intro') {
      this.renderResultModal(
        ctx,
        '⚠️ BÁO ĐỘNG: MÈO GIANG HỒ ĐÒI TIỀN BẢO KÊ!',
        '#E63946',
        '🕶️ Đại Ca Mèo Giang Hồ: "Hế lô quán phở mới mở? Nộp nửa số tiền bảo kê đây, không thì đấu Oẳn Tù Tì tay đôi với ta!! ?"',
        '• 👑 Vằn Bếp Trưởng & 🐾 Mèo Vàng sẽ LUÂN PHIÊN xuất trận bảo vệ quán!\n• Đấu Oẳn Tù Tì (Búa ✊ / Kéo ✌️ / Bao ✋) — Ai thắng sẽ lao vào đánh lộn trừ 1 máu đối thủ!\n• Thắng: Đuổi cổ giang hồ (+60đ thưởng) & tiếp tục bán hàng!\n• Thua: Bị cướp mất 1 NỬA số tiền hiện có!',
        '🥊 BẢO VỆ QUÁN NGAY!',
      );
    } else if (this.phase === 'victory') {
      this.renderResultModal(
        ctx,
        '🏆 ĐUỔI CỔ GIANG HỒ THÀNH CÔNG!!',
        '#2d9348',
        '🕶️ Đại Ca Mèo Giang Hồ: "Á á tha cho đại ca!! Hai con mèo quán phở này đánh rát quá!! Chạy thôi!! 😭"',
        `🎉 Team Bếp Việt đại thắng bảo vệ an toàn xe đẩy & quán phở!\n• Thưởng người hùng khu phố: +${formatMoney(this.rewardMoney)}\n• Quỹ quán hiện tại: ${formatMoney(this.engine.save.current.money)}`,
        '🍜 TIẾP TỤC KINH DOANH!',
      );
    } else if (this.phase === 'defeat') {
      this.renderResultModal(
        ctx,
        '😿 THẤT BẠI! BỊ CƯỚP MẤT 1 NỬA TIỀN...',
        '#E63946',
        '🕶️ Đại Ca Mèo Giang Hồ: "Hê hê cảm ơn 50% tiền bảo kê nha mấy nhóc! Hẹn lần sau gặp lại!! ?"',
        `💸 Thiệt hại trận chiến:\n• Mất 1 nửa số tiền: -${formatMoney(this.lostMoneyAmount)}\n• Số tiền còn lại: ${formatMoney(this.engine.save.current.money)}\n• 👑 Vằn: "Không sao! Mình bán tiếp kiếm lại gấp đôi rồi trả thù nó!!"`,
        '💪 ĐỨNG DẬY BÁN TIẾP!',
      );
    }

    ctx.restore();
  }

  private renderHealthBars(ctx: CanvasRenderingContext2D, W: number): void {
    // Top bar dark backdrop
    ctx.fillStyle = 'rgba(10, 11, 24, 0.78)';
    ctx.fillRect(0, 0, W, 72);

    // Left: Team Bếp Việt HP
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    const activeTag = this.activeHero === 'boss' ? '👑 Vằn ĐANG ĐẤU' : '🐾 Mèo Vàng ĐANG ĐẤU';
    drawTextShadow(ctx, `TEAM BẾP VIỆT (${activeTag})`, 24, 20, '#FCA311');
    drawProgressBar(ctx, 24, 36, 340, 20, this.heroHp / this.maxHp, '#4CAF50');
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`❤️ ${this.heroHp} / ${this.maxHp} HP`, 194, 46);

    // Center VS badge
    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '⚡VS⚡', W / 2, 36, '#ffd166');

    // Right: Gangster Cat HP
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, '🕶️ ĐẠI CA MÈO GIANG HỒ', W - 24, 20, '#ff6b6b');
    drawProgressBar(ctx, W - 364, 36, 340, 20, this.gangsterHp / this.maxHp, '#E63946');
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`💀 ${this.gangsterHp} / ${this.maxHp} HP`, W - 194, 46);
  }

  private renderFighters(ctx: CanvasRenderingContext2D): void {
    const bob = Math.sin(this.elapsed * 5) * 5;
    const bounceReady = this.phase === 'countdown' ? Math.abs(Math.sin(this.phaseTimer * 22)) * -22 : 0;

    // Brawl dash offsets!
    let heroOffsetX = 0;
    let gangsterOffsetX = 0;
    let heroHurtFlash = false;
    let gangsterHurtFlash = false;

    if (this.phase === 'brawl' && this.roundWinner === 'hero') {
      const t = Math.sin(Math.min(1, this.phaseTimer / 0.9) * Math.PI);
      heroOffsetX = t * 250;
      gangsterOffsetX = t * 40;
      gangsterHurtFlash = this.phaseTimer > 0.35 && this.phaseTimer < 0.95;
    } else if (this.phase === 'brawl' && this.roundWinner === 'gangster') {
      const t = Math.sin(Math.min(1, this.phaseTimer / 0.9) * Math.PI);
      gangsterOffsetX = -t * 250;
      heroOffsetX = -t * 40;
      heroHurtFlash = this.phaseTimer > 0.35 && this.phaseTimer < 0.95;
    } else if (this.phase === 'victory') {
      // Gangster spins away off-screen!
      gangsterOffsetX = Math.min(420, this.phaseTimer * 420);
    }

    ctx.imageSmoothingEnabled = true;

    // 1. Standby Tag-Team Partner waiting in back-left corner!
    const standbyKey = this.activeHero === 'boss' ? 'npc_cat_golden' : 'npc_cat_boss';
    if (this.engine.assets.hasImage(standbyKey)) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      const img = this.engine.assets.getImage(standbyKey);
      const dh = 108;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, 24, 218 - bob * 0.6, dw, dh);
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('Dự bị 🔄', 24 + dw / 2, 336);
      ctx.restore();
    }

    // 2. Active Hero Cat Fighter (Vằn or Mèo Vàng) on Left!
    const activeKey = this.activeHero === 'boss' ? 'npc_cat_boss' : 'npc_cat_golden';
    const heroX = 240 + heroOffsetX;
    const heroY = 235 + bob + bounceReady;
    if (this.engine.assets.hasImage(activeKey)) {
      ctx.save();
      // Fighter shadow & golden ring
      ctx.beginPath();
      ctx.ellipse(heroX, 338, 66, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = heroHurtFlash ? '#E63946' : '#FCA311';
      ctx.lineWidth = 3;
      ctx.stroke();

      const img = this.engine.assets.getImage(activeKey);
      const dh = 172;
      const dw = (img.width / img.height) * dh;
      if (heroHurtFlash && Math.floor(this.elapsed * 24) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.drawImage(img, heroX - dw / 2, heroY - dh / 2, dw, dh);
      ctx.restore();
    }

    // 3. Menacing Gangster Cat Boss (user's uploaded photo!) on Right!
    const gX = 720 + gangsterOffsetX;
    const gY = 235 - bob + bounceReady;
    if (this.engine.assets.hasImage('npc_cat_gangster')) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(gX, 338, 72, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 3;
      ctx.stroke();

      const img = this.engine.assets.getImage('npc_cat_gangster');
      const dh = 182;
      const dw = (img.width / img.height) * dh;
      ctx.translate(gX, gY);
      if (this.phase === 'victory') {
        ctx.rotate(this.phaseTimer * 10);
      }
      if (gangsterHurtFlash && Math.floor(this.elapsed * 24) % 2 === 0) ctx.globalAlpha = 0.45;
      // Zero-blur glowing red fighter aura behind gangster cat (mobile 60fps safe!)
      ctx.beginPath();
      ctx.arc(0, 0, 88, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230, 57, 70, 0.22)';
      ctx.fill();
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  private renderCenterClash(ctx: CanvasRenderingContext2D): void {
    // Show RPS moves flying into center during brawl!
    if (this.phase === 'brawl' && this.playerMove && this.gangsterMove) {
      const pm = RPS_META[this.playerMove];
      const gm = RPS_META[this.gangsterMove];

      // Left chosen move badge
      this.drawMoveCard(ctx, 392, 162, pm, this.roundWinner === 'hero');
      // Right gangster move badge
      this.drawMoveCard(ctx, 568, 162, gm, this.roundWinner === 'gangster');

      // Hilarious Cartoon Brawl Dust Cloud over the loser during hit impact!
      if (this.roundWinner !== 'tie' && this.phaseTimer > 0.18 && this.phaseTimer < 1.1) {
        const cloudX = this.roundWinner === 'hero' ? 660 : 280;
        const cloudY = 248;
        const spin = this.elapsed * 12;
        const scale = 1.05 + Math.sin(this.elapsed * 28) * 0.16;

        ctx.save();
        ctx.translate(cloudX, cloudY);
        ctx.scale(scale, scale);
        ctx.rotate(spin);
        if (this.engine.assets.hasImage('brawl_cloud')) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.engine.assets.getImage('brawl_cloud'), -78, -78, 156, 156);
        }
        ctx.restore();

        // Comic action callout text popping on top of brawl cloud!
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
        drawTextShadow(ctx, this.hitWord, cloudX, cloudY - 56, '#ffd166');
        ctx.restore();
      }
    } else if (this.phase === 'countdown') {
      // Bouncing "OẲN TÙ TÌ!" indicator in center
      const s = 1 + Math.abs(Math.sin(this.phaseTimer * 18)) * 0.25;
      ctx.save();
      ctx.translate(480, 210);
      ctx.scale(s, s);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 42px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, '✊ ✌️ ✋', 0, 0, '#ffd166');
      ctx.restore();
    }
  }

  private drawMoveCard(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    meta: { label: string; emoji: string; sprite: string; color: string },
    isWinner: boolean,
  ): void {
    ctx.save();
    roundRect(ctx, cx - 54, cy - 54, 108, 108, 16);
    ctx.fillStyle = isWinner ? 'rgba(76, 175, 80, 0.9)' : 'rgba(15, 18, 36, 0.9)';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#ffd166' : meta.color;
    ctx.lineWidth = isWinner ? 4 : 2.5;
    ctx.stroke();

    if (this.engine.assets.hasImage(meta.sprite)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.engine.assets.getImage(meta.sprite), cx - 32, cy - 42, 64, 64);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, meta.label, cx, cy + 36, '#fff');
    ctx.restore();
  }

  private renderResultModal(
    ctx: CanvasRenderingContext2D,
    title: string,
    accent: string,
    quote: string,
    body: string,
    btnLabel: string,
  ): void {
    const W = 960;
    const H = 540;
    ctx.fillStyle = 'rgba(10, 10, 22, 0.8)';
    ctx.fillRect(0, 0, W, H);

    const cw = 680;
    const ch = 360;
    const cx = (W - cw) / 2;
    const cy = 74;

    roundRect(ctx, cx, cy, cw, ch, 20);
    ctx.fillStyle = '#1c1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Gangster cat menacing mugshot on right!
    if (this.engine.assets.hasImage('npc_cat_gangster')) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage('npc_cat_gangster');
      const dh = 132;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, cx + cw - dw - 20, cy + 72, dw, dh);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, W / 2, cy + 38, '#FCA311');

    // Quote bubble
    roundRect(ctx, cx + 22, cy + 72, cw - 196, 74, 12);
    ctx.fillStyle = 'rgba(230, 57, 70, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 57, 70, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    this.wrapText(ctx, quote, cx + 34, cy + 84, cw - 222, 20);

    // Body details
    let ly = cy + 166;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    for (const line of body.split('\n')) {
      ly = this.wrapText(ctx, line, cx + 28, ly, cw - 206, 21) + 4;
    }

    // Button
    const btn = this.actionBtn;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, btnLabel, btn.x + btn.width / 2, btn.y + btn.height / 2, '#fff');
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number,
  ): number {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const w of words) {
      const t = line + w + ' ';
      if (ctx.measureText(t).width > maxW && line) {
        ctx.fillText(line.trim(), x, cy);
        line = w + ' ';
        cy += lh;
      } else {
        line = t;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, cy);
      cy += lh;
    }
    return cy;
  }
}
