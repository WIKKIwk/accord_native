import type { WerkaArchiveQuery, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaArchiveListInitial, werkaArchiveListQuery, werkaArchiveListSelectDaily, werkaArchiveListToggleCalendar,
  type WerkaArchiveListState } from './werkaArchiveListState';
import type { WerkaGuardEvaluator } from './werkaGuardTypes';

type ArchiveResponse = ReturnType<typeof werkaArchiveResponseFromJson>;
export type WerkaArchiveListFlowSnapshot = Readonly<{
  filter: WerkaArchiveListState;
  data: ArchiveResponse | null;
  loading: boolean;
  error: unknown | null;
}>;
type Dependencies = {
  isCurrent: () => boolean;
  /** Required verified synchronous evaluator; this branch supplies no fallback. */
  evaluateGuard: WerkaGuardEvaluator;
  /** The real adapter must guard every send, retry, redirect and response decode. */
  load: (query: WerkaArchiveQuery) => Promise<ArchiveResponse>;
  onState: (snapshot: WerkaArchiveListFlowSnapshot) => void;
};
const copyDate = (value: Date | null) => value === null ? null : new Date(value.getTime());
const copyFilter = (value: WerkaArchiveListState): WerkaArchiveListState => ({ ...value,
  from: copyDate(value.from), to: copyDate(value.to) });
const copyData = (value: ArchiveResponse): ArchiveResponse => ({ ...value, from: copyDate(value.from), to: copyDate(value.to),
  summary: { ...value.summary, totalsByUOM: value.summary.totalsByUOM.map(total => ({ ...total })) },
  items: value.items.map(item => ({ ...item })) });

/** Unwired list read flow. It performs no PDF operation or navigation. */
export class WerkaArchiveListFlow {
  private state: WerkaArchiveListFlowSnapshot;
  private disposed = false;
  private started = false;
  private generation = 0;
  constructor(query: WerkaArchiveQuery, now: Date, private readonly deps: Dependencies) {
    if (!Number.isFinite(now.getTime())) throw new RangeError();
    this.state = { filter: werkaArchiveListInitial(query.kind, query.period, query.from ?? null, query.to ?? null, now),
      data: null, loading: true, error: null };
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
  private snapshot(): WerkaArchiveListFlowSnapshot {
    return { ...this.state, filter: copyFilter(this.state.filter), data: this.state.data === null ? null : copyData(this.state.data) };
  }
  getSnapshot(): WerkaArchiveListFlowSnapshot | null { return this.current() ? this.snapshot() : null; }
  private publish(patch: Partial<WerkaArchiveListFlowSnapshot>): boolean {
    if (!this.current()) return false;
    const onState = this.deps.onState;
    this.state = { ...this.state, ...patch };
    if (!this.current() || this.deps.onState !== onState) return false;
    onState(this.snapshot());
    return this.current() && this.deps.onState === onState;
  }
  private valid(generation: number, load: Dependencies['load'], onState: Dependencies['onState']): boolean {
    return generation === this.generation && this.current() && this.deps.load === load && this.deps.onState === onState;
  }
  private async load(filter: WerkaArchiveListState): Promise<void> {
    if (!this.current()) return;
    const generation = ++this.generation, captured = copyFilter(filter), query = werkaArchiveListQuery(captured);
    const load = this.deps.load, onState = this.deps.onState;
    if (!this.publish({ filter: captured, loading: true, error: null }) || !this.valid(generation, load, onState)) return;
    try {
      const result = await load(query);
      if (!this.valid(generation, load, onState)) return;
      const data = copyData(result);
      if (this.valid(generation, load, onState)) this.publish({ data });
    } catch (error) {
      if (this.valid(generation, load, onState)) this.publish({ error });
    } finally {
      if (this.valid(generation, load, onState)) this.publish({ loading: false });
    }
  }
  async start(): Promise<void> {
    if (this.started || !this.current()) return;
    this.started = true;
    await this.load(this.state.filter);
  }
  async refresh(): Promise<void> {
    if (!this.started || !this.current()) return;
    await this.load(this.state.filter);
  }
  /** Source exposes this action only in a visible daily-filter branch. */
  toggleCalendar(): void {
    if (!this.started || !this.current() || this.state.filter.period !== 'daily'
      || (this.state.data === null && (this.state.loading || this.state.error !== null))) return;
    this.publish({ filter: werkaArchiveListToggleCalendar(this.state.filter) });
  }
  /** Call only from a real enabled picker day; it closes the calendar and requests a scoped read. */
  async selectDaily(value: Date): Promise<void> {
    if (!this.started || !this.current() || this.state.filter.period !== 'daily' || !this.state.filter.calendarOpen
      || !Number.isFinite(value.getTime())) return;
    await this.load(werkaArchiveListSelectDaily(this.state.filter, value).state);
  }
  dispose(): void { this.disposed = true; this.generation++; }
}
