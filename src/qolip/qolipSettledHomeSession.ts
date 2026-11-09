import { captureSessionWitness, isSessionWitnessCurrent, loadSession, sessionWitnessTransitioning, sessionWitnessVersion,
  subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipHomeWitnessBoundary } from './qolipHomeWitnessBoundary';

type SharedWitness = SessionWitness;
type SharedBindings = {
  loadSession: typeof loadSession;
  captureSessionWitness: typeof captureSessionWitness;
  isSessionWitnessCurrent: typeof isSessionWitnessCurrent;
  subscribeSessionWitness: typeof subscribeSessionWitness;
  sessionWitnessVersion: typeof sessionWitnessVersion;
  sessionWitnessTransitioning: typeof sessionWitnessTransitioning;
};
function sharedBindings(): SharedBindings {
  return { loadSession, captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness,
    sessionWitnessVersion, sessionWitnessTransitioning };
}

export type QolipSettledHomeSession =
  | Readonly<{ kind: 'loading' | 'unavailable' | 'invalid' }>
  | Readonly<{ kind: 'ready'; session: Session; boundary: QolipHomeReadBoundary }>;
const loading: QolipSettledHomeSession = Object.freeze({ kind: 'loading' });
const unavailable: QolipSettledHomeSession = Object.freeze({ kind: 'unavailable' });
const invalid: QolipSettledHomeSession = Object.freeze({ kind: 'invalid' });
type Run = { active: boolean; subscribing: boolean; dirty: boolean; stop: (() => void) | null };
function absorbThenable(value: unknown) {
  try {
    if (value && (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as { then?: unknown }).then === 'function') void Promise.resolve(value).catch(() => {});
  } catch { /* A malformed callback result cannot authorize a shell. */ }
}

/** One shell lifetime. Once a witness is captured it is never replaced, even after a rollback. */
export class QolipSettledHomeSessionOwner {
  private readonly shared = sharedBindings();
  private readonly listeners = new Set<() => void>();
  private value: QolipSettledHomeSession = loading;
  private run: Run | null = null;
  private settled = false;
  private captured = false;
  private loadingSession = false;

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): QolipSettledHomeSession => {
    if (this.value.kind === 'ready') {
      // Also close the render/subscription gap and any suspended-effect gap without recapture.
      // Do not mutate the entry here: an earlier shared listener may read this snapshot
      // before our signal runs, which still must publish invalidation to React.
      if (!this.value.boundary.current()) return invalid;
      else if (!this.run?.active) return loading;
    }
    return this.value;
  };
  private notify() {
    for (const listener of [...this.listeners]) {
      try { const result: unknown = listener(); absorbThenable(result); } catch { /* Other listeners still invalidate. */ }
    }
  }
  private closeSubscription(run: Run) {
    const stop = run.stop; run.stop = null;
    try { const result: unknown = stop?.(); absorbThenable(result); } catch { /* A closed shell must remain closed. */ }
  }
  private finish(value: QolipSettledHomeSession) {
    this.settled = true; this.value = value;
    if (value.kind !== 'ready' && this.run) this.closeSubscription(this.run);
    this.notify();
  }
  private observation(): { transitioning: boolean; version: number } | null {
    try {
      const transitioning: unknown = this.shared?.sessionWitnessTransitioning();
      if (typeof transitioning !== 'boolean') { absorbThenable(transitioning); return null; }
      const version: unknown = this.shared?.sessionWitnessVersion();
      if (typeof version !== 'number' || !Number.isSafeInteger(version)) { absorbThenable(version); return null; }
      return { transitioning, version };
    } catch { return null; }
  }
  private current(run: Run) { return this.run === run && run.active; }
  private changed(run: Run, version: number): boolean | null {
    const observed = this.observation();
    return observed ? run.dirty || observed.transitioning || observed.version !== version : null;
  }
  private signal(run: Run) {
    if (!this.current(run)) return;
    if (this.value.kind === 'ready') {
      if (!this.value.boundary.current()) this.finish(invalid);
      return;
    }
    if (this.settled) return;
    run.dirty = true;
    if (!run.subscribing) this.attempt(run);
  }
  private attempt(run: Run) {
    if (!this.current(run) || this.settled || this.loadingSession || run.subscribing) return;
    if (this.captured) { this.finish(invalid); return; }
    const observed = this.observation();
    if (!observed) { this.finish(invalid); return; }
    if (observed.transitioning) { run.dirty = true; return; }
    run.dirty = false; this.loadingSession = true;
    void this.load(run, observed.version);
  }
  private async load(run: Run, version: number) {
    try {
      const session = await this.shared!.loadSession();
      if (!this.current(run) || this.settled) return;
      const changed = this.changed(run, version);
      if (changed === null) { this.finish(invalid); return; }
      if (changed) { run.dirty = true; return; }
      if (!session) { this.finish(invalid); return; }

      // A capture attempt ends bootstrap, even if it returns null, throws or races a transition.
      this.captured = true;
      const witness: unknown = this.shared!.captureSessionWitness(session);
      absorbThenable(witness);
      if (!this.current(run) || this.settled) {
        if (this.captured && !this.settled) this.finish(invalid);
        return;
      }
      const afterCapture = this.changed(run, version);
      if (afterCapture !== false || !witness || typeof witness !== 'object' ||
          (witness as SharedWitness).session !== session || typeof (witness as SharedWitness).scope !== 'string') {
        this.finish(invalid); return;
      }
      const boundary = qolipHomeWitnessBoundary(session, witness as SharedWitness, this.shared!);
      if (!boundary.current() || this.changed(run, version) !== false || !this.current(run)) { this.finish(invalid); return; }
      this.finish(Object.freeze({ kind: 'ready', session, boundary }));
    } catch {
      if (this.captured && !this.settled) this.finish(invalid);
      else if (this.current(run) && !this.settled) {
        const changed = this.changed(run, version);
        if (!this.captured && changed === true) run.dirty = true;
        else this.finish(invalid);
      }
    } finally {
      this.loadingSession = false;
      const active = this.run;
      if (active && this.current(active) && !this.settled && (active.dirty || active !== run)) this.attempt(active);
    }
  }

  /** Subscribe before observing transitions. Effect recreation keeps this same owner and witness. */
  activate(): () => void {
    if (this.run?.active) return () => {};
    const run: Run = { active: true, subscribing: true, dirty: false, stop: null };
    this.run = run;
    const suspend = () => {
      if (!this.current(run)) return;
      run.active = false; this.closeSubscription(run); this.notify();
    };
    if (!this.shared) { this.finish(unavailable); return suspend; }
    if (this.settled && this.value.kind !== 'ready') return suspend;
    let stop: unknown;
    try { stop = this.shared.subscribeSessionWitness(() => this.signal(run)); }
    catch { run.subscribing = false; this.finish(invalid); return suspend; }
    run.subscribing = false;
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') return cleanup(); }).catch(() => {});
      this.finish(invalid); return suspend;
    }
    run.stop = stop as () => void;
    if (!this.current(run) || (this.settled && this.value.kind !== 'ready')) this.closeSubscription(run);
    else if (this.value.kind === 'ready') {
      if (!this.value.boundary.current()) this.finish(invalid); else this.notify();
    } else this.attempt(run);
    return suspend;
  }
}
