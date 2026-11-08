import type { WerkaPaddonPreview } from './werkaPaddonApi';
import { canReceiveWerkaPaddon, type WerkaReceiveState } from './werkaReceiveLogic';
import type { WerkaReceiveFooterProps } from './werkaReceiveFooterModel';

export type WerkaPaddonFooterInput = {
  preview: WerkaPaddonPreview;
  state: WerkaReceiveState;
  confirming: boolean;
  error: string;
  locale: string;
  /** The eventual controller owns optional catalog loading and V2's preview-name merge. */
  apparatusNames: Record<string, string>;
  onWarehouse: (warehouse: string) => void;
  onRequestReceive: () => void;
  onReload: () => void;
  onNextQr: () => void;
};
const apparatusPattern = /apparatus:[^\s,;•()\[\]{}]+/gi;
export function werkaPaddonLabel(value: string, names: Record<string, string>, locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/, 1)[0];
  const unavailable = language === 'ur' ? 'مشین کا نام دستیاب نہیں' : language === 'uz' ? 'Apparat nomi mavjud emas'
    : language === 'ru' ? 'Название аппарата недоступно' : 'Machine name unavailable';
  return value.replace(apparatusPattern, match => names[match] ?? unavailable);
}
/** Supplies only the shared footer; the source's shared pallet-detail body is still missing. */
export function werkaPaddonFooterProps(props: WerkaPaddonFooterInput): WerkaReceiveFooterProps {
  const { preview, state, apparatusNames, locale } = props, label = (value: string) => werkaPaddonLabel(value, apparatusNames, locale);
  const receipt = state.receipt;
  return { ...props, warehouses: preview.warehouses, warehouseLabel: label,
    receiptWarehouse: receipt ? label(String(receipt.warehouse ?? null)) : '',
    receiptAcceptedBy: receipt ? String(receipt.accepted_by_display_name ?? null) : '',
    canReceive: canReceiveWerkaPaddon(preview, state),
    warning: !preview.canReceive ? 'Kirim mumkin emas: paddon bo‘sh yoki tarkibida tayyor bo‘lmagan / qabul qilingan rulon bor.' : undefined };
}
