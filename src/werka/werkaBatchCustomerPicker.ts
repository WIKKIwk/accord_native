import { localizedGetter } from '../shared/localization';
import type { CustomerDirectoryEntry } from './werkaArchiveBatchQr';
import { werkaDartTrim } from './werkaBatchTrim';

export type WerkaBatchCustomerPickerState = Readonly<{
  query: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  hasError: boolean;
  /** Already ordered by the owner according to the source picker. */
  customers: readonly Readonly<CustomerDirectoryEntry>[];
}>;

export type WerkaBatchCustomerPickerContentProps = {
  /** Immutable snapshot: replace this object when any visible picker state changes. */
  state: WerkaBatchCustomerPickerState;
  locale: string;
  /** Material close label from the owner's resolved locale. */
  closeLabel: string;
  /** Use a fresh key when programmatically replacing or clearing the native search field; do not reuse one within this mount. */
  queryFieldKey: string | number;
  onQueryChange: (query: string) => void;
  onDismiss: () => void;
  /** Close the sheet and recheck account/scope before accepting this real selection. */
  onSelect: (customer: Readonly<CustomerDirectoryEntry>) => void;
  onRetry: () => void;
  /** The owner synchronously locks and guards the real next-page request. */
  onLoadMore: () => void;
};

/** A source-derived view only: no ranking, filtering, request, account or modal owner. */
export function werkaBatchCustomerPickerPresentation(state: WerkaBatchCustomerPickerState, locale: string) {
  const t = (key: string) => localizedGetter(key, locale);
  const body = state.loading ? 'loading' : state.hasError ? 'error' : state.customers.length === 0 ? 'empty' : 'list';
  return {
    title: t('selectCustomer'), hint: t('searchCustomer'), error: t('serverDisconnectedRetry'),
    retry: t('retry'), empty: t('noRecordsYet'), body,
    rows: state.customers.map(customer => ({ customer, title: customer.name, subtitle: werkaDartTrim(customer.phone) })),
    showLoadingMore: body === 'list' && state.loadingMore,
    canLoadMore: body === 'list' && !state.loadingMore && state.hasMore,
  } as const;
}

/** Mirrors the source's observed scroll-position threshold, without emitting an event. */
export function werkaBatchCustomerPickerNearEnd(position: number, contentHeight: number, viewportHeight: number): boolean {
  if (![position, contentHeight, viewportHeight].every(Number.isFinite) || contentHeight < 0 || viewportHeight <= 0) return false;
  return position >= Math.max(0, contentHeight - viewportHeight) - 240;
}
