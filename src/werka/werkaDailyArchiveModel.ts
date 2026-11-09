import { localizedGetter } from '../shared/localization';
import type { WerkaArchiveKind, WerkaArchiveQuery } from './werkaArchiveApi';
import { werkaArchiveDayRange, werkaArchiveMonthRange, werkaArchiveYearRange } from './werkaArchiveCalendar';
import { werkaArchiveMediumDate } from './werkaArchiveDateLabels';
import { werkaArchivePeriodBody } from './werkaArchivePeriodPresentation';
import type { ReactNode } from 'react';

export type WerkaDailyArchiveState = { displayMonth: Date; selectedDate: Date | null; calendarOpen: boolean };
/** Controlled body only. The owner must guard callbacks and supply the real picker subtree. */
export type WerkaDailyArchiveContentProps = {
  kind: WerkaArchiveKind;
  state: WerkaDailyArchiveState;
  activeDays: ReadonlySet<number>;
  loading: boolean;
  error: unknown | null;
  locale: string;
  /** Keep the same child type/key and pass enabled through to its guarded picker callbacks. */
  renderCalendar: (enabled: boolean) => ReactNode;
  onToggle: () => void;
  onRefresh: () => Promise<void>;
};

/** Source initState only. The eventual owner must schedule and guard the first-frame callback. */
export function werkaDailyArchiveInitial(now: Date): WerkaDailyArchiveState {
  return { displayMonth: werkaArchiveMonthRange(now.getFullYear(), now.getMonth() + 1).from,
    selectedDate: werkaArchiveDayRange(now.getFullYear(), now.getMonth() + 1, now.getDate()).from, calendarOpen: false };
}
export function werkaDailyArchiveReveal(state: WerkaDailyArchiveState): WerkaDailyArchiveState {
  return { ...state, calendarOpen: true };
}
export function werkaDailyArchiveToggle(state: WerkaDailyArchiveState): WerkaDailyArchiveState {
  return { ...state, calendarOpen: !state.calendarOpen };
}

/** Recalculate from the owner's current clock, as the source does in each build. */
export function werkaDailyArchiveBounds(now: Date) {
  return { firstDate: werkaArchiveYearRange(now.getFullYear() - 5).from,
    lastDate: werkaArchiveYearRange(now.getFullYear() + 1).to };
}
export function werkaDailyArchiveQuery(kind: WerkaArchiveKind, state: WerkaDailyArchiveState): WerkaArchiveQuery {
  return { kind, period: 'monthly', ...werkaArchiveMonthRange(state.displayMonth.getFullYear(), state.displayMonth.getMonth() + 1) };
}

/** Description of a real picker month event only; no event, request or active-day update is fabricated. */
export function werkaDailyArchiveDisplayedMonth(kind: WerkaArchiveKind, state: WerkaDailyArchiveState, value: Date) {
  if (state.displayMonth.getFullYear() === value.getFullYear() && state.displayMonth.getMonth() === value.getMonth()) {
    return { state, query: null };
  }
  const next = { ...state, displayMonth: werkaArchiveMonthRange(value.getFullYear(), value.getMonth() + 1).from };
  return { state: next, query: werkaDailyArchiveQuery(kind, next) };
}

/** Picker selection closes the standalone calendar. It does not change the displayed month or navigate. */
export function werkaDailyArchiveSelect(kind: WerkaArchiveKind, state: WerkaDailyArchiveState, value: Date) {
  const range = werkaArchiveDayRange(value.getFullYear(), value.getMonth() + 1, value.getDate());
  return { state: { ...state, selectedDate: new Date(range.from.getTime()), calendarOpen: false },
    query: { kind, period: 'daily', ...range } satisfies WerkaArchiveQuery };
}

/** Pure source header/body choice. Calendar controls, animation, loading and lifecycle are not implemented here. */
export function werkaDailyArchivePresentation(kind: WerkaArchiveKind, state: WerkaDailyArchiveState,
  activeDays: ReadonlySet<number>, loading: boolean, error: unknown | null, locale: string) {
  const t = (key: string) => localizedGetter(key, locale);
  const kindTitle = t(kind === 'received' ? 'archiveReceivedTitle' : kind === 'returned' ? 'archiveReturnedTitle' : 'archiveSentTitle');
  const count = activeDays.size;
  return { title: `${kindTitle} • ${t('archiveDailyTitle')}`, body: werkaArchivePeriodBody(loading, error, activeDays),
    headerLoading: loading && count === 0, dateTitle: t('archiveDateTitle'), action: t('archiveSelectDateAction'),
    selectedDateLabel: state.selectedDate === null ? t('archiveSelectDateAction') : werkaArchiveMediumDate(state.selectedDate, locale),
    // This Uzbek literal is shown even in V2's other app languages.
    summary: count === 0 ? t('archiveCalendarEmptyMonth') : `${count} ta faol kun`, calendarOpen: state.calendarOpen };
}
