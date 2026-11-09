import type { WerkaArchivePickerBounds } from './werkaArchivePickerModel';
import { werkaArchivePickerMonth } from './werkaArchivePickerModel';

/** Material locale-context values, not arbitrary device Intl defaults or production placeholders. */
export type WerkaArchivePickerLocale = {
  firstDayOfWeekIndex: number;
  narrowWeekdays: readonly string[];
  formatDecimal: (number: number) => string;
  formatYear: (year: number) => string;
  formatMonthYear: (date: Date) => string;
  formatFullDate: (date: Date) => string;
  previousMonthTooltip: string;
  nextMonthTooltip: string;
  selectYearSemanticsLabel: string;
  currentDateLabel: string;
};
export type WerkaArchiveDatePickerProps = {
  initialDate: Date | null;
  currentDate: Date;
  /** Fixed for this picker instance. A changed span requires an explicit, source-reviewed remount. */
  bounds: WerkaArchivePickerBounds;
  localeContext: WerkaArchivePickerLocale;
  enabled: boolean;
  onDisplayedMonthChanged: (date: Date) => void;
  onDateChanged: (date: Date) => void;
  /** Native pager failures are reported, never converted into successful month changes. */
  onPagerError: (error: unknown) => void;
};

export function werkaArchivePickerPage(date: Date, selectedDate: Date | null, props: WerkaArchiveDatePickerProps) {
  const context = props.localeContext;
  if (context.narrowWeekdays.length !== 7 || context.narrowWeekdays.some(value => typeof value !== 'string')) throw new RangeError();
  const model = werkaArchivePickerMonth(date, selectedDate, props.currentDate, props.bounds, context.firstDayOfWeekIndex);
  const cells = model.cells.map(cell => cell === null ? null : {
    ...cell, label: context.formatDecimal(cell.day),
    id: `archive_picker_day_${date.getFullYear()}_${date.getMonth() + 1}_${cell.day}`,
    accessibilityLabel: `${context.formatDecimal(cell.day)}, ${context.formatFullDate(new Date(cell.date.getTime()))}${cell.today ? `, ${context.currentDateLabel}` : ''}`,
  });
  return { ...model, cells, weekdayLabels: model.weekdayOrder.map(index => context.narrowWeekdays[index]),
    // Native row layout needs inert trailing spaces, never next-month dates or buttons.
    rows: model.rows.map((_, index) => Array.from({ length: 7 }, (__, column) => cells[index * 7 + column] ?? null)) };
}
