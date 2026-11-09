import { localizedGetter, localizedMethod } from '../shared/localization';

/** The owner supplies existing draft identities and values; no IDs are generated here. */
export type WerkaBatchReviewLine = {
  localID: string;
  customer: { ref: string; name: string };
  item: { code: string; name: string; uom: string };
  qty: number;
};
export type WerkaBatchReviewContentProps = {
  lines: readonly WerkaBatchReviewLine[];
  submitting: boolean;
  locale: string;
  /** The owner must verify current account/scope before changing its drafts. */
  onRemove: (localID: string) => void;
};

const deleteTooltips = { uz: 'Olib tashlash', en: 'Delete', ru: 'Удалить', ur: 'حذف کریں' } as const;
/** Flutter 3.47.8 MaterialLocalizations for the app's four resolved locales. */
export function werkaBatchReviewDeleteTooltip(locale: string): string {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code !== 'uz' && code !== 'en' && code !== 'ru' && code !== 'ur') throw new RangeError();
  return deleteTooltips[code];
}

/** Source review uses toStringAsFixed(0), including negative zero. */
export function werkaBatchReviewQuantity(value: number): string {
  return Object.is(value, -0) ? '-0' : value.toFixed(0);
}

export function werkaBatchReviewPresentation(lines: readonly WerkaBatchReviewLine[], submitting: boolean, locale: string) {
  const customers = new Set(lines.map(line => line.customer.ref)).size, count = lines.length;
  return {
    title: localizedGetter('batchReviewTitle', locale),
    customerCount: customers, draftCount: count,
    deleteTooltip: werkaBatchReviewDeleteTooltip(locale),
    customers: localizedMethod('batchCustomerCountLabel', locale, { count: customers }),
    drafts: localizedMethod('batchDraftCountLabel', locale, { count }),
    rows: lines.map(line => ({ localID: line.localID, customer: line.customer.name, item: line.item.name,
      detail: `${werkaBatchReviewQuantity(line.qty)} ${line.item.uom} • ${line.item.code}` })),
    needAtLeastTwo: count < 2 ? localizedGetter('batchNeedAtLeastTwoItems', locale) : null,
    confirmLabel: localizedGetter(submitting ? 'sending' : 'confirmTitle', locale),
    sourceCanConfirm: !submitting && count >= 2,
    canRemove: !submitting,
  };
}

/** Source removes every row with the selected local ID; a disabled remove does nothing. */
export function werkaBatchReviewRemove<T extends { localID: string }>(lines: readonly T[], localID: string, submitting: boolean): T[] {
  return submitting ? [...lines] : lines.filter(line => line.localID !== localID);
}
