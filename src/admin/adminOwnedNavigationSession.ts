import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminOwnedRoutes } from './adminOwnedRoutes';
import { AdminOwnedRootRemoval } from './adminOwnedRemoval';
import { adminShellMayEnter } from './adminShellAccess';

type Dependencies = { session: Session; witness: SessionWitness; isCurrent: () => boolean; sourceReady: () => boolean; push: (id: string) => void };
type Snapshot = Readonly<{ active: boolean; generation: number }>;
/** A single original shell admission owns private route arguments, native completion and root removal permits. */
export class AdminOwnedNavigationSession {
  readonly registry: AdminOwnedRoutes; readonly rootRemoval: AdminOwnedRootRemoval;
  private readonly epoch: number | null; private readonly scope: string; private retired = false; private checking = false; private planning = false;
  private state: Snapshot = Object.freeze({ active: false, generation: 0 }); private readonly listeners = new Set<() => void>();
  private readonly deps: Readonly<Dependencies>;
  constructor(deps: Dependencies) {
    this.deps = Object.freeze({ ...deps });
    this.epoch = activeSessionEpoch(deps.session); this.scope = sessionReadScope(deps.session);
    this.registry = new AdminOwnedRoutes({ isCurrent: () => this.current(), canOpen: route => this.ready() && canOpenRoute(this.deps.session, route), push: this.deps.push });
    this.rootRemoval = new AdminOwnedRootRemoval(() => this.current());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of [...this.listeners]) { try { listener(); } catch { /* Keep original pending route settlement independent from observers. */ } } }
  private publish(active: boolean) { this.state = Object.freeze({ active, generation: this.state.generation + 1 }); this.emit(); }
  private original(): boolean {
    if (this.retired || this.checking) { this.retired = true; return false; } this.checking = true;
    try {
      const { session, witness } = this.deps;
      const valid = () => this.epoch !== null && activeSessionEpoch(session) === this.epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === this.scope && adminShellMayEnter(session);
      if (!valid() || !isSynchronouslyTrue(this.deps.isCurrent) || !valid() || this.retired) this.retired = true;
      return !this.retired;
    } catch { this.retired = true; return false; } finally { this.checking = false; }
  }
  current = (generation = this.state.generation): boolean => this.state.active && generation === this.state.generation && this.original() && this.state.active && generation === this.state.generation;
  ready = (): boolean => {
    if (this.planning) { this.invalidate(); return false; } this.planning = true;
    try { return this.current() && isSynchronouslyTrue(this.deps.sourceReady) && this.current(); } finally { this.planning = false; }
  };
  activate() {
    if (this.state.active || this.retired || !this.original()) return;
    this.state = Object.freeze({ active: true, generation: this.state.generation + 1 }); this.registry.start();
    if (!this.current()) { this.registry.dispose(); return; } this.emit();
  }
  detach() { this.publish(false); this.rootRemoval.clear(); this.registry.dispose(); }
  invalidate() { if (!this.retired) this.retired = true; this.detach(); this.registry.invalidate(); }
}
