import type { WerkaWipPreview } from './werkaPaddonApi';
import { canReceiveWerkaWip, type WerkaReceiveState } from './werkaReceiveLogic';

export type WerkaWipContentProps = {
  preview: WerkaWipPreview;
  state: WerkaReceiveState;
  confirming: boolean;
  error: string;
  locale: string;
  onWarehouse: (warehouse: string) => void;
  /** Opens confirmation only; the eventual controller owns the guarded write. */
  onRequestReceive: () => void;
  onReload: () => void;
  onNextQr: () => void;
};
export function werkaWipContentActions(props: WerkaWipContentProps) {
  return { canReceive: canReceiveWerkaWip(props.preview, props.state), canSelect: !props.state.busy,
    canReload: !props.state.busy, canNext: !props.state.busy };
}

const apparatusPattern = /apparatus:[^\s,;•()\[\]{}]+/gi;
/** V2 WIP labels deliberately use the Uzbek fallback regardless of locale. */
export function werkaWipLabel(value: string, names: Record<string, string>): string {
  return value.replace(apparatusPattern, match => names[match] ?? 'Apparat nomi mavjud emas');
}

/** Source formatQuantity(value, decimalPlaces: 6, trimTrailingZeros: true). */
export function werkaWipQuantity(value: number): string {
  if (Object.is(value, -0)) return '-0';
  if (Number.isInteger(value)) return value.toFixed(0);
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export function werkaWipStatus(preview: WerkaWipPreview, receipt: Record<string, unknown> | null): string {
  if (receipt !== null) return 'Omborga kirim qilingan';
  switch (preview.receiveBlockedReason) {
    case 'paddon_item_already_assigned': return `WIP ${preview.paddonCode} paddoniga biriktirilgan. Paddon QR orqali kirim qiling.`;
    case 'order_not_active': return 'Buyurtma faol emas. Kirim mumkin emas.';
    case 'apparatus_inactive': return 'Apparat faol emas. Kirim mumkin emas.';
    case 'wip_location_mismatch': return 'WIP joylashuvi o‘zgargan. Kirim mumkin emas.';
    case 'already_received': return 'WIP avval kirim qilingan.';
  }
  switch (preview.batch.wip_status) {
    case 'in_use': return 'WIP hozir ishlatilmoqda. Kirim mumkin emas.';
    case 'processed': return 'WIP avval ishlatilgan. Kirim mumkin emas.';
    default: return preview.canReceive ? 'Kirimga tayyor' : 'Bu WIP hozir omborga kirim qilish uchun tayyor emas.';
  }
}

/** WIP body fields only. Receipt date formatting, camera, dialog and route are not handled here. */
export function werkaWipPresentation(preview: WerkaWipPreview, state: WerkaReceiveState) {
  const { batch, apparatusNames } = preview, label = (value: string) => werkaWipLabel(value, apparatusNames);
  const quantities: string[] = [];
  if (batch.finished_goods_kg != null) quantities.push(`${werkaWipQuantity(batch.finished_goods_kg)} kg`);
  if (batch.finished_goods_meter != null) quantities.push(`${werkaWipQuantity(batch.finished_goods_meter)} m`);
  return {
    product: label(batch.label_item_name === '' ? batch.label_item_code : batch.label_item_name),
    order: `Buyurtma: ${batch.order_id}`,
    qr: `QR: ${batch.qr_payload}`,
    quantity: quantities.length ? quantities.join(' • ') : `${werkaWipQuantity(batch.produced_qty)} ${batch.uom}`,
    location: `Joylashuv: ${label(state.receipt?.warehouse == null ? batch.current_location : String(state.receipt.warehouse))}`,
    worker: batch.worker_display_name === '' ? '' : `Ishchi: ${batch.worker_display_name}`,
    description: batch.description,
    status: werkaWipStatus(preview, state.receipt),
  };
}
