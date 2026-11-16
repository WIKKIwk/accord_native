import type { AdminReliableScannerSession } from './adminReliableScannerSession';
import type { AdminReliableScannerReporter } from './adminReliableScannerModel';

type Request = { session: AdminReliableScannerSession; complete: () => void };
/** @v2 ReliableScannerCoordinator
 * Resource cleanup is independent of account/read authority: a retired native driver still needs its own release. */
export class AdminReliableScannerCoordinator {
  private readonly sessions = new Set<AdminReliableScannerSession>(); private readonly requests: Request[] = [];
  private owner: AdminReliableScannerSession | null = null; private priority = 0; private draining = false;
  private idle: { promise: Promise<void>; complete: () => void } | null = null;
  constructor(private readonly reportError: AdminReliableScannerReporter) { if (typeof reportError !== 'function') throw TypeError('The actual scanner error reporter is required'); }
  get settled(): Promise<void> { return this.idle?.promise ?? Promise.resolve(); }
  reconcile(session: AdminReliableScannerSession, promote = false): Promise<void> {
    this.sessions.add(session); if (promote) session.coordinatorPriority = ++this.priority;
    let complete!: () => void; const completed = new Promise<void>(resolve => { complete = resolve; }); this.requests.push({ session, complete });
    if (!this.idle) { let finish!: () => void; const promise = new Promise<void>(resolve => { finish = resolve; }); this.idle = { promise, complete: finish }; }
    if (!this.draining) { this.draining = true; void this.drain(); } return completed;
  }
  private async drain(): Promise<void> {
    while (this.requests.length) {
      const batch = this.requests.splice(0);
      try { await this.reconcileNow(); }
      catch (error) {
        for (const request of batch) { try { request.session.recordCoordinatorError(error); } catch { /* Failed error observers cannot block later camera owners. */ } }
        try { const result: unknown = this.reportError(error, 'coordinator'); if (result && typeof (result as PromiseLike<unknown>).then === 'function') void Promise.resolve(result).catch(() => {}); } catch { /* Same best-effort reporter rule as Source. */ }
      }
      for (const request of batch) request.complete();
    }
    this.draining = false; const idle = this.idle; this.idle = null; idle?.complete();
  }
  private async reconcileNow(): Promise<void> {
    let desired: AdminReliableScannerSession | null = null;
    for (const session of this.sessions) if (session.shouldRun && (desired === null || session.coordinatorPriority > desired.coordinatorPriority)) desired = session;
    const previousOwner = this.owner;
    if (previousOwner !== null && previousOwner !== desired) { await previousOwner.stopDriver(); this.owner = null; }
    // Disposing an old controller while a newer controller owns the shared
    // platform can tear down the newer camera. Source defers it until idle.
    if (this.owner === null) {
      for (const session of [...this.sessions].filter(value => value.disposed)) { await session.disposeDriver(); this.sessions.delete(session); }
    }
    if (desired === null || desired.disposed) {
      for (const session of this.sessions) if (!session.disposed && session.phase !== 'error') session.setPhase('suspended'); return;
    }
    for (const session of this.sessions) if (session !== desired && !session.disposed && session.phase !== 'error') session.setPhase('suspended');
    this.owner = desired; const started = await desired.startDriver(desired.forceRestart); desired.forceRestart = false;
    if (!started && this.owner === desired) this.owner = null;
  }
}
