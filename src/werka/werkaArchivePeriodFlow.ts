import type { WerkaArchiveKind, WerkaArchiveQuery, werkaArchiveResponseFromJson } from './werkaArchiveApi';
import { werkaArchiveActiveMonths, werkaArchiveActiveYears, werkaArchiveMonthRange, werkaArchiveYearRange } from './werkaArchiveCalendar';
import { werkaArchivePeriodInitial, werkaArchivePeriodQuery, werkaArchivePeriodStep,
  type WerkaArchivePeriodPage } from './werkaArchivePeriodPresentation';
import type { WerkaGuardEvaluator } from './werkaGuardTypes';

type ArchiveResponse = Pick<ReturnType<typeof werkaArchiveResponseFromJson>, 'items'>;
export type WerkaArchivePeriodFlowSnapshot = Readonly<{
  page: WerkaArchivePeriodPage;
  active: ReadonlySet<number>;
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
  onState: (snapshot: WerkaArchivePeriodFlowSnapshot) => void;
};

/** Unwired monthly/yearly flow; the owner must provide scope guards and safe navigation. */
export class WerkaArchivePeriodFlow {
  private state: WerkaArchivePeriodFlowSnapshot;
  private disposed = false;
  private started = false;
  private requestGeneration = 0;
  constructor(private readonly kind: WerkaArchiveKind, period: WerkaArchivePeriodPage['period'], now: Date,
    private readonly deps: Dependencies) {
    if (!Number.isFinite(now.getTime())) throw new RangeError();
    this.state = { page: werkaArchivePeriodInitial(period, now), active: new Set(), loading: true, error: null };
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
  private snapshot(): WerkaArchivePeriodFlowSnapshot {
    return { ...this.state, page: { ...this.state.page }, active: new Set(this.state.active) };
  }
  getSnapshot(): WerkaArchivePeriodFlowSnapshot | null { return this.current() ? this.snapshot() : null; }
  private publish(patch: Partial<WerkaArchivePeriodFlowSnapshot>): boolean {
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
  private async load(page: WerkaArchivePeriodPage): Promise<void> {
    if (!this.current()) return;
    const generation = ++this.requestGeneration, captured = { ...page }, query = werkaArchivePeriodQuery(this.kind, captured);
    const load = this.deps.load, onState = this.deps.onState;
    if (!this.publish({ page: captured, loading: true, error: null }) || !this.validRequest(generation, load, onState)) return;
    try {
      const result = await load(query);
      if (!this.validRequest(generation, load, onState)) return;
      const labels = result.items.map(item => item.created_label);
      const active = captured.period === 'monthly' ? werkaArchiveActiveMonths(labels, captured.year)
        : werkaArchiveActiveYears(labels, captured.firstYear);
      this.publish({ active });
    } catch (error) {
      if (this.validRequest(generation, load, onState)) this.publish({ error });
    } finally {
      if (this.validRequest(generation, load, onState)) this.publish({ loading: false });
    }
  }
  async start(): Promise<void> {
    if (this.started || !this.current()) return;
    this.started = true;
    await this.load(this.state.page);
  }
  async refresh(): Promise<void> {
    if (!this.started || !this.current()) return;
    await this.load(this.state.page);
  }
  /** Call only for a real visible page action; each action applies to the latest page. */
  async step(step: -1 | 1): Promise<void> {
    if (!this.started || !this.current() || (step !== -1 && step !== 1)) return;
    await this.load(werkaArchivePeriodStep(this.state.page, step));
  }
  /** Call only for a real visible cell. Active and inactive cells both return arguments without navigating. */
  select(value: number): WerkaArchiveQuery | null {
    if (!this.started || !this.current() || !Number.isInteger(value)) return null;
    const page = this.state.page, load = this.deps.load, onState = this.deps.onState;
    if (page.period === 'monthly' && (value < 1 || value > 12)) return null;
    if (page.period === 'yearly' && (value < page.firstYear || value > page.firstYear + 11)) return null;
    const range = page.period === 'monthly' ? werkaArchiveMonthRange(page.year, value) : werkaArchiveYearRange(value);
    return this.current() && this.state.page === page && this.deps.load === load && this.deps.onState === onState
      ? { kind: this.kind, period: page.period, ...range } : null;
  }
  dispose(): void { this.disposed = true; this.requestGeneration++; }
}
