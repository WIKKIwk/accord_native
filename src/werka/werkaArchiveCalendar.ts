import { parseCreatedLabelTimestamp } from '../shared/dispatchRuntimeStores';

type CalendarFields = { year: number; month: number; day: number };
// Dart DateTime.tryParse returns a UTC DateTime when a zone is present, even
// for an offset; its year/month/day getters then use the normalized UTC date.
const explicitZone = /[ T]\d\d(?::?\d\d(?::?\d\d(?:[.,]\d+)?)?)?(?: ?[zZ]| ?[-+]\d\d(?::?\d\d)?)$/;
export function werkaArchiveCalendarFields(value: string): CalendarFields | null {
  const time = parseCreatedLabelTimestamp(value);
  if (time === null) return null;
  const date = new Date(time), utc = explicitZone.test(value.trim());
  return { year: utc ? date.getUTCFullYear() : date.getFullYear(), month: (utc ? date.getUTCMonth() : date.getMonth()) + 1,
    day: utc ? date.getUTCDate() : date.getDate() };
}
export function werkaArchiveActiveDays(labels: readonly string[], year: number, month: number): Set<number> {
  const days = new Set<number>();
  for (const label of labels) { const date = werkaArchiveCalendarFields(label); if (date?.year === year && date.month === month) days.add(date.day); }
  return days;
}
export function werkaArchiveActiveMonths(labels: readonly string[], year: number): Set<number> {
  const months = new Set<number>();
  for (const label of labels) { const date = werkaArchiveCalendarFields(label); if (date?.year === year) months.add(date.month); }
  return months;
}
export function werkaArchiveActiveYears(labels: readonly string[], firstYear: number): Set<number> {
  const years = new Set<number>();
  for (const label of labels) { const date = werkaArchiveCalendarFields(label); if (date && date.year >= firstYear && date.year <= firstYear + 11) years.add(date.year); }
  return years;
}
/** Local DateTime(year, month, day), avoiding JS's special handling of years 0–99. */
function localDate(year: number, month: number, day: number): Date {
  const date = new Date(0); date.setHours(0, 0, 0, 0); date.setFullYear(year, month - 1, day); return date;
}
export function werkaArchiveMonthRange(year: number, month: number) {
  return { from: localDate(year, month, 1), to: localDate(year, month + 1, 0) };
}
export function werkaArchiveYearRange(year: number) {
  return { from: localDate(year, 1, 1), to: localDate(year, 12, 31) };
}
export function werkaArchiveYearPageRange(firstYear: number) {
  return { from: localDate(firstYear, 1, 1), to: localDate(firstYear + 11, 12, 31) };
}
