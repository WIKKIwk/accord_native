import { werkaArchiveDayRange, werkaArchiveMonthRange } from './werkaArchiveCalendar';

export type WerkaArchivePickerBounds = { firstDate: Date; lastDate: Date };
export type WerkaArchivePickerState = { displayMonth: Date; selectedDate: Date | null; mode: 'day' | 'year' };

function dateOnly(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new RangeError();
  return werkaArchiveDayRange(value.getFullYear(), value.getMonth() + 1, value.getDate()).from;
}
function sameDay(left: Date | null, right: Date): boolean {
  return left !== null && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}
function month(value: Date): Date {
  const date = dateOnly(value);
  return werkaArchiveMonthRange(date.getFullYear(), date.getMonth() + 1).from;
}
function normalizedBounds(bounds: WerkaArchivePickerBounds) {
  const firstDate = dateOnly(bounds.firstDate), lastDate = dateOnly(bounds.lastDate);
  if (firstDate > lastDate) throw new RangeError();
  return { firstDate, lastDate };
}

/** CalendarDatePicker owns this state; subsequent initialDate changes require an explicit remount. */
export function werkaArchivePickerInitial(initialDate: Date | null, currentDate: Date,
  bounds: WerkaArchivePickerBounds): WerkaArchivePickerState {
  const { firstDate, lastDate } = normalizedBounds(bounds), selectedDate = initialDate === null ? null : dateOnly(initialDate);
  const displayMonth = month(selectedDate ?? currentDate);
  if (displayMonth < month(firstDate) || displayMonth > month(lastDate)
    || (selectedDate !== null && (selectedDate < firstDate || selectedDate > lastDate))) throw new RangeError();
  return { displayMonth, selectedDate, mode: 'day' };
}

export function werkaArchivePickerMonths(bounds: WerkaArchivePickerBounds): Date[] {
  const { firstDate, lastDate } = normalizedBounds(bounds);
  const count = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + lastDate.getMonth() - firstDate.getMonth() + 1;
  return Array.from({ length: count }, (_, index) =>
    werkaArchiveMonthRange(firstDate.getFullYear(), firstDate.getMonth() + index + 1).from);
}

/** The source YearPicker backfills to 18 cells; its selected year is the displayed month, not selectedDate. */
export function werkaArchivePickerYears(displayMonth: Date, currentDate: Date, bounds: WerkaArchivePickerBounds, columns: 2 | 3 = 3) {
  const { firstDate, lastDate } = normalizedBounds(bounds), shown = month(displayMonth), today = dateOnly(currentDate);
  const count = lastDate.getFullYear() - firstDate.getFullYear() + 1, offset = count < 18 ? Math.floor((18 - count) / 2) : 0;
  const cells = Array.from({ length: Math.max(count, 18) }, (_, index) => {
    const year = firstDate.getFullYear() + index - offset;
    return { year, enabled: year >= firstDate.getFullYear() && year <= lastDate.getFullYear(),
      selected: year === shown.getFullYear(), today: year === today.getFullYear() };
  });
  return { cells, rows: Array.from({ length: Math.ceil(cells.length / columns) }, (_, index) => cells.slice(index * columns, (index + 1) * columns)) };
}

/** Declared Flutter 3.47.8 Gregorian day-grid contract, not a native picker implementation.
 * The real locale context supplies the Sunday-based first-weekday index. No locale default is guessed.
 * Source: DateUtils.firstDayOffset and CalendarDatePicker._DayPicker, plus the V2 sent-hub height factor. */
export function werkaArchivePickerMonth(displayMonth: Date, selectedDate: Date | null, currentDate: Date,
  bounds: WerkaArchivePickerBounds, firstDayOfWeekIndex: number) {
  if (!Number.isInteger(firstDayOfWeekIndex) || firstDayOfWeekIndex < 0 || firstDayOfWeekIndex > 6) throw new RangeError();
  const { firstDate, lastDate } = normalizedBounds(bounds), shown = month(displayMonth), today = dateOnly(currentDate);
  const selected = selectedDate === null ? null : dateOnly(selectedDate);
  if (shown < month(firstDate) || shown > month(lastDate) || (selected !== null && (selected < firstDate || selected > lastDate))) {
    throw new RangeError();
  }
  const range = werkaArchiveMonthRange(shown.getFullYear(), shown.getMonth() + 1);
  const daysInMonth = range.to.getDate(), firstDayOffset = (shown.getDay() - firstDayOfWeekIndex + 7) % 7;
  const dayRows = Math.ceil((firstDayOffset + daysInMonth) / 7);
  const cells = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => {
    const day = index - firstDayOffset + 1;
    if (day < 1) return null;
    const date = werkaArchiveDayRange(shown.getFullYear(), shown.getMonth() + 1, day).from;
    return { day, date, enabled: date >= firstDate && date <= lastDate,
      selected: sameDay(selected, date), today: sameDay(today, date) };
  });
  return { displayMonth: shown, daysInMonth, firstDayOffset, dayRows, sentHeightFactor: (dayRows + 1) / 7,
    weekdayOrder: Array.from({ length: 7 }, (_, index) => (firstDayOfWeekIndex + index) % 7),
    cells, rows: Array.from({ length: dayRows }, (_, index) => cells.slice(index * 7, index * 7 + 7)),
    previousMonth: werkaArchiveMonthRange(shown.getFullYear(), shown.getMonth()).from,
    nextMonth: werkaArchiveMonthRange(shown.getFullYear(), shown.getMonth() + 2).from,
    previousEnabled: shown > month(firstDate), nextEnabled: shown < month(lastDate) };
}

/** Description after a real enabled year-cell choice in the declared SDK. It emits no picker event.
 * YearPicker keeps the displayed month, clamps boundary months, then CalendarDatePicker prefers the
 * selected day (or 1), clamps it to the target month/bounds and returns to day mode.
 * A real adapter must deliver its month change before its date selection, including an unchanged date. */
export function werkaArchivePickerYearChoice(displayMonth: Date, selectedDate: Date | null, year: number,
  bounds: WerkaArchivePickerBounds) {
  if (!Number.isInteger(year)) throw new RangeError();
  const { firstDate, lastDate } = normalizedBounds(bounds), shown = month(displayMonth);
  const selected = selectedDate === null ? null : dateOnly(selectedDate);
  if (year < firstDate.getFullYear() || year > lastDate.getFullYear()) return null;
  let targetMonth = shown.getMonth() + 1;
  if (year === firstDate.getFullYear()) targetMonth = Math.max(targetMonth, firstDate.getMonth() + 1);
  if (year === lastDate.getFullYear()) targetMonth = Math.min(targetMonth, lastDate.getMonth() + 1);
  const daysInMonth = werkaArchiveMonthRange(year, targetMonth).to.getDate();
  let date = werkaArchiveDayRange(year, targetMonth, Math.min(selected?.getDate() ?? 1, daysInMonth)).from;
  if (date < firstDate) date = firstDate;
  else if (date > lastDate) date = lastDate;
  const display = month(date);
  return { mode: 'day' as const, selectedDate: new Date(date.getTime()), displayMonth: display,
    monthChanged: shown.getFullYear() !== display.getFullYear() || shown.getMonth() !== display.getMonth() };
}
