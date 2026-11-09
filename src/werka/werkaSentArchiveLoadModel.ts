import { werkaArchiveActiveDays, werkaArchiveActiveMonths, werkaArchiveActiveYears } from './werkaArchiveCalendar';
import type { SentArchivePanel, SentArchiveState } from './werkaSentArchiveModel';

export type WerkaSentArchiveLoadState = {
  loading: boolean;
  error: unknown | null;
  activeDays: ReadonlySet<number>;
  activeMonths: ReadonlySet<number>;
  activeYears: ReadonlySet<number>;
};

/** Source state descriptions only. These functions neither send requests nor apply account guards. */
export function werkaSentArchiveLoadInitial(): WerkaSentArchiveLoadState {
  return { loading: true, error: null, activeDays: new Set(), activeMonths: new Set(), activeYears: new Set() };
}
export function werkaSentArchiveLoadStarted(state: WerkaSentArchiveLoadState): WerkaSentArchiveLoadState {
  return { ...state, loading: true, error: null };
}
export function werkaSentArchiveLoadFailed(state: WerkaSentArchiveLoadState, error: unknown): WerkaSentArchiveLoadState {
  return { ...state, error };
}
export function werkaSentArchiveLoadFinished(state: WerkaSentArchiveLoadState): WerkaSentArchiveLoadState {
  // V2 has one shared flag: any one of the three finally blocks clears it.
  return { ...state, loading: false };
}
/** V2 filters each response against the then-current page, not the original request's page. */
export function werkaSentArchiveLoadSucceeded(state: WerkaSentArchiveLoadState, panel: SentArchivePanel,
  labels: readonly string[], current: SentArchiveState): WerkaSentArchiveLoadState {
  if (panel === 'daily') return { ...state, activeDays: werkaArchiveActiveDays(labels,
    current.displayMonth.getFullYear(), current.displayMonth.getMonth() + 1) };
  if (panel === 'monthly') return { ...state, activeMonths: werkaArchiveActiveMonths(labels, current.displayYear) };
  if (panel === 'yearly') return { ...state, activeYears: werkaArchiveActiveYears(labels, current.firstYear) };
  throw new RangeError();
}
