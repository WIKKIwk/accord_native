import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminTopNoticeBanner, AdminTopNoticeScaffold, AdminTopNoticeTransition } from './adminTopNoticeModel';

export type AdminTopNoticeMessengerSnapshot = Readonly<{
  revision: number; retired: boolean; accessibleNavigation: boolean | null;
  banners: readonly AdminTopNoticeBanner[]; head: AdminTopNoticeBanner | null;
  phase: 'idle' | 'entering' | 'visible' | 'exiting'; transition: AdminTopNoticeTransition | null;
}>;
type Scaffold = { identity: object; ancestor: AdminTopNoticeScaffold | null; members: Set<object> };
type Dependencies = Readonly<{ isCurrent: () => boolean; subscribeCurrent?: (listener: () => void) => (() => void) }>;
const object = (value: unknown): value is object => value !== null && typeof value === 'object';

/** One genuine Source ScaffoldMessenger target. Source route Scaffolds are siblings even when native carriers nest. */
export class AdminTopNoticeMessenger {
  private readonly deps: Dependencies; private checking = false; private editing = false;
  private driver: { identity: object; members: Set<object> } | null = null; private unsubscribe: (() => void) | null = null;
  private readonly scaffolds = new Map<AdminTopNoticeScaffold, Scaffold>(); private readonly listeners = new Set<() => void>();
  private state: AdminTopNoticeMessengerSnapshot = Object.freeze({ revision: 0, retired: false, accessibleNavigation: null,
    banners: Object.freeze([]), head: null, phase: 'idle', transition: null });
  constructor(deps: Dependencies) {
    if (!deps || typeof deps.isCurrent !== 'function' || deps.subscribeCurrent !== undefined && typeof deps.subscribeCurrent !== 'function') throw TypeError('Original Messenger account authority is required');
    this.deps = Object.freeze({ isCurrent: deps.isCurrent, subscribeCurrent: deps.subscribeCurrent });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminTopNoticeMessengerSnapshot> = {}) {
    this.state = Object.freeze({ ...this.state, ...patch, revision: this.state.revision + 1 });
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* A render observer cannot establish notice authority. */ } }
  }
  current = (): boolean => {
    if (this.state.retired) return false; if (this.checking) { this.retire(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.state.retired) { this.retire(); return false; } return true;
  };
  private driverCurrent(identity: object) { return this.current() && this.driver?.identity === identity && this.driver.members.size > 0; }
  /** Exact original mounted coordinator lease, never inferred from its React context or a readiness boolean. */
  hasDriverLease = (identity: object): boolean => this.driverCurrent(identity);
  /** Must be the actual single mounted coordinator; React registration is not an animation completion. */
  attachDriver(identity: object, accessibleNavigation: boolean): (() => void) | null {
    if (!object(identity) || typeof accessibleNavigation !== 'boolean' || !this.current() || this.driver && this.driver.identity !== identity) return null;
    const driver = this.driver ??= { identity, members: new Set() }, member = {}; driver.members.add(member);
    if (!this.unsubscribe && this.deps.subscribeCurrent) {
      try {
        const unsubscribe = this.deps.subscribeCurrent(() => { this.current(); });
        if (typeof unsubscribe !== 'function') throw TypeError('Messenger authority subscription requires cleanup');
        if (this.state.retired) { unsubscribe(); return null; } this.unsubscribe = unsubscribe;
      } catch { this.retire(); return null; }
    }
    this.publish({ accessibleNavigation }); let detached = false;
    return () => { if (detached) return; detached = true; driver.members.delete(member);
      // StrictMode reconnect may retain this exact coordinator. This is resource
      // retirement only, never a substitute for native animation completion.
      queueMicrotask(() => { if (!driver.members.size && this.driver === driver) this.retire(); }); };
  }
  setAccessibleNavigation(identity: object, value: boolean): void {
    if (typeof value === 'boolean' && this.driverCurrent(identity) && value !== this.state.accessibleNavigation) this.publish({ accessibleNavigation: value });
  }
  /** Explicit logical Source ancestry is required. Never infer it from React/native Modal nesting. */
  createScaffold(identity: object, ancestor: AdminTopNoticeScaffold | null): AdminTopNoticeScaffold | null {
    if (!object(identity) || ancestor !== null && !object(ancestor) || !this.current()) return null;
    if ([...this.scaffolds.values()].some(value => value.identity === identity)) return null;
    const ticket = Object.freeze({}) as AdminTopNoticeScaffold; this.scaffolds.set(ticket, { identity, ancestor, members: new Set() }); return ticket;
  }
  attachScaffold(ticket: AdminTopNoticeScaffold): (() => void) | null {
    const scaffold = this.scaffolds.get(ticket); if (!scaffold || !this.current()) return null;
    const member = {}; scaffold.members.add(member); this.publish(); let detached = false;
    return () => { if (detached) return; detached = true; scaffold.members.delete(member);
      queueMicrotask(() => { if (!scaffold.members.size && this.scaffolds.get(ticket) === scaffold) { this.scaffolds.delete(ticket); if (!this.state.retired) this.publish(); } }); };
  }
  isRootScaffold(ticket: AdminTopNoticeScaffold): boolean {
    const value = this.scaffolds.get(ticket); return !!value && value.members.size > 0 && (value.ancestor === null || !this.scaffolds.get(value.ancestor)?.members.size);
  }
  ready = (): boolean => this.current() && !!this.driver?.members.size && this.state.accessibleNavigation !== null && [...this.scaffolds.keys()].some(ticket => this.isRootScaffold(ticket));
  bannerFor(ticket: AdminTopNoticeScaffold): AdminTopNoticeBanner | null { return this.current() && this.isRootScaffold(ticket) ? this.state.head : null; }
  private transition(banner: AdminTopNoticeBanner, target: 0 | 1, reset: boolean): AdminTopNoticeTransition { return Object.freeze({ identity: {}, banner, target, reset }); }
  /** Called only by the global service after resolving/fixing the message. Like Flutter this enqueues; it does not replace the visible head. */
  enqueue(banner: AdminTopNoticeBanner): boolean {
    if (this.editing || !this.ready() || !object(banner?.identity) || typeof banner.attachText !== 'function' || typeof banner.abandon !== 'function') return false;
    this.editing = true;
    try {
      const banners = Object.freeze([...this.state.banners, banner]);
      this.publish({ banners, ...(this.state.head ? {} : { head: banner, phase: 'entering' as const, transition: this.transition(banner, 1, true) }) });
      return this.current() && this.state.banners.includes(banner);
    } finally { this.editing = false; }
  }
  /** Source handle.close hides CURRENT Messenger head, even when the handle itself is queued. */
  hideCurrent(): void {
    if (this.editing || !this.current() || !this.state.head) return; this.editing = true;
    try {
      if (this.state.accessibleNavigation === true) this.removeHead();
      else this.publish({ phase: 'exiting', transition: this.transition(this.state.head, 0, false) });
    } finally { this.editing = false; }
  }
  /** Source semantics dismissal removes immediately. Retained native callbacks cannot remove a newer banner. */
  removeCurrent(expected: AdminTopNoticeBanner): void {
    if (this.editing || !this.current() || this.state.head !== expected) return; this.editing = true;
    try { this.removeHead(); } finally { this.editing = false; }
  }
  private removeHead() {
    const banners = Object.freeze(this.state.banners.slice(1)), head = banners[0] ?? null;
    this.publish({ banners, head, phase: head ? 'entering' : 'idle', transition: head ? this.transition(head, 1, true) : null });
  }
  /** Only the original driver's real finished callback can settle this transition. No duration timer acknowledgment exists. */
  completeTransition(identity: object, transition: AdminTopNoticeTransition): boolean {
    if (this.editing || !object(transition) || !this.driverCurrent(identity) || this.state.transition !== transition || this.state.head !== transition.banner) return false;
    this.editing = true;
    try { if (transition.target === 0) this.removeHead(); else this.publish({ phase: 'visible', transition: null }); return this.current(); }
    finally { this.editing = false; }
  }
  retire = (): void => {
    if (this.state.retired) return; const banners = this.state.banners, unsubscribe = this.unsubscribe; this.unsubscribe = null;
    this.state = Object.freeze({ ...this.state, retired: true, accessibleNavigation: null, banners: Object.freeze([]), head: null, phase: 'idle', transition: null });
    try { unsubscribe?.(); } catch {} this.scaffolds.clear(); this.publish();
    for (const banner of banners) { try { banner.abandon(); } catch {} }
  };
}
