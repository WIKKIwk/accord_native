import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminPresentationWindowDetached, AdminPresentationWindowObserver, AdminPresentationWindowReceipt } from './adminPresentationWindow';

export type AdminPresentationWindowOwnerOptions = Readonly<{
  /** One stable identity and never-reused nativeID ticket for one actual native window. */
  identity: object; observer: AdminPresentationWindowObserver; ticket: string;
  /** Original account + mounted lifetime + exact dialog ID/generation; independent of page focus. */
  isCurrent: () => boolean;
  /** Live original accepted-close authority. May include actual native sheet-hide acknowledgment. */
  isClosing: () => boolean;
  onDetached: () => void;
}>;
export type AdminPresentationWindowOwnerState = Readonly<{ present: boolean; phase: 'presented' | 'arming' | 'armed' | 'removing' | 'detached' | 'failed' | 'retired' }>;

/** Retains React presentation until real arm ACK, then completes only its original native root event. */
export class AdminPresentationWindowOwner {
  private readonly options: AdminPresentationWindowOwnerOptions;
  private state: AdminPresentationWindowOwnerState = Object.freeze({ present: true, phase: 'presented' });
  private readonly listeners = new Set<() => void>(); private readonly members = new Set<object>();
  private retired = false; private checking = false; private acceptedClose = false; private armPending = false; private started = false;
  private receipt: AdminPresentationWindowReceipt | null = null; private observed = false;
  constructor(options: AdminPresentationWindowOwnerOptions) {
    if (!options.identity || typeof options.identity !== 'object' || typeof options.ticket !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(options.ticket) ||
      !options.observer || ['arm', 'waitForDetach', 'cancelPending', 'cancel'].some(key => typeof options.observer[key as keyof AdminPresentationWindowObserver] !== 'function') ||
      [options.isCurrent, options.isClosing, options.onDetached].some(value => typeof value !== 'function')) throw TypeError('A native window requires its original observer, identity and authority');
    this.options = Object.freeze({ ...options });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: AdminPresentationWindowOwnerState) {
    this.state = Object.freeze(state); for (const listener of [...this.listeners]) { try { listener(); } catch { /* One observer cannot authorize or interrupt native completion. */ } }
  }
  attach = () => {
    if (this.retired) return () => {}; const member = {}; this.members.add(member); let detached = false;
    return () => {
      if (detached) return; detached = true; this.members.delete(member);
      // Resource cancellation only. StrictMode replay reattaches before this job; it never completes a dialog.
      queueMicrotask(() => { if (!this.members.size) this.retire(); });
    };
  };
  checkCurrent = () => {
    if (this.retired || !this.members.size) return false;
    if (this.checking) { this.retire(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.options.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.retire(); return false; } return this.members.size > 0;
  };
  private closing() {
    if (!this.checkCurrent()) return false;
    if (this.checking) { this.retire(); return false; } this.checking = true;
    const result = isSynchronouslyTrue(this.options.isClosing); this.checking = false;
    return result && this.checkCurrent();
  }
  private cancelReceipt(receipt: AdminPresentationWindowReceipt) {
    try { void this.options.observer.cancel(receipt).catch(() => {}); } catch { /* Cancellation never becomes completion. */ }
  }
  retire = () => {
    if (this.retired) return; this.retired = true; const receipt = this.receipt; this.receipt = null;
    if (receipt) this.cancelReceipt(receipt);
    else if (this.armPending) { try { void this.options.observer.cancelPending(this.options.ticket).catch(() => {}); } catch {} }
    this.publish({ present: false, phase: 'retired' });
  };
  markerTag = (viewTag: number) => {
    if (!this.checkCurrent() || this.started || !Number.isInteger(viewTag) || viewTag <= 0 || viewTag > 2_147_483_647) return;
    this.started = true; this.armPending = true; this.publish({ present: true, phase: 'arming' });
    if (!this.checkCurrent()) return;
    let pending: Promise<AdminPresentationWindowReceipt>;
    try { pending = this.options.observer.arm(viewTag, this.options.ticket); }
    catch { this.armPending = false; this.failed(); return; }
    void pending.then(receipt => {
      this.armPending = false;
      if (!this.checkCurrent()) { this.cancelReceipt(receipt); return; }
      if (receipt.ticket !== this.options.ticket || receipt.viewTag !== viewTag || receipt.state !== 'armed') { this.failed(); return; }
      this.receipt = receipt; this.publish({ present: true, phase: 'armed' });
      if (!this.checkCurrent() || this.receipt !== receipt) return;
      this.watch(receipt);
      if (this.acceptedClose) this.remove();
    }, () => { this.armPending = false; this.failed(); }).catch(() => { this.failed(); });
  };
  private failed() { if (!this.retired && this.state.phase !== 'detached') this.publish({ present: this.state.present, phase: 'failed' }); }
  requestClose = () => {
    if (!this.closing() || this.state.phase === 'failed' || this.state.phase === 'detached') return;
    this.acceptedClose = true; this.remove();
  };
  private remove() {
    if (!this.acceptedClose || !this.receipt || !this.observed || this.state.phase !== 'armed' || !this.closing()) return;
    this.publish({ present: false, phase: 'removing' });
    if (!this.closing()) this.retire();
  }
  private watch(receipt: AdminPresentationWindowReceipt) {
    if (this.observed) return; this.observed = true;
    let pending: Promise<AdminPresentationWindowDetached>;
    try { pending = this.options.observer.waitForDetach(receipt); }
    catch { this.failed(); return; }
    void pending.then(proof => {
      if (this.receipt !== receipt) return; this.receipt = null;
      if (!this.checkCurrent()) return;
      if (proof.handle !== receipt.handle || proof.ticket !== receipt.ticket || proof.viewTag !== receipt.viewTag || proof.state !== 'detached' || proof.guarantee !== receipt.guarantee ||
        !this.acceptedClose || this.state.phase !== 'removing' || !this.closing()) {
        // An unexpected native root loss cannot acknowledge a later close or retarget a new window.
        this.cancelReceipt(receipt); this.publish({ present: false, phase: 'failed' }); return;
      }
      this.publish({ present: false, phase: 'detached' });
      if (this.closing()) { try { void Promise.resolve(this.options.onDetached()).catch(() => {}); } catch {} }
    }, () => { if (this.receipt === receipt) { this.receipt = null; this.cancelReceipt(receipt); } this.failed(); }).catch(() => { this.failed(); });
  }
}
