import type { CustomerDirectoryEntry } from './werkaArchiveBatchQr';
import type { WerkaBatchCustomerPickerState } from './werkaBatchCustomerPicker';
import { werkaDartTrim } from './werkaBatchTrim';
import { werkaBatchCustomerSearchOrder } from './werkaCustomerSearch';

type Customer = Readonly<CustomerDirectoryEntry>;
/** Opaque identity for an actual timer/read; do not clone or serialize it. */
export type WerkaBatchCustomerPagingToken = Readonly<{ marker: symbol }>;
type Pending = Readonly<{ kind: 'debounce' | 'reset' | 'append'; token: WerkaBatchCustomerPagingToken }>;
export type WerkaBatchCustomerPagingState = Readonly<{
  started: boolean; closed: boolean; query: string; pending: Pending | null;
  loading: boolean; loadingMore: boolean; hasMore: boolean; hasError: boolean; raw: readonly Customer[];
}>;
export type WerkaBatchCustomerPagingEffect =
  | Readonly<{ kind: 'schedule'; token: WerkaBatchCustomerPagingToken; delayMs: 220 }>
  | Readonly<{ kind: 'read'; token: WerkaBatchCustomerPagingToken; query: string; offset: number; limit: 50 }>;
type Transition = Readonly<{ state: WerkaBatchCustomerPagingState; effect: WerkaBatchCustomerPagingEffect | null }>;

const empty: readonly Customer[] = Object.freeze([]);
const freeze = (state: WerkaBatchCustomerPagingState): WerkaBatchCustomerPagingState => Object.freeze(state);
const pending = (kind: Pending['kind'], token: WerkaBatchCustomerPagingToken): Pending => Object.freeze({ kind, token });
const transition = (state: WerkaBatchCustomerPagingState, effect: WerkaBatchCustomerPagingEffect | null): Transition =>
  Object.freeze({ state, effect: effect === null ? null : Object.freeze(effect) });
const unchanged = (state: WerkaBatchCustomerPagingState): Transition => transition(state, null);
const nextToken = (): WerkaBatchCustomerPagingToken => Object.freeze({ marker: Symbol() });
const copyRows = (value: unknown): readonly Customer[] => {
  if (!Array.isArray(value)) throw new TypeError('Invalid customer page');
  return Object.freeze(value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Invalid customer');
    const { ref, name, phone } = item as CustomerDirectoryEntry;
    if ([ref, name, phone].some(field => typeof field !== 'string')) throw new TypeError('Invalid customer');
    return Object.freeze({ ref, name, phone });
  }));
};

/**
 * Descriptions only. Apply every event atomically to the latest state, not a
 * captured old snapshot. Tokens are not account or transport authorization.
 * The owner must guard every timer, send, retry, redirect and decode.
 */
export function werkaBatchCustomerPagingInitial(): WerkaBatchCustomerPagingState {
  return freeze({ started: false, closed: false, query: '', pending: null,
    loading: true, loadingMore: false, hasMore: true, hasError: false, raw: empty });
}

function beginRead(state: WerkaBatchCustomerPagingState, mode: 'reset' | 'append'): Transition {
  const token = nextToken(), reset = mode === 'reset';
  const next = freeze({ ...state, started: true, pending: pending(mode, token),
    loading: reset, loadingMore: !reset, hasError: false, ...(reset ? { raw: empty, hasMore: true } : {}) });
  return transition(next, { kind: 'read', token, query: werkaDartTrim(state.query), offset: reset ? 0 : state.raw.length, limit: 50 });
}

/** Call once when a real picker owner starts; this emits no network request itself. */
export function werkaBatchCustomerPagingStart(state: WerkaBatchCustomerPagingState): Transition {
  return state.closed || state.started ? unchanged(state) : beginRead(state, 'reset');
}

/** A real text event invalidates earlier work immediately, before the 220 ms source debounce. */
export function werkaBatchCustomerPagingQuery(state: WerkaBatchCustomerPagingState, query: string): Transition {
  if (typeof query !== 'string') throw new TypeError('Invalid customer query');
  if (state.closed || !state.started) return unchanged(state);
  const token = nextToken();
  return transition(freeze({ ...state, query, pending: pending('debounce', token), raw: empty,
    loading: true, loadingMore: false, hasMore: false, hasError: false }),
    { kind: 'schedule', token, delayMs: 220 });
}

/** Call only when the corresponding real timer fires. */
export function werkaBatchCustomerPagingDebounced(state: WerkaBatchCustomerPagingState, token: WerkaBatchCustomerPagingToken): Transition {
  return state.closed || state.pending?.kind !== 'debounce' || state.pending.token !== token ? unchanged(state) : beginRead(state, 'reset');
}

/** Call only for a real near-end scroll event; repeated requests while pending are ignored. */
export function werkaBatchCustomerPagingMore(state: WerkaBatchCustomerPagingState): Transition {
  return state.closed || !state.started || state.pending !== null || state.loading || state.loadingMore || state.hasError ||
    !state.hasMore || state.raw.length === 0 ? unchanged(state) : beginRead(state, 'append');
}

export function werkaBatchCustomerPagingRetry(state: WerkaBatchCustomerPagingState): Transition {
  return state.closed || !state.started || state.pending !== null || !state.hasError ? unchanged(state) : beginRead(state, 'reset');
}

/** Results are accepted only for the current described read, never sent by this model. */
export function werkaBatchCustomerPagingResult(state: WerkaBatchCustomerPagingState, token: WerkaBatchCustomerPagingToken, value: unknown): Transition {
  if (state.closed || !state.pending || state.pending.kind === 'debounce' || state.pending.token !== token) return unchanged(state);
  let page: readonly Customer[];
  try { page = copyRows(value); } catch { return werkaBatchCustomerPagingFailure(state, token); }
  const raw = state.pending.kind === 'reset' ? page : Object.freeze([...state.raw, ...page]);
  return transition(freeze({ ...state, pending: null, loading: false, loadingMore: false, hasError: false, hasMore: page.length >= 50, raw }), null);
}

export function werkaBatchCustomerPagingFailure(state: WerkaBatchCustomerPagingState, token: WerkaBatchCustomerPagingToken): Transition {
  if (state.closed || !state.pending || state.pending.kind === 'debounce' || state.pending.token !== token) return unchanged(state);
  return transition(freeze({ ...state, pending: null, loading: false, loadingMore: false, hasError: true }), null);
}

export function werkaBatchCustomerPagingClose(state: WerkaBatchCustomerPagingState): WerkaBatchCustomerPagingState {
  if (state.closed) return state;
  return freeze({ ...state, closed: true, pending: null, raw: empty,
    loading: false, loadingMore: false, hasMore: false, hasError: false });
}

/** An immutable display projection, not an account-safe production owner. */
export function werkaBatchCustomerPagingDisplay(state: WerkaBatchCustomerPagingState): WerkaBatchCustomerPickerState {
  return Object.freeze({ query: state.query, loading: state.loading, loadingMore: state.loadingMore, hasMore: state.hasMore,
    hasError: state.hasError, customers: Object.freeze(werkaBatchCustomerSearchOrder(state.query, state.raw)) });
}
