// ============================================================
// TienLenScene — 🃏 Tiến Lên Miền Nam: Vằn Bếp Trưởng Trốn Bán Đi Đánh Bài!
// Authentic Vietnamese Southern Thirteen (Tiến Lên Miền Nam) quick 8-card
// showdown! Supports Singles, Pairs, Triples, Straights (3+), and
// Four-of-a-Kind (Tứ Quý Chặt Heo 2!).
// - WIN: Vằn collects winnings (+90đ) & returns happily to sell phở!
// - LOSE: Vằn gets SALTY (cay cú) and forces another rematch, delaying
//   restaurant opening time (-8s per lost match)!!
// ============================================================

import type { Engine } from '../../core/Engine';
import type { Scene, Rect } from '../../types';
import { InputManager } from '../../core/InputManager';
import { roundRect, drawTextShadow } from '../../utils/draw';
import { formatMoney, shuffle } from '../../utils/math';
import { ParticleSystem } from '../../systems/ParticleSystem';

// Rank 0..12 => 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2 (Heo!)
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
// Suit 0..3 => ♠ Bích < ♣ Chuồn < ♦ Rô < ♥ Cơ
const SUITS = ['♠', '♣', '♦', '♥'] as const;

interface Card {
  id: number;
  rank: number; // 0..12 (12 = Heo '2')
  suit: number; // 0..3 (3 = ♥)
}

type ComboType = 'single' | 'pair' | 'triple' | 'straight' | 'quad';

interface PlayCombo {
  type: ComboType;
  cards: Card[];
  length: number;
  highCard: Card; // determines tie-breaker strength!
  label: string;
}

function cardPower(c: Card): number {
  return c.rank * 4 + c.suit;
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardPower(a) - cardPower(b));
}

function analyzeCombo(raw: Card[]): PlayCombo | null {
  if (raw.length === 0) return null;
  const cards = sortCards(raw);
  const n = cards.length;
  const high = cards[n - 1];

  if (n === 1) {
    return { type: 'single', cards, length: 1, highCard: high, label: `Lá lẻ ${RANKS[high.rank]}${SUITS[high.suit]}` };
  }
  if (n === 2 && cards[0].rank === cards[1].rank) {
    return { type: 'pair', cards, length: 2, highCard: high, label: `Đôi ${RANKS[high.rank]}` };
  }
  if (n === 3 && cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank) {
    return { type: 'triple', cards, length: 3, highCard: high, label: `Sám cô ${RANKS[high.rank]}` };
  }
  if (n === 4 && cards.every((c) => c.rank === cards[0].rank)) {
    return { type: 'quad', cards, length: 4, highCard: high, label: `🔥 TỨ QUÝ ${RANKS[high.rank]}!` };
  }
  // Straight (Sảnh): 3+ consecutive ranks, cannot contain '2' (rank 12)!
  if (n >= 3 && !cards.some((c) => c.rank === 12)) {
    let ok = true;
    for (let i = 1; i < n; i++) {
      if (cards[i].rank !== cards[i - 1].rank + 1) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return {
        type: 'straight',
        cards,
        length: n,
        highCard: high,
        label: `Sảnh ${n} lá (${RANKS[cards[0].rank]}→${RANKS[high.rank]})`,
      };
    }
  }
  return null;
}

function canBeat(play: PlayCombo, table: PlayCombo | null): boolean {
  if (!table) return true;
  // Tứ quý CHẶT HEO (Single 2 or Pair of 2s)!
  if (play.type === 'quad') {
    if ((table.type === 'single' || table.type === 'pair') && table.highCard.rank === 12) {
      return true;
    }
    if (table.type === 'quad') return cardPower(play.highCard) > cardPower(table.highCard);
    return false;
  }
  if (play.type !== table.type || play.length !== table.length) return false;
  return cardPower(play.highCard) > cardPower(table.highCard);
}

/** Find the weakest legal play from `hand` that beats `table` (used by both AI & Hint button!) */
function findSmallestLegalPlay(hand: Card[], table: PlayCombo | null): Card[] | null {
  const sorted = sortCards(hand);

  // If leading a fresh round: prefer longest straight, then pair, then lowest single!
  if (!table) {
    // Check 3+ straight
    const byRank = new Map<number, Card>();
    for (const c of sorted) {
      if (c.rank < 12 && !byRank.has(c.rank)) byRank.set(c.rank, c);
    }
    const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
    let bestRun: Card[] = [];
    let curRun: Card[] = [];
    for (const r of ranks) {
      if (curRun.length === 0 || r === curRun[curRun.length - 1].rank + 1) {
        curRun.push(byRank.get(r)!);
      } else {
        if (curRun.length >= 3 && curRun.length > bestRun.length) bestRun = [...curRun];
        curRun = [byRank.get(r)!];
      }
    }
    if (curRun.length >= 3 && curRun.length > bestRun.length) bestRun = [...curRun];
    if (bestRun.length >= 3) return bestRun;

    // Check lowest pair (non-2)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].rank === sorted[i + 1].rank && sorted[i].rank < 12) {
        return [sorted[i], sorted[i + 1]];
      }
    }
    return sorted.length > 0 ? [sorted[0]] : null;
  }

  // Must beat `table`:
  if (table.type === 'single') {
    for (const c of sorted) {
      const p = analyzeCombo([c]);
      if (p && canBeat(p, table)) return [c];
    }
  } else if (table.type === 'pair') {
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].rank === sorted[i + 1].rank) {
        const pair = [sorted[i], sorted[i + 1]];
        const p = analyzeCombo(pair);
        if (p && canBeat(p, table)) return pair;
      }
    }
  } else if (table.type === 'triple') {
    for (let i = 0; i < sorted.length - 2; i++) {
      if (sorted[i].rank === sorted[i + 1].rank && sorted[i + 1].rank === sorted[i + 2].rank) {
        const tri = [sorted[i], sorted[i + 1], sorted[i + 2]];
        const p = analyzeCombo(tri);
        if (p && canBeat(p, table)) return tri;
      }
    }
  } else if (table.type === 'straight') {
    const need = table.length;
    const rankBuckets = new Map<number, Card[]>();
    for (const c of sorted) {
      if (c.rank >= 12) continue;
      if (!rankBuckets.has(c.rank)) rankBuckets.set(c.rank, []);
      rankBuckets.get(c.rank)!.push(c);
    }
    for (let startR = 0; startR <= 12 - need; startR++) {
      const candidate: Card[] = [];
      let ok = true;
      for (let k = 0; k < need; k++) {
        const bucket = rankBuckets.get(startR + k);
        if (!bucket || bucket.length === 0) { ok = false; break; }
        // Pick strongest suit for last card to maximize beating chance, weakest for earlier cards
        candidate.push(k === need - 1 ? bucket[bucket.length - 1] : bucket[0]);
      }
      if (ok) {
        const p = analyzeCombo(candidate);
        if (p && canBeat(p, table)) return candidate;
      }
    }
  }

  // Check Tứ Quý chặt Heo!
  if ((table.type === 'single' || table.type === 'pair') && table.highCard.rank === 12) {
    for (let i = 0; i < sorted.length - 3; i++) {
      if (
        sorted[i].rank === sorted[i + 1].rank &&
        sorted[i + 1].rank === sorted[i + 2].rank &&
        sorted[i + 2].rank === sorted[i + 3].rank
      ) {
        return [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
      }
    }
  }

  return null;
}

export class TienLenScene implements Scene {
  private engine: Engine;
  private onComplete: (delayPenaltySec: number) => void;
  private particles = new ParticleSystem();

  private phase: 'intro' | 'playing' | 'won' | 'salty_loss' = 'intro';
  private elapsed = 0;
  private matchNumber = 1;
  private totalDelaySec = 0;

  private playerHand: Card[] = [];
  private aiHand: Card[] = [];
  private selectedIds = new Set<number>();
  private tablePlay: PlayCombo | null = null;
  private tableOwner: 'player' | 'ai' | null = null;
  private turn: 'player' | 'ai' = 'player';
  private aiThinkTimer = 0;

  private tableMessage = 'Lượt của Vằn Bếp Trưởng! Chọn lá bài rồi bấm ĐÁNH!';
  private rewardMoney = 90;

  // Interactive Buttons
  private playBtn: Rect = { x: 356, y: 342, width: 156, height: 48 };
  private passBtn: Rect = { x: 526, y: 342, width: 140, height: 48 };
  private hintBtn: Rect = { x: 224, y: 342, width: 118, height: 48 };
  private actionBtn: Rect = { x: 340, y: 432, width: 280, height: 54 };
  private dragBackBtn: Rect = { x: 510, y: 432, width: 250, height: 54 };
  private saltyRematchBtn: Rect = { x: 200, y: 432, width: 280, height: 54 };

  private cardRects: Array<{ card: Card; rect: Rect }> = [];
  private removeClick?: () => void;

  constructor(engine: Engine, onComplete: (delayPenaltySec: number) => void) {
    this.engine = engine;
    this.onComplete = onComplete;
  }

  enter(): void {
    this.engine.input.clear();
    this.engine.audio.playBgm('kitchen');
    this.engine.audio.playCatVoice('boss');
    this.phase = 'intro';
    this.elapsed = 0;
    this.matchNumber = 1;
    this.totalDelaySec = 0;
    this.particles.clear();
    this.dealMatch();

    this.removeClick = this.engine.input.onClick((pos) => {
      if (this.phase === 'intro') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.35) {
          this.engine.audio.playSfx('click');
          this.phase = 'playing';
        }
        return;
      }

      if (this.phase === 'won') {
        if (InputManager.hitTest(pos, this.actionBtn, 20) || this.elapsed > 0.4) {
          this.engine.audio.playSfx('click');
          this.onComplete(this.totalDelaySec);
        }
        return;
      }

      if (this.phase === 'salty_loss') {
        // After 1st loss, Vằn is SO salty he insists on playing another hand!
        // On rematch #2+, Mèo Vàng offers a rescue pull-back button beside Rematch!
        if (this.matchNumber >= 2 && InputManager.hitTest(pos, this.dragBackBtn, 12)) {
          this.engine.audio.playCatVoice('golden');
          this.engine.audio.playSfx('click');
          this.onComplete(this.totalDelaySec);
          return;
        }
        const rematchTarget = this.matchNumber >= 2 ? this.saltyRematchBtn : this.actionBtn;
        if (InputManager.hitTest(pos, rematchTarget, 16)) {
          this.matchNumber++;
          this.engine.audio.playCatVoice('boss');
          this.engine.audio.playSfx('click');
          this.dealMatch();
          this.phase = 'playing';
        }
        return;
      }

      if (this.turn !== 'player') return;

      // 1. Check cards from RIGHT to LEFT so overlapping cards hit front-most first!
      for (let i = this.cardRects.length - 1; i >= 0; i--) {
        const { card, rect } = this.cardRects[i];
        if (InputManager.hitTest(pos, rect, 2)) {
          if (this.selectedIds.has(card.id)) this.selectedIds.delete(card.id);
          else this.selectedIds.add(card.id);
          this.engine.audio.playSfx('click');
          this.layoutPlayerCards();
          return;
        }
      }

      // 2. Hint button
      if (InputManager.hitTest(pos, this.hintBtn, 6)) {
        const activeTable = this.tableOwner === 'player' ? null : this.tablePlay;
        const suggestion = findSmallestLegalPlay(this.playerHand, activeTable);
        this.selectedIds.clear();
        if (suggestion) {
          for (const c of suggestion) this.selectedIds.add(c.id);
          this.engine.audio.playSfx('pop');
          this.layoutPlayerCards();
        } else {
          this.engine.audio.playSfx('error');
          this.tableMessage = 'Không có bài chặn được! Bấm BỎ LƯỢT để nhường vòng nhé!';
        }
        return;
      }

      // 3. Play button
      if (InputManager.hitTest(pos, this.playBtn, 8)) {
        this.tryPlayerPlay();
        return;
      }

      // 4. Pass button
      if (InputManager.hitTest(pos, this.passBtn, 8)) {
        this.tryPlayerPass();
      }
    });
  }

  exit(): void {
    this.removeClick?.();
  }

  private dealMatch(): void {
    const deck: Card[] = [];
    let id = 1;
    for (let r = 0; r < 13; r++) {
      for (let s = 0; s < 4; s++) {
        deck.push({ id: id++, rank: r, suit: s });
      }
    }
    const shuffled = shuffle(deck);
    // Crisp 8-card fast Tiến Lên Miền Nam!
    this.playerHand = sortCards(shuffled.slice(0, 8));
    this.aiHand = sortCards(shuffled.slice(8, 16));
    this.selectedIds.clear();
    this.tablePlay = null;
    this.tableOwner = null;
    this.turn = 'player';
    this.aiThinkTimer = 0;
    this.tableMessage =
      this.matchNumber === 1
        ? 'Ván 1: Lượt của Vằn Bếp Trưởng! Ra bài đầu tiên nào!'
        : `🔥 VÁN GỠ #${this.matchNumber} (Trễ quán -${this.totalDelaySec}s): Vằn cay cú quyết gỡ!!`;
    this.layoutPlayerCards();
  }

  private layoutPlayerCards(): void {
    const n = this.playerHand.length;
    const cardW = 74;
    const cardH = 104;
    const step = n > 6 ? 66 : 78;
    const totalW = (n - 1) * step + cardW;
    const startX = (960 - totalW) / 2;

    this.cardRects = this.playerHand.map((card, i) => {
      const isSel = this.selectedIds.has(card.id);
      return {
        card,
        rect: {
          x: startX + i * step,
          y: isSel ? 404 : 422,
          width: cardW,
          height: cardH,
        },
      };
    });
  }

  private tryPlayerPlay(): void {
    const chosen = this.playerHand.filter((c) => this.selectedIds.has(c.id));
    const combo = analyzeCombo(chosen);
    if (!combo) {
      this.engine.audio.playSfx('error');
      this.tableMessage = '❌ Bộ bài không hợp lệ! (Đánh Lẻ, Đôi, Sám, Sảnh 3+ lá hoặc Tứ Quý)';
      return;
    }

    const activeTable = this.tableOwner === 'player' ? null : this.tablePlay;
    if (!canBeat(combo, activeTable)) {
      this.engine.audio.playSfx('error');
      this.tableMessage = `❌ ${combo.label} không chặn được ${activeTable?.label}!`;
      return;
    }

    // Valid play!
    this.playerHand = this.playerHand.filter((c) => !this.selectedIds.has(c.id));
    this.selectedIds.clear();
    this.tablePlay = combo;
    this.tableOwner = 'player';
    this.layoutPlayerCards();

    this.engine.audio.playSfx(combo.type === 'quad' || combo.highCard.rank === 12 ? 'perfect' : 'pop');
    this.particles.emitStarburst(480, 236, '#ffd166', 14);
    this.tableMessage = `👑 Vằn đánh: ${combo.label}!`;

    if (this.playerHand.length === 0) {
      this.phase = 'won';
      this.elapsed = 0;
      this.engine.save.addMoney(this.rewardMoney);
      this.engine.audio.playSfx('win');
      this.engine.audio.playCatVoice('both');
      this.particles.emitStarburst(480, 250, '#4CAF50', 32);
      return;
    }

    this.turn = 'ai';
    this.aiThinkTimer = 0.85;
  }

  private tryPlayerPass(): void {
    if (!this.tablePlay || this.tableOwner === 'player') {
      this.engine.audio.playSfx('error');
      this.tableMessage = 'Bạn đang được quyền đi đầu vòng — hãy chọn ít nhất 1 lá để đánh!';
      return;
    }
    this.selectedIds.clear();
    this.layoutPlayerCards();
    this.tablePlay = null;
    this.tableOwner = null;
    this.turn = 'ai';
    this.aiThinkTimer = 0.7;
    this.engine.audio.playSfx('click');
    this.tableMessage = '👑 Vằn bỏ lượt! Đối thủ được quyền đi vòng mới...';
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.particles.update(dt);

    if (this.phase !== 'playing') return;

    if (this.turn === 'ai') {
      this.aiThinkTimer -= dt;
      if (this.aiThinkTimer <= 0) {
        this.runAiTurn();
      }
    }
  }

  private runAiTurn(): void {
    const activeTable = this.tableOwner === 'ai' ? null : this.tablePlay;
    const playCards = findSmallestLegalPlay(this.aiHand, activeTable);

    if (!playCards) {
      // AI passes → player wins the round & leads fresh!
      this.tablePlay = null;
      this.tableOwner = null;
      this.turn = 'player';
      this.engine.audio.playSfx('pop');
      this.tableMessage = '🕶️ Đối thủ BỎ LƯỢT! Vằn được đi vòng mới tự do!!';
      return;
    }

    const combo = analyzeCombo(playCards)!;
    const ids = new Set(playCards.map((c) => c.id));
    this.aiHand = this.aiHand.filter((c) => !ids.has(c.id));
    this.tablePlay = combo;
    this.tableOwner = 'ai';

    this.engine.audio.playSfx('slice');
    this.particles.emitSliceSparks(480, 236, '#ff6b6b', 10);
    this.tableMessage = `🕶️ Mèo Giang Hồ chặt: ${combo.label}! (Còn ${this.aiHand.length} lá)`;

    if (this.aiHand.length === 0) {
      // PLAYER LOST → VẰN GETS SALTY AND DELAYS THE RESTAURANT SHIFT!
      this.phase = 'salty_loss';
      this.elapsed = 0;
      this.totalDelaySec += 8;
      this.engine.audio.playSfx('lose');
      this.engine.audio.playCatVoice('gangster');
      this.particles.shake(8, 0.3);
      return;
    }

    this.turn = 'player';
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = 960;
    const H = 540;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Cozy Green Felt Trà Đá Card Table Background (starts cleanly below HUD bar)!
    ctx.imageSmoothingEnabled = false;
    if (this.engine.assets.hasImage('bg_card_table')) {
      ctx.drawImage(this.engine.assets.getImage('bg_card_table'), 0, 42, W, H - 42);
    } else {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Top HUD Bar
    ctx.fillStyle = 'rgba(10, 12, 24, 0.9)';
    ctx.fillRect(0, 0, W, 42);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, `🃏 TIẾN LÊN MIỀN NAM — VÁN #${this.matchNumber}`, 18, 21, '#FCA311');

    ctx.textAlign = 'center';
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(
      ctx,
      this.totalDelaySec > 0
        ? `⏰ Vằn cay cú làm trễ mở quán: -${this.totalDelaySec}s`
        : '👑 Vằn trốn bán đánh bài! Thắng nhanh về mở quán phở!',
      520,
      21,
      this.totalDelaySec > 0 ? '#fca5a5' : '#80ed99',
    );

    ctx.textAlign = 'right';
    ctx.font = 'bold 15px monospace';
    drawTextShadow(ctx, `Đối thủ: ${this.aiHand.length} lá`, W - 18, 21, '#ffd166');

    // 3. Opponent (Mèo Giang Hồ) Portrait + Card Backs at Top!
    if (this.engine.assets.hasImage('npc_cat_gangster')) {
      ctx.imageSmoothingEnabled = true;
      const img = this.engine.assets.getImage('npc_cat_gangster');
      const dh = 84;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, 148, 60, dw, dh);
    }
    const aiStart = 480 - (this.aiHand.length * 36) / 2;
    for (let i = 0; i < this.aiHand.length; i++) {
      const cx = aiStart + i * 36;
      roundRect(ctx, cx, 66, 48, 68, 7);
      ctx.fillStyle = '#991b1b';
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      roundRect(ctx, cx + 6, 72, 36, 56, 4);
      ctx.strokeStyle = 'rgba(255,209,102,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 4. Center Table Played Cards!
    roundRect(ctx, 210, 152, 540, 146, 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.tablePlay) {
      const tc = this.tablePlay.cards;
      const step = 54;
      const startX = 480 - ((tc.length - 1) * step + 70) / 2;
      for (let i = 0; i < tc.length; i++) {
        this.drawCard(ctx, tc[i], startX + i * step, 172, 70, 98, false);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('— Bàn trống: Đánh tự do (Lẻ / Đôi / Sám / Sảnh 3+ lá) —', 480, 224);
    }

    // Live table status bar
    roundRect(ctx, 196, 304, 568, 30, 10);
    ctx.fillStyle = 'rgba(15, 16, 32, 0.85)';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, this.tableMessage, 480, 319, '#ffd166');

    // 5. Player Action Buttons (Hint / Play / Pass)
    if (this.phase === 'playing') {
      const chosen = this.playerHand.filter((c) => this.selectedIds.has(c.id));
      const combo = analyzeCombo(chosen);
      const activeTable = this.tableOwner === 'player' ? null : this.tablePlay;
      const isPlayable = this.turn === 'player' && !!combo && canBeat(combo, activeTable);

      this.drawActionBtn(ctx, this.hintBtn, '💡 Gợi ý', '#2A9D8F', this.turn === 'player');
      this.drawActionBtn(
        ctx,
        this.playBtn,
        combo && isPlayable ? `🃏 ĐÁNH (${combo.type === 'single' ? RANKS[combo.highCard.rank] : combo.type.toUpperCase()})` : '🃏 ĐÁNH BÀI!',
        isPlayable ? '#2d9348' : '#475569',
        isPlayable,
      );
      this.drawActionBtn(
        ctx,
        this.passBtn,
        '⏭ BỎ LƯỢT',
        this.turn === 'player' && !!activeTable ? '#E63946' : '#475569',
        this.turn === 'player' && !!activeTable,
      );
    }

    // 6. Vằn Bếp Trưởng Portrait bottom-left + Mèo Vàng worrying bottom-right!
    ctx.imageSmoothingEnabled = true;
    if (this.engine.assets.hasImage('npc_cat_boss')) {
      const img = this.engine.assets.getImage('npc_cat_boss');
      const dh = 104;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, 14, 424, dw, dh);
    }
    if (this.engine.assets.hasImage('npc_cat_golden')) {
      const img = this.engine.assets.getImage('npc_cat_golden');
      const dh = 92;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, W - dw - 14, 434, dw, dh);
    }

    // 7. Player's 8-Card Hand!
    for (const { card, rect } of this.cardRects) {
      this.drawCard(ctx, card, rect.x, rect.y, rect.width, rect.height, this.selectedIds.has(card.id));
    }

    this.particles.render(ctx);

    // 8. Modals (Intro / Won / Salty Loss!)
    if (this.phase === 'intro') {
      this.renderOverlay(
        ctx,
        '🃏 BẮT QUẢ TANG: VẰN TRỐN BÁN ĐI ĐÁNH TIẾN LÊN!',
        '#E85D04',
        '🐾 Mèo Vàng: "Á trời ơi!! Anh Vằn lại lẻn ra quán trà đá đánh Tiến Lên Miền Nam với Mèo Giang Hồ rồi!! Mau giúp anh ấy THẮNG nhanh kéo về bán phở — nếu thua anh Vằn sẽ cay cú đòi chơi tiếp làm trễ giờ mở quán đó!!"',
        [{ rect: this.actionBtn, label: '🃏 CHIA BÀI THẮNG NHANH!', color: '#E85D04' }],
      );
    } else if (this.phase === 'won') {
      this.renderOverlay(
        ctx,
        '🏆 TỚI TRẮNG!! VẰN THẮNG GIÒN GIÃ!!',
        '#2d9348',
        `👑 Vằn Bếp Trưởng: "Hahaha thấy trình Tiến Lên Miền Nam của Bếp Trưởng chưa!! Hốt gọn +${formatMoney(this.rewardMoney)} rồi chạy về mở xe phở ngay đây Mèo Vàng ơi!!"` +
          (this.totalDelaySec > 0 ? ` (Hơi trễ giờ mở quán -${this.totalDelaySec}s chút xíu!)` : ''),
        [{ rect: this.actionBtn, label: '🍜 QUAY VỀ MỞ QUÁN!', color: '#2d9348' }],
      );
    } else if (this.phase === 'salty_loss') {
      const buttons =
        this.matchNumber >= 2
          ? [
              { rect: this.saltyRematchBtn, label: `🔥 VẰN CAY CÚ: ĐÁNH GỠ VÁN #${this.matchNumber + 1}!`, color: '#E63946' },
              { rect: this.dragBackBtn, label: '🐾 Mèo Vàng lôi về quán!', color: '#2A9D8F' },
            ]
          : [
              { rect: this.actionBtn, label: '🔥 CAY QUÁ! ĐÁNH GỠ VÁN NỮA!', color: '#E63946' },
            ];
      this.renderOverlay(
        ctx,
        `😾 THUA RỒI!! VẰN CAY CÚ ĐÒI GỠ (TRỄ -${this.totalDelaySec}s)!`,
        '#E63946',
        `👑 Vằn Bếp Trưởng: "KHÔNG CHỊU ĐƯỢC!! Nó hên ván này thôi!! Chia lại ván #${this.matchNumber + 1}, chưa gỡ được ta chưa về bán phở đâu!!"\n🐾 Mèo Vàng: "Huhu trễ giờ bán hàng mất ${this.totalDelaySec} giây rồi anh Vằn ơiii!!"`,
        buttons,
      );
    }

    ctx.restore();
  }

  private drawCard(
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
  ): void {
    const isRed = card.suit >= 2; // ♦ ♥
    const color = isRed ? '#dc2626' : '#0f172a';
    const rankStr = RANKS[card.rank];
    const suitStr = SUITS[card.suit];

    // Drop shadow
    roundRect(ctx, x + 2, y + 3, w, h, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    roundRect(ctx, x, y, w, h, 9);
    ctx.fillStyle = selected ? '#fef9c3' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = selected ? '#f59e0b' : '#cbd5e1';
    ctx.lineWidth = selected ? 3.5 : 2;
    ctx.stroke();

    // Top-left rank & suit
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(rankStr, x + 7, y + 6);
    ctx.font = '16px "Segoe UI"';
    ctx.fillText(suitStr, x + 7, y + 25);

    // Big center suit (plus 🐷 badge on Heo '2'!)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = card.rank === 12 ? 'bold 30px "Segoe UI"' : '34px "Segoe UI"';
    ctx.fillText(suitStr, x + w / 2, y + h / 2 + 10);
    if (card.rank === 12) {
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillStyle = '#e85d04';
      ctx.fillText('HEO!', x + w - 18, y + 14);
    }
  }

  private drawActionBtn(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    label: string,
    color: string,
    enabled: boolean,
  ): void {
    roundRect(ctx, r.x, r.y, r.width, r.height, 12);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = enabled ? '#ffd166' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = enabled ? 2 : 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14.5px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, label, r.x + r.width / 2, r.y + r.height / 2, enabled ? '#fff' : '#cbd5e1');
  }

  private renderOverlay(
    ctx: CanvasRenderingContext2D,
    title: string,
    accent: string,
    text: string,
    buttons: Array<{ rect: Rect; label: string; color: string }>,
  ): void {
    ctx.fillStyle = 'rgba(10, 11, 24, 0.8)';
    ctx.fillRect(0, 0, 960, 540);
    roundRect(ctx, 140, 102, 680, 316, 20);
    ctx.fillStyle = '#1b1830';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    drawTextShadow(ctx, title, 480, 148, '#FCA311');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '15.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fffcf5';
    let cy = 192;
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const t = line + w + ' ';
        if (ctx.measureText(t).width > 600 && line) {
          ctx.fillText(line.trim(), 180, cy);
          line = w + ' ';
          cy += 25;
        } else line = t;
      }
      if (line.trim()) {
        ctx.fillText(line.trim(), 180, cy);
        cy += 30;
      }
    }

    for (const b of buttons) {
      roundRect(ctx, b.rect.x, b.rect.y, b.rect.width, b.rect.height, 14);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16.5px "Segoe UI", system-ui, sans-serif';
      drawTextShadow(ctx, b.label, b.rect.x + b.rect.width / 2, b.rect.y + b.rect.height / 2, '#fff');
    }
  }
}
