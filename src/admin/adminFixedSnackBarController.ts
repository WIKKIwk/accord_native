import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';
import { adminFixedSnackBarDisplayDuration, type AdminFixedSnackBarEntry, type AdminFixedSnackBarHost, type AdminFixedSnackBarNotice, type AdminFixedSnackBarTransition } from './adminFixedSnackBarModel';
import { adminFixedSnackBarGeometry, type AdminFixedSnackBarGeometry, type AdminFixedSnackBarNativePair } from './adminFixedSnackBarGeometry';

type Timer = ReturnType<typeof setTimeout>;
type Host = { identity: object; scaffold: AdminTopNoticeScaffold; current: () => boolean; canInteract: () => boolean; members: Set<object>; expired: boolean; checking: boolean; geometry: AdminFixedSnackBarGeometry | null; window: object | null };
export type AdminFixedSnackBarSnapshot = Readonly<{ revision: number; retired: boolean; accessibleNavigation: boolean | null; entries: readonly AdminFixedSnackBarEntry[];
  head: AdminFixedSnackBarEntry | null; phase: 'idle' | 'entering' | 'visible' | 'exiting'; transition: AdminFixedSnackBarTransition | null; hostsReady: boolean }>;
type Dependencies = Readonly<{ messenger: AdminTopNoticeMessenger; setTimer?: (callback: () => void, delay: number) => Timer; clearTimer?: (timer: Timer) => void }>;
const object = (value: unknown): value is object => value !== null && typeof value === 'object';

/** Separate ordinary FIFO on the SAME genuine Source Messenger; no TopNotice latest-handle/abandon semantics. */
export class AdminFixedSnackBarController {
  readonly messenger: AdminTopNoticeMessenger;
  private readonly setTimer: NonNullable<Dependencies['setTimer']>; private readonly clearTimer: NonNullable<Dependencies['clearTimer']>;
  private driver: { identity: object; members: Set<object> } | null = null; private unsubscribe: (() => void) | null = null; private timer: { handle: Timer | null } | null = null;
  private checking = false; private editing = false; private readonly hosts = new Map<AdminFixedSnackBarHost, Host>(); private readonly listeners = new Set<() => void>();
  private state: AdminFixedSnackBarSnapshot = Object.freeze({ revision: 0, retired: false, accessibleNavigation: null, entries: Object.freeze([]), head: null, phase: 'idle', transition: null, hostsReady: false });
  constructor(deps: Dependencies) { this.messenger = deps.messenger; this.setTimer = deps.setTimer ?? setTimeout; this.clearTimer = deps.clearTimer ?? clearTimeout; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminFixedSnackBarSnapshot> = {}) {
    this.state = Object.freeze({ ...this.state, ...patch, revision: this.state.revision + 1 });
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* Render observers cannot acknowledge native animation or gestures. */ } }
  }
  current = (): boolean => {
    if (this.state.retired) return false; if (this.checking) { this.retire(); return false; } this.checking = true;
    let valid = false; try { valid = this.messenger.current(); } catch {} this.checking = false;
    if (!valid || this.state.retired) { this.retire(); return false; } return true;
  };
  hasDriverLease = (identity: object): boolean => object(identity) && this.current() && this.driver !== null && this.driver.identity === identity && this.driver.members.size > 0;
  /** Structural root connection is distinct from each Source Scaffold's actual paired geometry. */
  connected = (): boolean => this.current() && !!this.driver?.members.size;
  attachDriver(identity: object): (() => void) | null {
    if (!object(identity) || !this.current() || this.driver && this.driver.identity !== identity) return null;
    const driver = this.driver ??= { identity, members: new Set() }, member = {}; driver.members.add(member);
    if (!this.unsubscribe) this.unsubscribe = this.messenger.subscribe(() => {
      if (!this.current()) return;
      this.publish({ accessibleNavigation: this.messenger.getSnapshot().accessibleNavigation, hostsReady: this.usableHosts() });
    });
    this.publish({ accessibleNavigation: this.messenger.getSnapshot().accessibleNavigation, hostsReady: this.usableHosts() }); let detached = false;
    return () => { if (detached) return; detached = true; driver.members.delete(member);
      queueMicrotask(() => { if (this.driver === driver && !driver.members.size) this.retire(); }); };
  }
  createHost(options: Readonly<{ identity: object; scaffold: AdminTopNoticeScaffold; isCurrent: () => boolean; canInteract: () => boolean }>): AdminFixedSnackBarHost | null {
    if (!object(options?.identity) || !object(options.scaffold) || typeof options.isCurrent !== 'function' || typeof options.canInteract !== 'function' || !this.current() ||
      [...this.hosts.values()].some(value => value.identity === options.identity)) return null;
    const ticket = Object.freeze({}) as AdminFixedSnackBarHost; this.hosts.set(ticket, { identity: options.identity, scaffold: options.scaffold, current: options.isCurrent, canInteract: options.canInteract, members: new Set(), expired: false, checking: false, geometry: null, window: null }); return ticket;
  }
  attachHost(ticket: AdminFixedSnackBarHost): (() => void) | null {
    const host = this.hosts.get(ticket); if (!host || !this.current() || host.expired) return null; const member = {}; host.members.add(member); this.refreshHosts(); let detached = false;
    return () => { if (detached) return; detached = true; host.members.delete(member);
      queueMicrotask(() => { if (this.hosts.get(ticket) === host && !host.members.size) { this.hosts.delete(ticket); if (!this.state.retired) this.refreshHosts(); } }); };
  }
  private hostCurrent(host: Host): boolean {
    if (!this.current() || host.expired || !host.members.size) return false;
    if (host.checking) { host.expired = true; host.geometry = null; return false; } host.checking = true;
    const valid = isSynchronouslyTrue(host.current); host.checking = false;
    if (!valid || !this.current() || host.expired || !host.members.size) { host.expired = true; host.geometry = null; return false; } return true;
  }
  private usableHosts(): boolean { return !this.state.retired && [...this.hosts.values()].some(host => this.hostCurrent(host) && this.messenger.isRootScaffold(host.scaffold) && host.geometry !== null); }
  hasUsableHosts = (): boolean => this.current() && this.usableHosts();
  private refreshHosts() { if (!this.state.retired) this.publish({ hostsReady: this.usableHosts() }); }
  setGeometry(ticket: AdminFixedSnackBarHost, pair: AdminFixedSnackBarNativePair | null): boolean {
    const host = this.hosts.get(ticket); if (!host || !this.hostCurrent(host)) return false;
    const geometry = adminFixedSnackBarGeometry(pair);
    if (geometry && host.window !== null && host.window !== geometry.windowIdentity) { host.expired = true; host.geometry = null; this.refreshHosts(); return false; }
    host.geometry = geometry; if (geometry) host.window = geometry.windowIdentity; this.refreshHosts(); return host.geometry !== null && this.hostCurrent(host);
  }
  geometryFor(ticket: AdminFixedSnackBarHost): AdminFixedSnackBarGeometry | null {
    const host = this.hosts.get(ticket); return host && this.hostCurrent(host) && this.messenger.isRootScaffold(host.scaffold) ? host.geometry : null;
  }
  entryFor(ticket: AdminFixedSnackBarHost): AdminFixedSnackBarEntry | null { return this.geometryFor(ticket) ? this.state.head : null; }
  canInteract(ticket: AdminFixedSnackBarHost, entry: AdminFixedSnackBarEntry): boolean {
    const host = this.hosts.get(ticket), geometry = this.geometryFor(ticket); return !!host && geometry !== null && this.state.head === entry && isSynchronouslyTrue(host.canInteract) && this.hostCurrent(host) && this.state.head === entry && this.geometryFor(ticket) === geometry;
  }
  private transition(entry: AdminFixedSnackBarEntry, target: 0 | 1, reset: boolean): AdminFixedSnackBarTransition { return Object.freeze({ identity: {}, entry, target, reset }); }
  enqueue(input: AdminFixedSnackBarNotice): AdminFixedSnackBarEntry | null {
    if (this.editing || !this.connected() || !this.messenger.ready()) return null; this.editing = true;
    try {
      const { identity, message } = input; if (!object(identity) || typeof message !== 'string' || !this.current() || !this.messenger.ready()) return null;
      const entry = Object.freeze({ identity: {}, sourceIdentity: identity, message }), entries = Object.freeze([...this.state.entries, entry]);
      this.publish({ entries, ...(this.state.head ? {} : { head: entry, phase: 'entering' as const, transition: this.transition(entry, 1, true) }) });
      return this.current() && this.state.entries.includes(entry) ? entry : null;
    } catch { return null; } finally { this.editing = false; }
  }
  private cancelTimer() { const timer = this.timer; this.timer = null; if (timer?.handle != null) this.clearTimer(timer.handle); }
  /** Source Messenger starts4s in its build AFTER the entry controller completes, independent of originating page focus. */
  startDisplayTimer(identity: object, entry: AdminFixedSnackBarEntry): boolean {
    if (!this.hasDriverLease(identity) || this.state.head !== entry || this.state.phase !== 'visible' || this.timer !== null) return false;
    const timer = { handle: null as Timer | null }; this.timer = timer;
    timer.handle = this.setTimer(() => { if (this.timer !== timer) return; this.timer = null; if (this.current() && this.state.head === entry && this.state.phase === 'visible') this.hide(entry); }, adminFixedSnackBarDisplayDuration);
    if (this.timer !== timer) this.clearTimer(timer.handle); return true;
  }
  hide(expected: AdminFixedSnackBarEntry): void {
    if (this.editing || !this.current() || this.state.head !== expected) return; this.editing = true;
    try { this.cancelTimer(); if (this.state.accessibleNavigation === true) this.removeHead(); else this.publish({ phase: 'exiting', transition: this.transition(expected, 0, false) }); }
    finally { this.editing = false; }
  }
  /** Source semantic/swipe dismiss removes immediately; native swipe must finish its own movement first. */
  remove(expected: AdminFixedSnackBarEntry): void {
    if (this.editing || !this.current() || this.state.head !== expected) return; this.editing = true;
    try { this.cancelTimer(); this.removeHead(); } finally { this.editing = false; }
  }
  private removeHead() {
    const entries = Object.freeze(this.state.entries.slice(1)), head = entries[0] ?? null;
    this.publish({ entries, head, phase: head ? 'entering' : 'idle', transition: head ? this.transition(head, 1, true) : null });
  }
  completeTransition(identity: object, transition: AdminFixedSnackBarTransition): boolean {
    if (this.editing || !object(transition) || !this.hasDriverLease(identity) || this.state.transition !== transition || this.state.head !== transition.entry || transition.target === 1 && !this.hasUsableHosts()) return false;
    this.editing = true;
    try { if (transition.target === 0) this.removeHead(); else this.publish({ phase: 'visible', transition: null }); return this.current(); }
    finally { this.editing = false; }
  }
  retire = (): void => {
    if (this.state.retired) return; this.cancelTimer(); const stop = this.unsubscribe; this.unsubscribe = null;
    this.state = Object.freeze({ ...this.state, retired: true, accessibleNavigation: null, entries: Object.freeze([]), head: null, phase: 'idle', transition: null, hostsReady: false });
    this.hosts.clear(); try { stop?.(); } catch {} this.publish();
  };
}
