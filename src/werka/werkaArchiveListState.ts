import { localizedGetter } from '../shared/localization';
import type { WerkaArchiveKind, WerkaArchivePeriod, WerkaArchiveQuery } from './werkaArchiveApi';
import { werkaArchiveDayRange, werkaArchiveMonthRange } from './werkaArchiveCalendar';
import { werkaArchiveMediumDate } from './werkaArchiveDateLabels';

export type WerkaArchiveListState = {
  kind: WerkaArchiveKind;
  period: WerkaArchivePeriod;
  from: Date | null;
  to: Date | null;
  calendarOpen: boolean;
};
const copy = (value: Date | null | undefined) => value == null ? null : new Date(value.getTime());

/** V2 initState only. It describes a query but performs no load. */
export function werkaArchiveListInitial(kind: WerkaArchiveKind, period: WerkaArchivePeriod,
  from: Date | null, to: Date | null, now: Date): WerkaArchiveListState {
  let first = copy(from), last = copy(to);
  if ((period === 'daily' || period === 'monthly') && (first === null || last === null)) {
    if (period === 'daily') {
      const day = werkaArchiveDayRange(now.getFullYear(), now.getMonth() + 1, now.getDate());
      first = day.from; last = day.to;
    } else {
      first = werkaArchiveMonthRange(now.getFullYear(), now.getMonth() + 1).from;
      const nextMonth = werkaArchiveMonthRange(now.getFullYear(), now.getMonth() + 2).from;
      // Source _lastDayOfMonth subtracts a 24-hour Duration, not one calendar day.
      last = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
    }
  }
  return { kind, period, from: first, to: last, calendarOpen: false };
}

/** Copies preserve the source request values without exposing mutable picker state. */
export function werkaArchiveListQuery(state: WerkaArchiveListState): WerkaArchiveQuery {
  return { kind: state.kind, period: state.period, from: copy(state.from), to: copy(state.to) };
}
export function werkaArchiveListToggleCalendar(state: WerkaArchiveListState): WerkaArchiveListState {
  return { ...state, calendarOpen: !state.calendarOpen };
}

/** A real daily date choice always closes and requests a reload, even when unchanged. */
export function werkaArchiveListSelectDaily(state: WerkaArchiveListState, picked: Date) {
  const day = werkaArchiveDayRange(picked.getFullYear(), picked.getMonth() + 1, picked.getDate());
  const next = { ...state, from: day.from, to: day.to, calendarOpen: false };
  return { state: next, query: werkaArchiveListQuery(next) };
}

export function werkaArchiveListDateLabels(state: WerkaArchiveListState, locale: string, materialAvailable: boolean) {
  const selectedDate = state.from === null || !materialAvailable ? localizedGetter('archiveSelectDateAction', locale)
    : werkaArchiveMediumDate(state.from, locale);
  const subtitle = state.from === null || state.to === null || !materialAvailable ? ''
    : `${werkaArchiveMediumDate(state.from, locale)} - ${werkaArchiveMediumDate(state.to, locale)}`;
  return { selectedDate, subtitle };
}
export function werkaArchiveListPdfEnabled(itemCount: number, downloading: boolean): boolean {
  return itemCount > 0 && !downloading;
}
