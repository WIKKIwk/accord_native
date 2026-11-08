import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { werkaArchiveDayRange } from './werkaArchiveCalendar';
import { werkaArchivePickerInitial, werkaArchivePickerMonths, werkaArchivePickerYearChoice, type WerkaArchivePickerState } from './werkaArchivePickerModel';
import type { WerkaArchiveDatePickerProps } from './werkaArchivePickerPresentation';

/** UI state only. Notifications originate only in real pager/button handlers, never mount/prop effects.
 * Callbacks are not account guards. The eventual owner must remount per session and guard every callback. */
export function useWerkaArchivePicker(props: WerkaArchiveDatePickerProps) {
  const [state, setState] = useState(() => werkaArchivePickerInitial(props.initialDate, props.currentDate, props.bounds));
  const current = useRef(state), options = useRef(props), alive = useRef(true);
  // Native page events can arrive after a pager is removed. A new mode or enablement
  // owns a new token, so an old page or animation result cannot mutate the new picker.
  const token = useMemo(() => ({ mode: state.mode, enabled: props.enabled }), [state.mode, props.enabled]);
  const activeToken = useRef(token);
  const span = `${props.bounds.firstDate.getFullYear()}:${props.bounds.firstDate.getMonth()}:${props.bounds.firstDate.getDate()}/${props.bounds.lastDate.getFullYear()}:${props.bounds.lastDate.getMonth()}:${props.bounds.lastDate.getDate()}`;
  const [initialSpan] = useState(span);
  // initialPage is mount-only in Compose. Never silently reinterpret the native page after a bounds change.
  if (span !== initialSpan) throw new RangeError();
  useLayoutEffect(() => { options.current = props; activeToken.current = token; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const commit = (next: WerkaArchivePickerState) => { current.current = next; setState(next); };
  const months = werkaArchivePickerMonths(props.bounds);
  const index = months.findIndex(value => value.getFullYear() === state.displayMonth.getFullYear()
    && value.getMonth() === state.displayMonth.getMonth());
  if (index < 0) throw new RangeError();
  const isCurrent = () => alive.current && options.current.enabled && activeToken.current === token;
  const interact = (mode: WerkaArchivePickerState['mode']) => isCurrent() && current.current.mode === mode;
  const showMonth = (page: number) => {
    if (!interact('day') || !Number.isInteger(page)) return;
    const value = werkaArchivePickerMonths(options.current.bounds)[page], before = current.current;
    if (!value || (before.displayMonth.getFullYear() === value.getFullYear() && before.displayMonth.getMonth() === value.getMonth())) return;
    commit({ ...before, displayMonth: value });
    options.current.onDisplayedMonthChanged(new Date(value.getTime()));
  };
  const selectDay = (value: Date) => {
    if (!interact('day') || !Number.isFinite(value.getTime())) return;
    const before = current.current, bounds = options.current.bounds;
    if (value.getFullYear() !== before.displayMonth.getFullYear() || value.getMonth() !== before.displayMonth.getMonth()) return;
    const date = werkaArchiveDayRange(value.getFullYear(), value.getMonth() + 1, value.getDate()).from;
    const first = werkaArchiveDayRange(bounds.firstDate.getFullYear(), bounds.firstDate.getMonth() + 1, bounds.firstDate.getDate()).from;
    const last = werkaArchiveDayRange(bounds.lastDate.getFullYear(), bounds.lastDate.getMonth() + 1, bounds.lastDate.getDate()).from;
    if (date < first || date > last) return;
    commit({ ...before, selectedDate: date });
    options.current.onDateChanged(new Date(date.getTime()));
  };
  const selectYear = (year: number) => {
    if (!interact('year')) return;
    const before = current.current, choice = werkaArchivePickerYearChoice(before.displayMonth, before.selectedDate, year, options.current.bounds);
    if (!choice) return;
    commit({ mode: choice.mode, displayMonth: choice.displayMonth, selectedDate: choice.selectedDate });
    if (choice.monthChanged) options.current.onDisplayedMonthChanged(new Date(choice.displayMonth.getTime()));
    if (alive.current && options.current.enabled) options.current.onDateChanged(new Date(choice.selectedDate.getTime()));
  };
  const toggleMode = () => {
    if (!isCurrent()) return;
    const before = current.current;
    commit({ ...before, mode: before.mode === 'day' ? 'year' : 'day' });
  };
  const reportPagerError = (error: unknown) => {
    if (isCurrent()) options.current.onPagerError(error);
  };
  const requestMonthStep = (step: -1 | 1, request: (page: number) => Promise<void>) => {
    if (!interact('day')) return;
    const pages = werkaArchivePickerMonths(options.current.bounds), shown = current.current.displayMonth;
    const currentIndex = pages.findIndex(value => value.getFullYear() === shown.getFullYear() && value.getMonth() === shown.getMonth());
    const target = currentIndex + step;
    if (target < 0 || target >= pages.length) return;
    try { void request(target).catch(reportPagerError); } catch (error) { reportPagerError(error); }
  };
  return { state, months, index, showMonth, selectDay, selectYear, toggleMode, requestMonthStep, reportPagerError };
}
