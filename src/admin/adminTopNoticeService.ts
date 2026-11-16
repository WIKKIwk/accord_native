import { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import { adminTopNoticeDuration, captureAdminTopNoticeMessage, type AdminTopNoticeBanner, type AdminTopNoticeMessage } from './adminTopNoticeModel';

type Timer = ReturnType<typeof setTimeout>;
type Dependencies = Readonly<{ setTimer?: (callback: () => void, delay: number) => Timer; clearTimer?: (timer: Timer) => void }>;
/** @v2 _AdminTopNoticeHandle */
export class AdminTopNoticeHandle {
  readonly banner: AdminTopNoticeBanner;
  private timer: Timer | null = null; private closed = false; private readonly textMembers = new WeakMap<object, Set<object>>();
  constructor(private readonly service: AdminTopNoticeService, private readonly target: AdminTopNoticeMessenger, value: AdminTopNoticeMessage) {
    this.banner = Object.freeze({ ...value, identity: {}, attachText: this.attachText, abandon: this.abandon });
  }
  isClosed = () => this.closed;
  abandon = (): void => { if (this.closed) return; this.closed = true; if (this.timer !== null) this.service.clearTimer(this.timer); this.timer = null; this.service.forget(this); };
  close = (): void => { if (this.closed) return; this.abandon(); this.target.hideCurrent(); };
  private attachText = (identity: object): (() => void) => {
    if (!identity || typeof identity !== 'object') throw TypeError('Original native notice text identity is required');
    const members = this.textMembers.get(identity) ?? new Set<object>(), member = {}; this.textMembers.set(identity, members); members.add(member); let detached = false;
    return () => { if (detached) return; detached = true; members.delete(member);
      // Each genuine text instance owns Source dispose/abandon, even if another
      // root Scaffold still renders this banner. A replay lease is cancellation-only.
      queueMicrotask(() => { if (!members.size && this.textMembers.get(identity) === members) { this.textMembers.delete(identity); this.abandon(); } }); };
  };
  startTimer(): void {
    if (this.closed) return;
    this.timer = this.service.setTimer(() => { if (this.service.isLatest(this)) { this.service.forget(this); this.close(); } }, adminTopNoticeDuration);
  }
}
/** One latest handle across every genuine Admin Messenger target. Ordinary SnackBars are a different queue. */
export class AdminTopNoticeService {
  private latest: AdminTopNoticeHandle | null = null; private issuing = false;
  readonly setTimer: NonNullable<Dependencies['setTimer']>; readonly clearTimer: NonNullable<Dependencies['clearTimer']>;
  constructor(deps: Dependencies = {}) { this.setTimer = deps.setTimer ?? setTimeout; this.clearTimer = deps.clearTimer ?? clearTimeout; }
  isLatest = (handle: AdminTopNoticeHandle): boolean => this.latest === handle;
  forget(handle: AdminTopNoticeHandle): void { if (this.latest === handle) this.latest = null; }
  /** @v2 showAdminTopNotice */
  show(target: AdminTopNoticeMessenger, input: AdminTopNoticeMessage): AdminTopNoticeHandle | null {
    if (this.issuing) return null; this.issuing = true;
    try {
      if (!(target instanceof AdminTopNoticeMessenger) || !target.current()) return null;
      const value = captureAdminTopNoticeMessage(input); if (!value) return null;
      if (!target.current()) return null;
      const old = this.latest; this.latest = null; old?.close();
      if (!target.ready()) return null;
      target.hideCurrent(); if (!target.ready()) return null;
      const handle = new AdminTopNoticeHandle(this, target, value);
      if (!target.enqueue(handle.banner) || !target.current()) { handle.abandon(); return null; }
      this.latest = handle; handle.startTimer(); return handle;
    } finally { this.issuing = false; }
  }
  /** @v2 dismissAdminTopNotice */
  dismiss(): void { const handle = this.latest; this.latest = null; handle?.close(); }
}
