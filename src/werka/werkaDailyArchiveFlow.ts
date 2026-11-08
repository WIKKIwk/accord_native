import type { WerkaArchiveKind, WerkaArchiveQuery, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaArchiveActiveDays } from './werkaArchiveCalendar';
import { werkaDailyArchiveDisplayedMonth, werkaDailyArchiveInitial, werkaDailyArchiveQuery, werkaDailyArchiveReveal,
  werkaDailyArchiveSelect, werkaDailyArchiveToggle, type WerkaDailyArchiveState } from './werkaDailyArchiveModel';
import type { WerkaGuardEvaluator } from './werkaGuardTypes';

type ArchiveResponse = Pick<ReturnType<typeof werkaArchiveResponseFromJson>, 'items'>;
export type WerkaDailyArchiveFlowSnapshot = Readonly<{
  calendar: WerkaDailyArchiveState;
  activeDays: ReadonlySet<number>;
  loading: boolean;
  error: unknown | null;
}>;
type Dependencies = {
  /** Capture the originating session, scope, permission and auth generation. */
  isCurrent: () => boolean;
  /** Required verified synchronous evaluator; no production fallback is provided here. */
  evaluateGuard: WerkaGuardEvaluator;
  /** The real adapter must guard every send, retry, redirect and response decode. */
  load: (query: WerkaArchiveQuery) => Promise<ArchiveResponse>;
  onState: (snapshot: WerkaDailyArchiveFlowSnapshot) => void;
};
const copyDate = (value: Date | null) => value === null ? null : new Date(value.getTime());
const copyCalendar = (value: WerkaDailyArchiveState): WerkaDailyArchiveState => ({
  displayMonth: new Date(value.displayMonth.getTime()), selectedDate: copyDate(value.selectedDate), calendarOpen: value.calendarOpen,
});

/** Unwired flow. The owner must supply the real first-frame callback, session guard and safe navigation. */
export class WerkaDailyArchiveFlow {
  private state: WerkaDailyArchiveFlowSnapshot;
  private disposed = false;
  private started = false;
  private requestGeneration = 0;
  private actionGeneration = 0;
  constructor(private readonly kind: WerkaArchiveKind, now: Date, private readonly deps: Dependencies) {
    if (!Number.isFinite(now.getTime())) throw new RangeError();
    this.state = { calendar: werkaDailyArchiveInitial(now), activeDays: new Set(), loading: true, error: null };
  }
  private current(): boolean {
    if (this.disposed) return false;
    const guard = this.deps.isCurrent, evaluate = this.deps.evaluateGuard;
    try {
      const result: unknown = evaluate(guard);
      if (result !== true) {
        // A broken evaluator must fail closed without an unhandled rejected thenable.
        if (result != null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
        return false;
      }
      return !this.disposed && this.deps.isCurrent === guard && this.deps.evaluateGuard === evaluate;
    } catch { return false; }
  }
  private snapshot(): WerkaDailyArchiveFlowSnapshot {
    return { ...this.state, calendar: copyCalendar(this.state.calendar), activeDays: new Set(this.state.activeDays) };
  }
  getSnapshot(): WerkaDailyArchiveFlowSnapshot | null { return this.current() ? this.snapshot() : null; }
  private publish(patch: Partial<WerkaDailyArchiveFlowSnapshot>): boolean {
    if (!this.current()) return false;
    const onState = this.deps.onState;
    this.state = { ...this.state, ...patch };
    if (!this.current() || this.deps.onState !== onState) return false;
    onState(this.snapshot());
    return this.current() && this.deps.onState === onState;
  }
  private validRequest(generation: number, load: Dependencies['load'], onState: Dependencies['onState']): boolean {
    return generation === this.requestGeneration && this.current() && this.deps.load === load && this.deps.onState === onState;
  }
  private async load(calendar: WerkaDailyArchiveState): Promise<void> {
    if (!this.current()) return;
    const generation = ++this.requestGeneration;
    this.actionGeneration++;
    const captured = copyCalendar(calendar), query = werkaDailyArchiveQuery(this.kind, captured);
    const load = this.deps.load, onState = this.deps.onState;
    if (!this.publish({ calendar: captured, loading: true, error: null }) || !this.validRequest(generation, load, onState)) return;
    try {
      const result = await load(query);
      if (!this.validRequest(generation, load, onState)) return;
      const days = werkaArchiveActiveDays(result.items.map(item => item.created_label),
        captured.displayMonth.getFullYear(), captured.displayMonth.getMonth() + 1);
      this.publish({ activeDays: days });
    } catch (error) {
      if (this.validRequest(generation, load, onState)) this.publish({ error });
    } finally {
      if (this.validRequest(generation, load, onState)) this.publish({ loading: false });
    }
  }
  async start(): Promise<void> {
    if (this.started || !this.current()) return;
    this.started = true;
    await this.load(this.state.calendar);
  }
  async refresh(): Promise<void> {
    if (!this.started || !this.current()) return;
    await this.load(this.state.calendar);
  }
  /** Called only by the owner's real post-frame callback; this flow schedules no frame. */
  revealAfterFrame(): void {
    if (!this.started || !this.current()) return;
    this.actionGeneration++;
    this.publish({ calendar: werkaDailyArchiveReveal(this.state.calendar) });
  }
  toggleCalendar(): void {
    if (!this.started || !this.current()) return;
    if (this.state.activeDays.size === 0 && (this.state.loading || this.state.error !== null)) return;
    this.actionGeneration++;
    this.publish({ calendar: werkaDailyArchiveToggle(this.state.calendar) });
  }
  /** Call only in response to a real displayed-month event, never a requested pager target. */
  async displayedMonthChanged(value: Date): Promise<void> {
    if (!this.started || !this.current() || !this.state.calendar.calendarOpen || !Number.isFinite(value.getTime())) return;
    const next = werkaDailyArchiveDisplayedMonth(this.kind, this.state.calendar, value);
    if (next.query === null) return;
    await this.load(next.state);
  }
  /** Call only for an enabled picker day. The owner must recheck the guard before navigating. */
  selectDate(value: Date): WerkaArchiveQuery | null {
    if (!this.started || !this.current() || !this.state.calendar.calendarOpen || !Number.isFinite(value.getTime())) return null;
    const result = werkaDailyArchiveSelect(this.kind, this.state.calendar, value), action = ++this.actionGeneration;
    const published = this.publish({ calendar: result.state });
    return published && action === this.actionGeneration && this.current() ? result.query : null;
  }
  dispose(): void { this.disposed = true; this.requestGeneration++; this.actionGeneration++; }
}
