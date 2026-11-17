import { parseAdminOwnedSheetEvent, type AdminOwnedSheetAcceptedClose, type AdminOwnedSheetEvent } from '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import { isAdminRootSheetAuthority, type AdminRootSheetAuthority, type AdminRootSheetAuthorityStamp } from './AdminRootSheetAuthority';

export type AdminRootSheetCancellationLease = Readonly<{ identity: object; transaction: string }>;
export type AdminRootSheetLifecycleSnapshot = Readonly<{
  revision: number; shown: boolean; pendingTransaction: string | null; physicalDismissed: boolean;
  acceptedClose: AdminOwnedSheetAcceptedClose | null; boundTransaction: string | null;
  outcome: 'closed' | 'retired' | null; failed: boolean; nativeRetired: boolean; settling: boolean;
}>;
type Dependencies = Readonly<{
  presentationTicket: string; parentTicket: string; nativeIdentity: object;
  authority: AdminRootSheetAuthority;
  isAccountCurrent: () => boolean; isSourceCurrent: () => boolean; isNativeMember: () => boolean;
  isOriginalParentCurrent: () => boolean; hasNoDescendants: () => boolean;
  /** Actual Root reservation identity and the child's own original read authority. Never a fresh top selection. */
  isReservedDescendantCurrent: (originalTicket: object) => boolean;
  /** Only dispatches an original cancellation request. The adapter must separately accept its Source command. */
  onNativeCancel: (lease: AdminRootSheetCancellationLease) => unknown;
}>;
const ticket = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value)?.[0] === value;
type AuthorityFrame = Readonly<{ stamp: AdminRootSheetAuthorityStamp | null; memberRevision: object }>;
type ReceiveFrame = { valid: boolean; phase: 'validating' | 'applying' | 'dispatching' };
/** Production transaction policy only. Actual Root authority/cleanup producers and the owned renderer remain unconnected. */
export class AdminRootSheetLifecycle {
  private readonly original: Dependencies;
  private readonly account: () => boolean; private readonly source: () => boolean; private readonly native: () => boolean; private readonly parent: () => boolean; private readonly noChildren: () => boolean;
  private readonly reserved: (candidate: object) => boolean;
  private readonly members = new Set<object>(); private readonly leases = new Set<AdminRootSheetCancellationLease>(); private readonly usedTransactions = new Set<string>();
  private readonly listeners = new Set<() => void>(); private checking: { valid: boolean } | null = null;
  private receiving: ReceiveFrame | null = null;
  private dispatchLease: AdminRootSheetCancellationLease | null = null; private sequence = 0;
  private memberRevision: object = {};
  private settled = false;
  private stopAuthority: (() => void) | null = null;
  private state: AdminRootSheetLifecycleSnapshot = Object.freeze({ revision: 0, shown: false, pendingTransaction: null, physicalDismissed: false, acceptedClose: null, boundTransaction: null, outcome: null, failed: false, nativeRetired: false, settling: false });
  readonly closed: Promise<'closed' | 'retired'>; private resolve!: (value: 'closed' | 'retired') => void;
  constructor(deps: Dependencies) {
    const original = Object.freeze({ ...deps });
    if (!ticket(original.presentationTicket) || !ticket(original.parentTicket) || original.presentationTicket === original.parentTicket || !original.nativeIdentity || typeof original.nativeIdentity !== 'object' || Array.isArray(original.nativeIdentity) ||
      [original.isAccountCurrent, original.isSourceCurrent, original.isNativeMember, original.isOriginalParentCurrent, original.hasNoDescendants, original.isReservedDescendantCurrent, original.onNativeCancel].some(value => typeof value !== 'function') ||
      !isAdminRootSheetAuthority(original.authority, original)) throw TypeError('Original sheet subscribed authority, account, Source, native membership, parent and descendant facts are required');
    this.original = original; this.account = createProfileSessionGuard(original.isAccountCurrent); this.source = createProfileSessionGuard(original.isSourceCurrent);
    this.native = createProfileSessionGuard(original.isNativeMember); this.parent = createProfileSessionGuard(original.isOriginalParentCurrent); this.noChildren = createProfileSessionGuard(original.hasNoDescendants);
    const originalReserved = original.isReservedDescendantCurrent;
    let candidate: object | null = null; const readReserved = createProfileSessionGuard(() => candidate !== null && originalReserved(candidate));
    this.reserved = value => { const previous = candidate; candidate = value; try { return readReserved(); } finally { candidate = previous; } };
    this.closed = new Promise(resolve => { this.resolve = resolve; });
    this.stopAuthority = original.authority.subscribeRetirement(() => { this.retire(); });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminRootSheetLifecycleSnapshot>) { this.state = Object.freeze({ ...this.state, ...patch, revision: this.state.revision + 1 }); for (const listener of [...this.listeners]) { try { listener(); } catch {} } }
  attach = () => {
    if (this.state.outcome !== null) return () => {}; const member = {}; this.members.add(member); this.memberRevision = {}; let detached = false;
    return () => { if (detached) return; detached = true; this.members.delete(member); this.memberRevision = {}; queueMicrotask(() => { if (!this.members.size) this.retire(); }); };
  };
  private frame(): AuthorityFrame { return { stamp: this.original.authority.capture(), memberRevision: this.memberRevision }; }
  /** Passive only: no untrusted callback may follow the final comparison before an operation's decision. */
  private stable(frame: AuthorityFrame, mode: 'source' | 'all' = 'all'): boolean {
    return this.original.authority.matches(frame.stamp, mode) && (mode === 'source' || frame.memberRevision === this.memberRevision);
  }
  private current(source: boolean, authority = this.frame()): boolean {
    if (!this.stable(authority)) return false;
    if (!this.members.size || source && this.state.outcome !== null) return false;
    if (this.checking) { this.checking.valid = false; return false; }
    const frame = { valid: true }; this.checking = frame;
    let account = false, original = true, valid = false;
    try {
      account = this.account(); valid = account && this.native() && this.parent();
      if (source && valid) original = this.source();
      if (valid && original) {
        if (source) original = this.source() && original;
        account = this.account() && account; valid = original && account && this.native() && this.parent();
      }
      valid = valid && original;
    } finally { this.checking = null; }
    if (!account || source && !original) this.retire();
    return valid && frame.valid && this.members.size > 0 && (!source || this.state.outcome === null) && this.stable(authority);
  }
  readCurrent = () => this.current(true);
  canInteract = () => {
    if (this.receiving) return false;
    const frame = this.frame(); return this.current(true, frame) && this.state.shown && !this.state.pendingTransaction && !this.state.acceptedClose && !this.state.physicalDismissed && !this.state.failed && !this.state.nativeRetired && this.stable(frame);
  };
  canOpenNewDescendant = this.canInteract;
  /** An ALREADY accepted child must not be stranded by its ancestor's accepted Source close. */
  canPresentReservedDescendant = (originalTicket: object): boolean => {
    if (this.receiving) return false;
    const frame = this.frame();
    const presentable = () => this.state.shown && !this.state.pendingTransaction && !this.state.physicalDismissed && !this.state.failed && !this.state.nativeRetired;
    return !!originalTicket && typeof originalTicket === 'object' && !Array.isArray(originalTicket) && this.current(false, frame) && presentable() &&
      this.reserved(originalTicket) && this.current(false, frame) && this.reserved(originalTicket) && this.members.size > 0 && presentable() && this.stable(frame);
  };
  isCancellationCurrent = (lease: AdminRootSheetCancellationLease): boolean => {
    if (this.receiving && !this.receiving.valid) return false;
    const frame = this.frame();
    if (!this.leases.has(lease) || this.state.pendingTransaction !== lease.transaction || !this.state.physicalDismissed || this.state.acceptedClose) return false;
    return this.current(true, frame) && this.leases.has(lease) && this.state.pendingTransaction === lease.transaction && this.state.physicalDismissed && this.state.acceptedClose === null && this.stable(frame);
  };
  /** Explicit Source acceptance, never inferred from a gesture or callback return. A programmatic intent keeps transaction:null forever. */
  requestClose(lease?: AdminRootSheetCancellationLease): boolean {
    if (this.receiving && (!this.receiving.valid || this.receiving.phase !== 'dispatching' || lease !== this.dispatchLease)) { this.receiving.valid = false; return false; }
    const frame = this.frame();
    if (!this.current(true, frame) || lease !== undefined && !this.isCancellationCurrent(lease)) return false;
    if (this.state.acceptedClose) return lease === undefined && this.stable(frame);
    const closeTicket = createAdminPresentationWindowTicket();
    if (!ticket(closeTicket) || [this.original.presentationTicket, this.original.parentTicket].includes(closeTicket) || this.usedTransactions.has(closeTicket) || !this.current(true, frame) || lease !== undefined && !this.isCancellationCurrent(lease) || !this.stable(frame)) return false;
    const acceptedClose = Object.freeze({ presentationTicket: this.original.presentationTicket, closeTicket, transaction: lease?.transaction ?? null });
    this.leases.clear(); this.publish({ acceptedClose }); return this.state.acceptedClose === acceptedClose && this.members.size > 0 && this.state.outcome === null && this.stable(frame);
  }
  /** Includes queued descendants. Removing an ancestor early would strand their genuine native presentation. */
  acceptedCloseIntent(): AdminOwnedSheetAcceptedClose | null {
    const frame = this.frame(), original = this.state.acceptedClose;
    if (!original || !this.current(true, frame) || !this.noChildren() || !this.current(true, frame) || !this.noChildren() || !this.members.size || this.state.outcome !== null || this.state.acceptedClose !== original || !this.stable(frame)) return null;
    return original;
  }
  receive(identity: object, raw: unknown): boolean {
    if (this.receiving) { this.receiving.valid = false; return false; }
    const receiving: ReceiveFrame = { valid: true, phase: 'validating' }; this.receiving = receiving; const frame = this.frame();
    try {
      if (identity !== this.original.nativeIdentity || !this.current(false, frame) || !receiving.valid || !this.stable(frame)) return false;
      const event = parseAdminOwnedSheetEvent(raw, this.original);
      if (!event || event.sequence <= this.sequence || !receiving.valid || !this.current(false, frame) || !this.stable(frame)) return false;
      this.sequence = event.sequence; receiving.phase = 'applying'; const accepted = this.apply(event, frame);
      if (!receiving.valid) { this.retire(true); return false; } return accepted;
    } finally { this.receiving = null; }
  }
  private apply(event: AdminOwnedSheetEvent, authority: AuthorityFrame): boolean {
    const before = this.state, transaction = event.transaction;
    if (before.failed || before.nativeRetired || before.outcome === 'closed') return false;
    if (event.kind === 'layout' || event.kind === 'attempt') return true;
    if (event.kind === 'failed') { this.retire(true); return true; }
    if (event.kind === 'retired') { this.publish({ nativeRetired: true }); this.retire(); return true; }
    if (event.kind === 'shown') {
      if (before.shown || before.physicalDismissed || before.pendingTransaction && !before.acceptedClose) return false;
      if (event.acceptedClose !== null && event.acceptedClose !== before.acceptedClose?.closeTicket) return false;
      if (transaction !== null && transaction !== before.boundTransaction) return false;
      this.publish({ shown: true }); return true;
    }
    if (event.kind === 'willDismiss') {
      if (!before.shown || before.physicalDismissed || before.pendingTransaction || before.acceptedClose || !transaction || this.usedTransactions.has(transaction)) return false;
      this.usedTransactions.add(transaction); this.leases.clear(); this.publish({ pendingTransaction: transaction }); return true;
    }
    if (event.kind === 'cancelled') {
      if (!transaction || before.pendingTransaction !== transaction || before.physicalDismissed || before.boundTransaction !== null) return false;
      this.leases.clear(); this.publish({ pendingTransaction: null }); return true;
    }
    if (event.kind === 'closeAccepted') {
      if (!before.acceptedClose || event.acceptedClose !== before.acceptedClose.closeTicket || !transaction || before.boundTransaction && before.boundTransaction !== transaction ||
        before.acceptedClose.transaction !== null && before.acceptedClose.transaction !== transaction || before.pendingTransaction && before.pendingTransaction !== transaction) return false;
      this.usedTransactions.add(transaction); this.publish({ boundTransaction: transaction, pendingTransaction: transaction }); return true;
    }
    if (event.kind === 'didDismiss') {
      if (!before.shown || before.physicalDismissed || !transaction || before.pendingTransaction && before.pendingTransaction !== transaction ||
        before.boundTransaction && before.boundTransaction !== transaction || event.acceptedClose !== null && event.acceptedClose !== before.acceptedClose?.closeTicket) return false;
      if (!before.pendingTransaction && this.usedTransactions.has(transaction)) return false;
      this.usedTransactions.add(transaction); this.publish({ physicalDismissed: true, pendingTransaction: transaction });
      if (this.state.outcome === null && !this.state.acceptedClose && this.current(true)) this.dispatchCancellation(transaction);
      return true;
    }
    if (event.kind === 'closeJoined') {
      if (!before.acceptedClose || !before.physicalDismissed || !transaction || transaction !== before.boundTransaction || transaction !== before.pendingTransaction || event.acceptedClose !== before.acceptedClose.closeTicket ||
        !this.current(true, authority) || !this.noChildren() || !this.current(true, authority) || !this.noChildren() || !this.members.size || this.state.outcome !== null || !this.stable(authority)) return false;
      this.leases.clear(); this.publish({ settling: true });
      // The genuine native proof was consumed above. Closing publication may remove its original body/anchor.
      // It must not adopt a new Source owner or account, nor turn retirement into a successful result.
      if (!this.completionCurrent(before.acceptedClose, transaction, authority)) { this.retire(); return true; }
      // Final Source/account linearization precedes notification. No observer can act on a provisional closed result.
      this.settled = true; this.stopAuthority?.(); this.stopAuthority = null; this.resolve('closed'); this.publish({ outcome: 'closed', settling: false }); return true;
    }
    return false;
  }
  private dispatchCancellation(transaction: string) {
    if (!this.receiving?.valid || this.receiving.phase !== 'applying') return;
    const lease = Object.freeze({ identity: Object.freeze({}), transaction }); this.leases.add(lease);
    if (!this.isCancellationCurrent(lease)) return;
    const receiving = this.receiving; receiving.phase = 'dispatching'; this.dispatchLease = lease;
    try {
      const result = this.original.onNativeCancel(lease);
      if (result !== null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
    } catch { /* A Source callback failure is not acceptance or native completion. */ }
    finally { this.dispatchLease = null; receiving.phase = 'applying'; }
    if (!this.current(true)) this.leases.delete(lease);
  }
  private completionCurrent(accepted: AdminOwnedSheetAcceptedClose, transaction: string, authority: AuthorityFrame): boolean {
    if (this.settled || this.state.outcome !== null || !this.state.settling || this.checking) return false;
    const frame = { valid: true }; this.checking = frame;
    let valid = false;
    try { valid = this.noChildren() && this.account() && this.source() && this.account(); }
    finally { this.checking = null; }
    return valid && frame.valid && !this.settled && this.receiving?.valid === true && this.state.outcome === null && this.state.settling && this.state.acceptedClose === accepted && this.state.boundTransaction === transaction && this.state.physicalDismissed && this.stable(authority, 'source');
  }
  retire(failed = false) {
    if (this.settled) { if (failed && !this.state.failed) this.publish({ failed: true }); return; }
    this.settled = true; this.stopAuthority?.(); this.stopAuthority = null; this.leases.clear(); this.publish({ outcome: 'retired', failed, settling: false }); this.resolve('retired');
  }
}
