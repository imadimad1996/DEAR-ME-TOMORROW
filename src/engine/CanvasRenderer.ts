import type { ContentRepository } from '../services/ContentRepository';
import type { Localization } from '../services/Localization';
import type { GameState, ItemInstance } from '../types/game';
import {
  BOARD_COLS,
  BOARD_ROWS,
  BOARD_X,
  BOARD_Y,
  ECHO_SLOT_RECT,
  ORDER_DROP_RECT,
  TRASH_RECT,
} from '../game/constants';
import { boardSlotToRect, inventoryGlobalToVisible, inventorySlotToRect } from '../game/Layout';

export interface RenderDragState {
  itemId: string;
  x: number;
  y: number;
}

export interface RenderHighlight {
  container: 'board' | 'inventory';
  slot: number;
}

export interface RenderOptions {
  drag?: RenderDragState;
  highlight?: RenderHighlight | null;
  readyGenerators: string[];
}

export class CanvasRenderer {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly content: ContentRepository,
    private readonly localization: Localization,
  ) {}

  public render(state: GameState, options: RenderOptions): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground(ctx);
    this.drawTopHud(ctx, state);
    this.drawBoard(ctx, options.highlight);
    this.drawInventory(ctx, state, options.highlight);
    this.drawBottomHud(ctx, state, options.readyGenerators);

    const draggingId = options.drag?.itemId;
    for (const item of Object.values(state.items)) {
      if (item.uid === draggingId) {
        continue;
      }
      this.drawItem(ctx, state, item, 1, false);
    }

    if (options.drag) {
      const item = state.items[options.drag.itemId];
      if (item) {
        this.drawItem(ctx, state, item, 1.1, true, options.drag.x, options.drag.y);
      }
    }

    this.drawToasts(ctx, state);

    if (state.ui.overlayFadeUntil > state.now) {
      const t = (state.ui.overlayFadeUntil - state.now) / 1200;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, t * 0.35)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, '#162231');
    gradient.addColorStop(0.45, '#243a4f');
    gradient.addColorStop(1, '#111820');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#c7d5e4';
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 173) % 1080;
      const y = (i * 241) % 1920;
      ctx.beginPath();
      ctx.arc(x, y, 64, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTopHud(ctx: CanvasRenderingContext2D, state: GameState): void {
    ctx.fillStyle = 'rgba(9,12,18,0.6)';
    ctx.fillRect(20, 20, 1040, 140);
    ctx.strokeStyle = 'rgba(167,206,228,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 1040, 140);

    ctx.fillStyle = '#f0f6ff';
    ctx.font = 'bold 34px Georgia';
    ctx.fillText(this.localization.t('ui.title'), 42, 72);

    ctx.font = '28px Georgia';
    ctx.fillText(`${this.localization.t('ui.coins')}: ${state.player.coins}`, 42, 120);
    ctx.fillText(`${this.localization.t('ui.stars')}: ${state.player.stars}`, 300, 120);
    ctx.fillText(`XP ${state.player.xp}/${state.player.xpToNext}`, 520, 120);
    ctx.fillText(`Lv ${state.player.level}`, 810, 120);
  }

  private drawBoard(ctx: CanvasRenderingContext2D, highlight: RenderHighlight | null | undefined): void {
    ctx.fillStyle = 'rgba(9,12,18,0.5)';
    ctx.fillRect(BOARD_X - 20, BOARD_Y - 20, 1000 + 40, 900 + 40);

    for (let slot = 0; slot < BOARD_COLS * BOARD_ROWS; slot += 1) {
      const rect = boardSlotToRect(slot);
      const highlighted = highlight?.container === 'board' && highlight.slot === slot;
      ctx.fillStyle = highlighted ? 'rgba(140,214,255,0.38)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = highlighted ? '#9de8ff' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = highlighted ? 3 : 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  private drawInventory(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    highlight: RenderHighlight | null | undefined,
  ): void {
    ctx.fillStyle = 'rgba(9,12,18,0.52)';
    ctx.fillRect(40, 1280, 1000, 350);

    ctx.fillStyle = '#f1f4fa';
    ctx.font = '26px Georgia';
    const pageCount = Math.max(1, Math.ceil(state.inventoryCapacity / 15));
    ctx.fillText(
      `${this.localization.t('ui.inventory')} ${state.ui.inventoryPage + 1}/${pageCount} (${state.inventoryCapacity})`,
      56,
      1316,
    );

    const start = state.ui.inventoryPage * 15;
    const end = Math.min(state.inventoryCapacity, start + 15);
    for (let globalSlot = start; globalSlot < end; globalSlot += 1) {
      const localSlot = inventoryGlobalToVisible(globalSlot, state.ui.inventoryPage);
      if (localSlot == null) {
        continue;
      }
      const rect = inventorySlotToRect(localSlot);
      const highlighted = highlight?.container === 'inventory' && highlight.slot === globalSlot;
      ctx.fillStyle = highlighted ? 'rgba(140,214,255,0.38)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = highlighted ? '#9de8ff' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = highlighted ? 3 : 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  private drawBottomHud(ctx: CanvasRenderingContext2D, state: GameState, readyGenerators: string[]): void {
    ctx.fillStyle = 'rgba(9,12,18,0.62)';
    ctx.fillRect(20, 1628, 1040, 270);

    this.drawGeneratorCard(ctx, state, 'toolbox', 44, 1662, readyGenerators.includes('toolbox'));
    this.drawGeneratorCard(ctx, state, 'pantry', 284, 1662, readyGenerators.includes('pantry'));

    ctx.fillStyle = 'rgba(20,30,45,0.95)';
    ctx.fillRect(ORDER_DROP_RECT.x, ORDER_DROP_RECT.y, ORDER_DROP_RECT.w, ORDER_DROP_RECT.h);
    ctx.strokeStyle = '#84bfd7';
    ctx.lineWidth = 2;
    ctx.strokeRect(ORDER_DROP_RECT.x, ORDER_DROP_RECT.y, ORDER_DROP_RECT.w, ORDER_DROP_RECT.h);
    ctx.fillStyle = '#f1f6ff';
    ctx.font = '24px Georgia';
    ctx.fillText(this.localization.t('ui.orders'), ORDER_DROP_RECT.x + 20, ORDER_DROP_RECT.y + 36);
    ctx.font = '20px Georgia';
    ctx.fillText(
      `${state.ordersActive.length} active / +${state.ordersQueued.length}`,
      ORDER_DROP_RECT.x + 20,
      ORDER_DROP_RECT.y + 72,
    );

    ctx.fillStyle = 'rgba(20,30,45,0.95)';
    ctx.fillRect(ECHO_SLOT_RECT.x, ECHO_SLOT_RECT.y, ECHO_SLOT_RECT.w, ECHO_SLOT_RECT.h);
    ctx.strokeStyle = '#4dd6ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(ECHO_SLOT_RECT.x, ECHO_SLOT_RECT.y, ECHO_SLOT_RECT.w, ECHO_SLOT_RECT.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#e7faff';
    ctx.font = '22px Georgia';
    ctx.fillText(this.localization.t('ui.echo'), ECHO_SLOT_RECT.x + 20, ECHO_SLOT_RECT.y + 34);
    ctx.font = '18px Georgia';
    ctx.fillText(
      `Active ${state.echo.activeEchoIds.length}/${state.config.echo.maxActiveEchoes}`,
      ECHO_SLOT_RECT.x + 20,
      ECHO_SLOT_RECT.y + 66,
    );

    ctx.fillStyle = 'rgba(70,20,20,0.95)';
    ctx.fillRect(TRASH_RECT.x, TRASH_RECT.y, TRASH_RECT.w, TRASH_RECT.h);
    ctx.strokeStyle = '#f88d8d';
    ctx.lineWidth = 2;
    ctx.strokeRect(TRASH_RECT.x, TRASH_RECT.y, TRASH_RECT.w, TRASH_RECT.h);
    ctx.fillStyle = '#ffe9e9';
    ctx.font = '22px Georgia';
    ctx.fillText('TRASH', TRASH_RECT.x + 28, TRASH_RECT.y + 40);

    const barX = 700;
    const barY = 1708;
    const barW = 320;
    const barH = 34;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = state.energy.current / state.energy.max;
    ctx.fillStyle = '#7fdc79';
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = '#d4f6d4';
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#f7fff7';
    ctx.font = '22px Georgia';
    ctx.fillText(`${this.localization.t('ui.energy')} ${state.energy.current}/${state.energy.max}`, barX, 1756);

    if (state.pendingInboxNotice) {
      ctx.fillStyle = 'rgba(255,227,160,0.92)';
      ctx.fillRect(44, 1860, 992, 42);
      ctx.fillStyle = '#2f2412';
      ctx.font = '18px Georgia';
      ctx.fillText(state.pendingInboxNotice, 52, 1888);
    }
  }

  private drawGeneratorCard(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    generatorId: string,
    x: number,
    y: number,
    ready: boolean,
  ): void {
    const generator = state.generators[generatorId];
    const w = 220;
    const h = 138;
    ctx.fillStyle = ready ? 'rgba(60,120,70,0.88)' : 'rgba(35,46,60,0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ready ? '#9af2aa' : '#9ec3dd';
    ctx.lineWidth = ready ? 3 : 2;
    ctx.strokeRect(x, y, w, h);

    if (ready) {
      const pulse = 0.5 + Math.sin(state.now / 180) * 0.5;
      ctx.globalAlpha = 0.3 * pulse;
      ctx.fillStyle = '#aef8c1';
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#f2f8ff';
    ctx.font = '24px Georgia';
    ctx.fillText(
      this.localization.t(this.content.getGenerator(generatorId).nameKey),
      x + 16,
      y + 34,
    );
    ctx.font = '20px Georgia';
    ctx.fillText(`Lv ${generator.level}`, x + 16, y + 66);

    if (!ready) {
      const remaining = Math.max(0, generator.cooldownEndAt - state.now);
      const sec = Math.ceil(remaining / 1000);
      ctx.fillText(`CD ${sec}s`, x + 16, y + 98);
      const ratio = clamp01(1 - remaining / (15 * 60 * 1000));
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 16, y + 110, 188, 12);
      ctx.fillStyle = '#8bd9ff';
      ctx.fillRect(x + 16, y + 110, 188 * ratio, 12);
    } else {
      ctx.fillStyle = '#e8ffe9';
      ctx.fillText('READY', x + 16, y + 98);
    }
  }

  private drawItem(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    item: ItemInstance,
    scale: number,
    dragging: boolean,
    dragX?: number,
    dragY?: number,
  ): void {
    const baseRect = this.getItemRect(state, item);
    if (!baseRect) {
      return;
    }

    const popAge = state.now - item.createdAt;
    const popScale = popAge < 260 ? 1 + (260 - popAge) / 900 : 1;
    const finalScale = scale * popScale;

    const centerX = dragX ?? baseRect.x + baseRect.w / 2;
    const centerY = dragY ?? baseRect.y + baseRect.h / 2;
    const w = baseRect.w * finalScale;
    const h = baseRect.h * finalScale;
    const x = centerX - w / 2;
    const y = centerY - h / 2;

    if (dragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 8;
    }

    ctx.fillStyle = item.isEcho ? '#ffd570' : this.content.getItem(item.itemId).color;
    if (this.content.getItem(item.itemId).shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(w, h) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.content.getItem(item.itemId).shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(centerX, y + 6);
      ctx.lineTo(x + w - 6, centerY);
      ctx.lineTo(centerX, y + h - 6);
      ctx.lineTo(x + 6, centerY);
      ctx.closePath();
      ctx.fill();
    } else if (this.content.getItem(item.itemId).shape === 'hex') {
      const r = Math.min(w, h) * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const px = centerX + Math.cos(angle) * r;
        const py = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = item.isEcho ? '#52ecff' : 'rgba(12,20,31,0.6)';
    ctx.lineWidth = item.isEcho ? 4 : 2;
    if (item.isEcho) {
      ctx.setLineDash([8, 5]);
    }
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
    ctx.setLineDash([]);

    if (item.isEcho) {
      const pulse = 0.4 + Math.sin(state.now / 120) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffd56d';
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.globalAlpha = 1;

      const next = this.content.getNextTierItem(item.itemId);
      if (next) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = this.content.getItem(next).color;
        ctx.fillRect(x + w * 0.55, y + h * 0.55, w * 0.25, h * 0.25);
        ctx.globalAlpha = 1;
      }
    }

    ctx.fillStyle = '#f7f8fb';
    ctx.font = 'bold 20px Georgia';
    ctx.fillText(`T${item.tier}`, x + 14, y + 30);

    if (item.tier >= 8) {
      ctx.fillStyle = '#ffd56b';
      ctx.fillRect(x + w - 64, y + 14, 50, 24);
      ctx.fillStyle = '#35240f';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('MAX', x + w - 57, y + 31);
    }

    if (popAge < 240) {
      const burst = 1 - popAge / 240;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const px = centerX + Math.cos(angle) * 40 * (1 - burst);
        const py = centerY + Math.sin(angle) * 40 * (1 - burst);
        ctx.globalAlpha = burst;
        ctx.fillStyle = '#f9e8b0';
        ctx.beginPath();
        ctx.arc(px, py, 4 + 6 * burst, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private getItemRect(
    state: GameState,
    item: ItemInstance,
  ): { x: number; y: number; w: number; h: number } | null {
    if (item.container === 'board') {
      return boardSlotToRect(item.slotIndex);
    }
    const local = inventoryGlobalToVisible(item.slotIndex, state.ui.inventoryPage);
    if (local == null) {
      return null;
    }
    return inventorySlotToRect(local);
  }

  private drawToasts(ctx: CanvasRenderingContext2D, state: GameState): void {
    const recent = state.ui.toasts.slice(-3);
    for (let i = 0; i < recent.length; i += 1) {
      const toast = recent[i];
      const y = 1120 + i * 60;
      ctx.fillStyle = 'rgba(8,12,18,0.72)';
      ctx.fillRect(120, y, 840, 46);
      ctx.strokeStyle = 'rgba(149,198,219,0.62)';
      ctx.strokeRect(120, y, 840, 46);
      ctx.fillStyle = '#f4fbff';
      ctx.font = '22px Georgia';
      ctx.fillText(toast.text, 140, y + 30);
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
