import { localizedGetter } from '../shared/localization';
import type { WerkaArchiveKind, WerkaArchiveQuery } from './werkaArchiveApi';
import { werkaArchiveMonthRange, werkaArchiveYearPageRange, werkaArchiveYearRange } from './werkaArchiveCalendar';
import { werkaArchiveMonthYear } from './werkaArchiveDateLabels';

export type WerkaArchivePeriodPage = { period: 'monthly'; year: number } | { period: 'yearly'; firstYear: number };
export type WerkaArchivePeriodContentProps = {
  kind: WerkaArchiveKind;
  page: WerkaArchivePeriodPage;
  active: ReadonlySet<number>;
  loading: boolean;
  error: unknown | null;
  locale: string;
  /** Optional source-compatible override; defaults to the role's recorded Material date labels. */
  formatMonthYear?: (date: Date) => string;
  /** Apply each step to the owner's latest page, then perform its scoped load. */
  onPageStep: (step: -1 | 1) => void;
  onSelect: (query: WerkaArchiveQuery) => void;
  onRefresh: () => Promise<void>;
};
export type WerkaArchivePeriodGridProps = Pick<WerkaArchivePeriodContentProps,
  'kind' | 'page' | 'active' | 'locale' | 'formatMonthYear' | 'onPageStep' | 'onSelect'> & {
  /** Sent-hub panels use narrower month cells and do not show the standalone empty-year message. */
  variant?: 'standalone' | 'sent';
};

/** Initial month/year pages in the two standalone V2 archive calendars. */
export function werkaArchivePeriodInitial(period: WerkaArchivePeriodPage['period'], now: Date): WerkaArchivePeriodPage {
  const year = now.getFullYear();
  return period === 'monthly' ? { period, year } : { period, firstYear: year - 5 };
}

/** Request description only. Both standalone calendars load yearly archive data. */
export function werkaArchivePeriodQuery(kind: WerkaArchiveKind, page: WerkaArchivePeriodPage): WerkaArchiveQuery {
  const range = page.period === 'monthly' ? werkaArchiveYearRange(page.year) : werkaArchiveYearPageRange(page.firstYear);
  return { kind, period: 'yearly', ...range };
}

export function werkaArchivePeriodStep(page: WerkaArchivePeriodPage, step: -1 | 1): WerkaArchivePeriodPage {
  return page.period === 'monthly' ? { period: 'monthly', year: page.year + step }
    : { period: 'yearly', firstYear: page.firstYear + step * 12 };
}

/** Loading belongs below the native title, not in the body; retained active data wins over error. */
export function werkaArchivePeriodBody(loading: boolean, error: unknown | null, active: ReadonlySet<number>) {
  return loading && active.size === 0 ? 'loading' as const
    : error != null && active.size === 0 ? 'error' as const : 'content' as const;
}

function pageLabel(page: WerkaArchivePeriodPage): string {
  return page.period === 'monthly' ? `${page.year}` : `${page.firstYear} - ${page.firstYear + 11}`;
}

/** Pure content and callback arguments, not a controller, account guard or route. */
export function werkaArchivePeriodPresentation(kind: WerkaArchiveKind, page: WerkaArchivePeriodPage,
  active: ReadonlySet<number>, locale: string, formatMonthYear = (date: Date) => werkaArchiveMonthYear(date, locale)) {
  const t = (key: string) => localizedGetter(key, locale);
  const previous = werkaArchivePeriodStep(page, -1), next = werkaArchivePeriodStep(page, 1);
  const cells = Array.from({ length: 12 }, (_, index) => {
    const value = page.period === 'monthly' ? index + 1 : page.firstYear + index;
    const range = page.period === 'monthly' ? werkaArchiveMonthRange(page.year, value) : werkaArchiveYearRange(value);
    // V2 deliberately takes the first space-separated part, not an Intl short month.
    const label = page.period === 'monthly' ? formatMonthYear(new Date(range.from.getTime())).split(' ')[0] : `${value}`;
    return { id: `archive_${page.period === 'monthly' ? 'month' : 'year'}_${value}`, label, active: active.has(value),
      query: { kind, period: page.period, ...range } satisfies WerkaArchiveQuery };
  });
  const kindTitle = t(kind === 'received' ? 'archiveReceivedTitle' : kind === 'returned' ? 'archiveReturnedTitle' : 'archiveSentTitle');
  return { title: `${kindTitle} • ${t(page.period === 'monthly' ? 'archiveMonthlyTitle' : 'archiveYearlyTitle')}`,
    pageLabel: pageLabel(page), previous, next, previousLabel: pageLabel(previous), nextLabel: pageLabel(next),
    cells, rows: Array.from({ length: 4 }, (_, index) => cells.slice(index * 3, index * 3 + 3)),
    emptyLabel: active.size === 0 ? t('archiveCalendarEmptyYear') : null };
}

/** Same real grid contract in standalone calendars and the sent hub, with their source layout differences. */
export function werkaArchivePeriodGridPresentation(props: WerkaArchivePeriodGridProps) {
  const model = werkaArchivePeriodPresentation(props.kind, props.page, props.active, props.locale, props.formatMonthYear);
  const sent = props.variant === 'sent', prefix = sent ? `sent_archive_${props.page.period}` : 'archive';
  const cells = model.cells.map(cell => ({ ...cell, id: sent ? `sent_${cell.id}` : cell.id }));
  return { ...model, cells, rows: Array.from({ length: 4 }, (_, index) => cells.slice(index * 3, index * 3 + 3)),
    previousId: `${prefix}_previous_page`, nextId: `${prefix}_next_page`,
    monthWidth: sent ? 86 : 100, monthSpacing: sent ? 8 : 10, emptyLabel: sent ? null : model.emptyLabel };
}
