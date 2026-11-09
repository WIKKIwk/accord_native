import type { ReactElement } from 'react';
import { localizedGetter } from '../shared/localization';
import { werkaArchiveDayRange, werkaArchiveMonthRange, werkaArchiveYearPageRange, werkaArchiveYearRange } from './werkaArchiveCalendar';
import type { WerkaArchivePeriod, WerkaArchiveQuery } from './werkaArchiveApi';
import { werkaArchiveMediumDate, werkaArchiveMonthYear } from './werkaArchiveDateLabels';
import { werkaArchivePeriodQuery, werkaArchivePeriodStep } from './werkaArchivePeriodPresentation';

export type SentArchivePanel = 'daily' | 'monthly' | 'yearly';
export type SentArchiveState = { selectedDate: Date; displayMonth: Date; displayYear: number; firstYear: number;
  open: SentArchivePanel | null };
export type WerkaSentArchiveContentProps = {
  state: SentArchiveState;
  activeDays: ReadonlySet<number>;
  activeMonths: ReadonlySet<number>;
  activeYears: ReadonlySet<number>;
  loading: boolean;
  error: unknown | null;
  locale: string;
  /** A real platform-native calendar subtree inside this body's Host, with real month/selection events.
   * Required deliberately: there is no substitute picker, mock calendar or production placeholder. */
  dailyCalendar: ReactElement;
  /** Optional source-compatible locale-context overrides; defaults use the recorded Material data. */
  formatMonthYear?: (date: Date) => string;
  formatMediumDate?: (date: Date) => string;
  onToggle: (panel: SentArchivePanel) => void;
  /** Apply each step to the latest state, then perform the matching safe scoped load. */
  onPageStep: (panel: 'monthly' | 'yearly', step: -1 | 1) => void;
  onSelect: (query: WerkaArchiveQuery) => void;
  onRefresh: () => Promise<void>;
};

function dateOnly(value: Date): Date {
  const copy = new Date(value.getTime()); copy.setHours(0, 0, 0, 0); return copy;
}
export function werkaSentArchiveInitial(now: Date): SentArchiveState {
  const year = now.getFullYear();
  return { selectedDate: dateOnly(now), displayMonth: werkaArchiveMonthRange(year, now.getMonth() + 1).from,
    displayYear: year, firstYear: year - 5, open: 'daily' };
}
/** Source opens at most one panel; tapping the open one closes all. */
export function werkaSentArchiveToggle(open: SentArchivePanel | null, selected: WerkaArchivePeriod): SentArchivePanel | null {
  if (selected === 'custom' || open === selected) return null;
  return selected;
}
/** Three request descriptions only; callers must not bind them to an unsafe account. */
export function werkaSentArchiveQueries(state: SentArchiveState): [WerkaArchiveQuery, WerkaArchiveQuery, WerkaArchiveQuery] {
  return [
    { kind: 'sent', period: 'monthly', ...werkaArchiveMonthRange(state.displayMonth.getFullYear(), state.displayMonth.getMonth() + 1) },
    { kind: 'sent', period: 'yearly', ...werkaArchiveYearRange(state.displayYear) },
    { kind: 'sent', period: 'yearly', ...werkaArchiveYearPageRange(state.firstYear) },
  ];
}
/** Arguments only; no actual route is opened. */
export function werkaSentArchiveSelection(period: SentArchivePanel, year: number, month = 1, day = 1): WerkaArchiveQuery & { from: Date; to: Date } {
  if (period === 'yearly') return { kind: 'sent', period, ...werkaArchiveYearRange(year) };
  if (period === 'monthly') return { kind: 'sent', period, ...werkaArchiveMonthRange(year, month) };
  return { kind: 'sent', period, ...werkaArchiveDayRange(year, month, day) };
}

/** Source page action only; retains other panels, selection and opening. No request is sent. */
export function werkaSentArchivePageStep(state: SentArchiveState, panel: 'monthly' | 'yearly', step: -1 | 1) {
  const page = werkaArchivePeriodStep(panel === 'monthly' ? { period: panel, year: state.displayYear }
    : { period: panel, firstYear: state.firstYear }, step);
  const next = page.period === 'monthly' ? { ...state, displayYear: page.year } : { ...state, firstYear: page.firstYear };
  return { state: next, query: werkaArchivePeriodQuery('sent', page) };
}
/** Consume an actual picker month event; changing the day in the same month does not reload. */
export function werkaSentArchiveDisplayedMonth(state: SentArchiveState, value: Date) {
  if (state.displayMonth.getFullYear() === value.getFullYear() && state.displayMonth.getMonth() === value.getMonth()) {
    return { state, query: null };
  }
  const next = { ...state, displayMonth: werkaArchiveMonthRange(value.getFullYear(), value.getMonth() + 1).from };
  return { state: next, query: werkaSentArchiveQueries(next)[0] };
}
/** Unlike the standalone daily screen, sent-hub selection leaves its panel open. */
export function werkaSentArchiveSelectDate(state: SentArchiveState, value: Date) {
  const query = werkaSentArchiveSelection('daily', value.getFullYear(), value.getMonth() + 1, value.getDate());
  return { state: { ...state, selectedDate: new Date(query.from.getTime()) }, query };
}

/** Source hides the entire body on the first loading/error when all three sets are empty. */
export function werkaSentArchiveBody(loading: boolean, error: unknown | null,
  activeDays: ReadonlySet<number>, activeMonths: ReadonlySet<number>, activeYears: ReadonlySet<number>) {
  const empty = !activeDays.size && !activeMonths.size && !activeYears.size;
  return loading && empty ? 'loading' as const : error != null && empty ? 'error' as const : 'content' as const;
}
/** Header metadata also accepts verified labels from a caller's source-compatible locale context. */
export function werkaSentArchiveHeaders(locale: string, dailyLabel: string, monthlyLabel: string, firstYear: number,
  open: SentArchivePanel | null) {
  const t = (key: string) => localizedGetter(key, locale), action = t('archiveSelectDateAction');
  return [
    { id: 'daily' as const, title: t('archiveDailyTitle'), value: dailyLabel, action, open: open === 'daily' },
    { id: 'monthly' as const, title: t('archiveMonthlyTitle'), value: monthlyLabel, action, open: open === 'monthly' },
    { id: 'yearly' as const, title: t('archiveYearlyTitle'), value: `${firstYear} - ${firstYear + 11}`, action, open: open === 'yearly' },
  ];
}

/** Source date header is the selection; the month header is always January of the displayed year. */
export function werkaSentArchivePresentation(state: SentArchiveState, locale: string,
  formatMonthYear = (date: Date) => werkaArchiveMonthYear(date, locale),
  formatMediumDate = (date: Date) => werkaArchiveMediumDate(date, locale)) {
  return { title: localizedGetter('archiveSentTitle', locale), subtitle: localizedGetter('archiveChoosePeriod', locale),
    headers: werkaSentArchiveHeaders(locale, formatMediumDate(new Date(state.selectedDate.getTime())),
      formatMonthYear(werkaArchiveYearRange(state.displayYear).from), state.firstYear, state.open) };
}
