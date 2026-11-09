import { localizedGetter, localizedMethod } from '../shared/localization';
import { werkaDartTrim } from './werkaBatchTrim';
import { werkaTryParseTrimmedDouble } from './werkaUnannouncedInput';

export type WerkaBatchDraftCustomer = { ref: string; name: string; phone: string };
export type WerkaBatchDraftItem = { code: string; name: string; uom: string };
export type WerkaBatchDraftState = {
  customer: WerkaBatchDraftCustomer | null;
  item: WerkaBatchDraftItem | null;
  quantityText: string;
  draftCount: number;
};
export type WerkaBatchDraftContentProps = {
  state: WerkaBatchDraftState;
  locale: string;
  /** Change only when the owner programmatically clears/replaces the native quantity field. */
  quantityFieldKey: string | number;
  onPickItem: () => void;
  onClearItem: () => void;
  onPickCustomer: () => void;
  onClearCustomer: () => void;
  onQuantityChange: (value: string) => void;
  /** The owner validates the originating account and creates a real local draft ID. */
  onSaveLine: () => void;
};

/** Pure source decisions; no catalog, draft ID, route or write is created. */
export function werkaBatchDraftPresentation(state: WerkaBatchDraftState, locale: string) {
  if (!state || typeof state.quantityText !== 'string' ||
      (state.customer !== null && (!state.customer || typeof state.customer !== 'object' || Array.isArray(state.customer) || typeof state.customer.ref !== 'string' ||
        typeof state.customer.name !== 'string' || typeof state.customer.phone !== 'string')) ||
      (state.item !== null && (!state.item || typeof state.item !== 'object' || Array.isArray(state.item) || typeof state.item.code !== 'string' ||
        typeof state.item.name !== 'string' || typeof state.item.uom !== 'string'))) throw new TypeError('Invalid batch draft state');
  if (!Number.isSafeInteger(state.draftCount) || state.draftCount < 0) throw new RangeError('Invalid draft count');
  const t = (key: string) => localizedGetter(key, locale);
  const quantity = werkaTryParseTrimmedDouble(werkaDartTrim(state.quantityText)) ?? 0;
  const valid = state.customer !== null && state.item !== null && quantity > 0;
  const hasDrafts = state.draftCount > 0;
  return {
    title: t('batchDispatchTitle'), itemLabel: t('itemLabel'), customerLabel: t('customerLabel'), amountLabel: t('amountLabel'),
    itemName: state.item?.name ?? t('selectItem'), customerName: state.customer?.name ?? t('selectCustomer'),
    clearItemTooltip: 'Clear item', clearCustomerTooltip: 'Clear customer', viewListTooltip: t('batchViewListAction'),
    draftCountLabel: hasDrafts ? localizedMethod('batchDraftCountLabel', locale, { count: state.draftCount }) : null,
    phone: state.customer !== null && state.item === null && werkaDartTrim(state.customer.phone) ? state.customer.phone : null,
    showQuantity: state.item !== null, quantity, valid, hasDrafts,
    saveLabel: t(hasDrafts ? 'addAnotherAction' : 'nextItemAction'), confirmLabel: t('confirmTitle'),
    sourceCanSave: valid, sourceCanOpenList: hasDrafts,
    sourceCanConfirmReview: hasDrafts && (valid || state.draftCount >= 2),
  };
}

/** These mirror source field transitions; null picker results should not call them. */
export const werkaBatchDraftClearItem = (state: WerkaBatchDraftState): WerkaBatchDraftState => ({ ...state, item: null, quantityText: '' });
export const werkaBatchDraftClearCustomer = (state: WerkaBatchDraftState): WerkaBatchDraftState => ({ ...state, customer: null });
export const werkaBatchDraftChooseCustomer = (state: WerkaBatchDraftState, customer: WerkaBatchDraftCustomer): WerkaBatchDraftState =>
  ({ ...state, customer, quantityText: state.item === null ? '' : state.quantityText });
export const werkaBatchDraftChooseItem = (state: WerkaBatchDraftState, item: WerkaBatchDraftItem): WerkaBatchDraftState =>
  ({ ...state, item, quantityText: '' });
export const werkaBatchDraftChooseOption = (state: WerkaBatchDraftState, item: WerkaBatchDraftItem,
  customer: WerkaBatchDraftCustomer): WerkaBatchDraftState => ({ ...state, item, customer, quantityText: '' });
/** Only the source's field reset; adding a real line and changing its count belong to the owner. */
export const werkaBatchDraftPrepareNextLine = (state: WerkaBatchDraftState): WerkaBatchDraftState =>
  ({ ...state, item: null, quantityText: '' });
