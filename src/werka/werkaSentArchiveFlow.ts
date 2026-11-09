import type { WerkaArchiveQuery, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaArchiveActiveDays, werkaArchiveActiveMonths, werkaArchiveActiveYears } from './werkaArchiveCalendar';
import type { WerkaGuardEvaluator } from './werkaGuardTypes';
import { werkaSentArchiveDisplayedMonth, werkaSentArchiveInitial, werkaSentArchivePageStep, werkaSentArchiveQueries,
  werkaSentArchiveSelectDate, werkaSentArchiveSelection, werkaSentArchiveToggle,
  type SentArchivePanel, type SentArchiveState } from './werkaSentArchiveModel';

type ArchiveResponse = Pick<ReturnType<typeof werkaArchiveResponseFromJson>, 'items'>;
export type WerkaSentArchiveFlowSnapshot = Readonly<{
  calendar: SentArchiveState;
  activeDays: ReadonlySet<number>;
  activeMonths: ReadonlySet<number>;
  activeYears: ReadonlySet<number>;
  loading: boolean;
  error: unknown | null;
}>;
type Dependencies = {
  isCurrent: () => boolean;
  /** Required verified synchronous evaluator; this branch supplies no fallback. */
  evaluateGuard: WerkaGuardEvaluator;
  /** The real adapter must guard every send, retry, redirect and response decode. */
  load: (query: WerkaArchiveQuery) => Promise<ArchiveResponse>;
  onState: (snapshot: WerkaSentArchiveFlowSnapshot) => void;
};
type Binding = Pick<Dependencies, 'load' | 'onState'>;
const panels: readonly SentArchivePanel[] = ['daily', 'monthly', 'yearly'];
const copyCalendar = (value: SentArchiveState): SentArchiveState => ({ ...value,
  selectedDate: new Date(value.selectedDate.getTime()), displayMonth: new Date(value.displayMonth.getTime()) });

/** Unwired sent-hub flow; owners must bind real scope guards, native events and safe navigation. */
export class WerkaSentArchiveFlow {
  private state: WerkaSentArchiveFlowSnapshot;
  private disposed = false;
  private started = false;
  private generation: Record<SentArchivePanel, number> = { daily: 0, monthly: 0, yearly: 0 };
  private actionGeneration = 0;
  constructor(now: Date, private readonly deps: Dependencies) {
    if (!Number.isFinite(now.getTime())) throw new RangeError();
    this.state = { calendar: werkaSentArchiveInitial(now), activeDays: new Set(), activeMonths: new Set(),
      activeYears: new Set(), loading: true, error: null };
  }
  private current(): boolean {
    if (this.disposed) return false;
    const guard = this.deps.isCurrent, evaluate = this.deps.evaluateGuard;
    try {
      const result: unknown = evaluate(guard);
      if (result !== true) {
        if (result != null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
        return false;
      }
      return !this.disposed && this.deps.isCurrent === guard && this.deps.evaluateGuard === evaluate;
    } catch { return false; }
  }
  private snapshot(): WerkaSentArchiveFlowSnapshot {
    return { ...this.state, calendar: copyCalendar(this.state.calendar), activeDays: new Set(this.state.activeDays),
      activeMonths: new Set(this.state.activeMonths), activeYears: new Set(this.state.activeYears) };
  }
  getSnapshot(): WerkaSentArchiveFlowSnapshot | null { return this.current() ? this.snapshot() : null; }
  private publish(patch: Partial<WerkaSentArchiveFlowSnapshot>): boolean {
    if (!this.current()) return false;
    const onState = this.deps.onState;
    this.state = { ...this.state, ...patch };
    if (!this.current() || this.deps.onState !== onState) return false;
    onState(this.snapshot());
    return this.current() && this.deps.onState === onState;
  }
  private valid(panel: SentArchivePanel, generation: number, binding: Binding): boolean {
    return generation === this.generation[panel] && this.current()
      && this.deps.load === binding.load && this.deps.onState === binding.onState;
  }
  private async loadPanel(panel: SentArchivePanel, calendar = this.state.calendar,
    binding: Binding = { load: this.deps.load, onState: this.deps.onState }): Promise<void> {
    if (!this.current() || this.deps.load !== binding.load || this.deps.onState !== binding.onState) return;
    const generation = ++this.generation[panel], captured = copyCalendar(calendar);
    this.actionGeneration++;
    const query = werkaSentArchiveQueries(captured)[panels.indexOf(panel)];
    if (!this.publish({ calendar: captured, loading: true, error: null }) || !this.valid(panel, generation, binding)) return;
    try {
      const result = await binding.load(query);
      if (!this.valid(panel, generation, binding)) return;
      const labels = result.items.map(item => item.created_label);
      if (panel === 'daily') this.publish({ activeDays: werkaArchiveActiveDays(labels,
        captured.displayMonth.getFullYear(), captured.displayMonth.getMonth() + 1) });
      else if (panel === 'monthly') this.publish({ activeMonths: werkaArchiveActiveMonths(labels, captured.displayYear) });
      else this.publish({ activeYears: werkaArchiveActiveYears(labels, captured.firstYear) });
    } catch (error) {
      if (this.valid(panel, generation, binding)) this.publish({ error });
    } finally {
      // Source's three reads share one flag; each valid finally independently clears it.
      if (this.valid(panel, generation, binding)) this.publish({ loading: false });
    }
  }
  private async loadAll(): Promise<void> {
    if (!this.current()) return;
    const binding = { load: this.deps.load, onState: this.deps.onState };
    await Promise.all(panels.map(panel => this.loadPanel(panel, this.state.calendar, binding)));
  }
  async start(): Promise<void> {
    if (this.started || !this.current()) return;
    this.started = true;
    await this.loadAll();
  }
  async refresh(): Promise<void> {
    if (!this.started || !this.current()) return;
    await this.loadAll();
  }
  /** Call only for a real visible toggle. */
  toggle(panel: SentArchivePanel): void {
    if (!this.started || !this.current() || !panels.includes(panel)) return;
    this.actionGeneration++;
    this.publish({ calendar: { ...this.state.calendar, open: werkaSentArchiveToggle(this.state.calendar.open, panel) } });
  }
  /** Call only from a real displayed-month event, not a requested pager target. */
  async displayedMonthChanged(value: Date): Promise<void> {
    if (!this.started || !this.current() || this.state.calendar.open !== 'daily' || !Number.isFinite(value.getTime())) return;
    const next = werkaSentArchiveDisplayedMonth(this.state.calendar, value);
    if (next.query !== null) await this.loadPanel('daily', next.state);
  }
  /** Call only for a real enabled picker day; the owner must recheck before navigating. */
  selectDate(value: Date): WerkaArchiveQuery | null {
    if (!this.started || !this.current() || this.state.calendar.open !== 'daily' || !Number.isFinite(value.getTime())) return null;
    const load = this.deps.load, result = werkaSentArchiveSelectDate(this.state.calendar, value), action = ++this.actionGeneration;
    const published = this.publish({ calendar: result.state });
    return published && action === this.actionGeneration && this.current() && this.deps.load === load ? result.query : null;
  }
  /** Real panel page actions always apply to the latest page. */
  async step(panel: 'monthly' | 'yearly', step: -1 | 1): Promise<void> {
    if (!this.started || !this.current() || (panel !== 'monthly' && panel !== 'yearly')
      || this.state.calendar.open !== panel || (step !== -1 && step !== 1)) return;
    await this.loadPanel(panel, werkaSentArchivePageStep(this.state.calendar, panel, step).state);
  }
  /** Active and inactive source cells are both selectable; no route is opened here. */
  selectPeriod(panel: 'monthly' | 'yearly', value: number): WerkaArchiveQuery | null {
    if (!this.started || !this.current() || (panel !== 'monthly' && panel !== 'yearly')
      || this.state.calendar.open !== panel || !Number.isInteger(value)) return null;
    const calendar = this.state.calendar, load = this.deps.load, onState = this.deps.onState;
    if (panel === 'monthly' && (value < 1 || value > 12)) return null;
    if (panel === 'yearly' && (value < calendar.firstYear || value > calendar.firstYear + 11)) return null;
    const query = panel === 'monthly' ? werkaSentArchiveSelection(panel, calendar.displayYear, value)
      : werkaSentArchiveSelection(panel, value);
    return this.current() && this.state.calendar === calendar && this.deps.load === load && this.deps.onState === onState ? query : null;
  }
  dispose(): void {
    this.disposed = true; this.actionGeneration++;
    for (const panel of panels) this.generation[panel]++;
  }
}
