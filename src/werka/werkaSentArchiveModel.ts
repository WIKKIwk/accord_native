import { localizedGetter } from '../shared/localization';
import { werkaArchiveDayRange, werkaArchiveMonthRange, werkaArchiveYearPageRange, werkaArchiveYearRange } from './werkaArchiveCalendar';
import type { WerkaArchivePeriod, WerkaArchiveQuery } from './werkaArchiveApi';

export type SentArchivePanel = 'daily' | 'monthly' | 'yearly';
export type SentArchiveState = { selectedDate: Date; displayMonth: Date; displayYear: number; firstYear: number;
  open: SentArchivePanel | null };

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
export function werkaSentArchiveSelection(period: SentArchivePanel, year: number, month = 1, day = 1): WerkaArchiveQuery {
  if (period === 'yearly') return { kind: 'sent', period, ...werkaArchiveYearRange(year) };
  if (period === 'monthly') return { kind: 'sent', period, ...werkaArchiveMonthRange(year, month) };
  return { kind: 'sent', period, ...werkaArchiveDayRange(year, month, day) };
}

/** Source hides the entire body on the first loading/error when all three sets are empty. */
export function werkaSentArchiveBody(loading: boolean, error: unknown | null,
  activeDays: ReadonlySet<number>, activeMonths: ReadonlySet<number>, activeYears: ReadonlySet<number>) {
  const empty = !activeDays.size && !activeMonths.size && !activeYears.size;
  return loading && empty ? 'loading' as const : error != null && empty ? 'error' as const : 'content' as const;
}
/** Native locale date labels are provided by the owner; no date formatting is guessed here. */
export function werkaSentArchiveHeaders(locale: string, dailyLabel: string, monthlyLabel: string, firstYear: number,
  open: SentArchivePanel | null) {
  const t = (key: string) => localizedGetter(key, locale), action = t('archiveSelectDateAction');
  return [
    { id: 'daily' as const, title: t('archiveDailyTitle'), value: dailyLabel, action, open: open === 'daily' },
    { id: 'monthly' as const, title: t('archiveMonthlyTitle'), value: monthlyLabel, action, open: open === 'monthly' },
    { id: 'yearly' as const, title: t('archiveYearlyTitle'), value: `${firstYear} - ${firstYear + 11}`, action, open: open === 'yearly' },
  ];
}
