import type { ReactElement } from 'react';
import type { ModalProps } from 'react-native';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import type { AdminRootSheetRequest } from './AdminRootSheetTypes';

export type AdminRootPresentationParent = Readonly<{ id: string; kind: 'root' | 'page' | 'dialog' | 'sheet' }>;
export type AdminRootPresentationEntry = AdminRootPresentationParent & Readonly<{ kind: 'page' | 'dialog' | 'sheet' }>;
export type AdminRootPresentationRenderState = Readonly<{
  interactive: boolean; retained: boolean; retired: boolean;
  /** Live original guards for queued native events/reads; snapshot booleans only describe this render. */
  canInteract: () => boolean; isCurrent: () => boolean;
}>;
/** The supplied callback must put outlet INSIDE this actual native presentation's content. */
export type AdminRootPresentationContent = (outlet: ReactElement, state: AdminRootPresentationRenderState) => ReactElement;
export type AdminRootPresentationOptions = Readonly<{
  transparent: boolean; animationType: NonNullable<ModalProps['animationType']>;
  presentationStyle: 'fullScreen' | 'overFullScreen'; statusBarTranslucent?: boolean; navigationBarTranslucent?: boolean;
}>;
type AdminRootModalRequest = Readonly<{
  parent: AdminRootPresentationParent; identity: object; kind: 'page' | 'dialog';
  renderContent: AdminRootPresentationContent; presentation: AdminRootPresentationOptions;
  /** Original owner/account authority, independent of the presentation parent's page focus. */
  isCurrent: () => boolean; onRequestClose: () => void;
}>;
export type AdminRootPresentationRequest = AdminRootModalRequest | AdminRootSheetRequest;
export type AdminRootPresentationSnapshot = Readonly<{
  revision: number; retired: boolean; rootReady: boolean; entries: readonly AdminRootPresentationEntry[];
  /** Actual retained resources, including retired Source owners. Never a native readiness/absence receipt. */
  resources: readonly AdminRootPresentationEntry[]; rootResource: 'pending' | 'cancelledBeforeCarrier' | 'removed';
}>;
type Native = { identity: object; members: Set<object>; shown: boolean; armed: boolean; failed: boolean; removal: object | null };
type Entry = { value: AdminRootPresentationEntry; request: AdminRootModalRequest; native: Native | null;
  closing: boolean; resourceRetiring: boolean; retired: boolean; settled: boolean; checking: boolean; resolve: (result: 'closed' | 'retired') => void };
type Dependencies = Readonly<{ platform: 'android' | 'ios'; rootIdentity: object; isCurrent: () => boolean;
  subscribeCurrent?: (listener: () => void) => (() => void) }>;
const object = (value: unknown): value is object => !!value && typeof value === 'object' && !Array.isArray(value);
export function captureAdminRootPresentationOptions(value: AdminRootPresentationOptions): AdminRootPresentationOptions | null {
  try {
    if (!object(value) || typeof value.transparent !== 'boolean' || !['none', 'slide', 'fade'].includes(value.animationType) ||
      !['fullScreen', 'overFullScreen'].includes(value.presentationStyle) ||
      value.statusBarTranslucent !== undefined && typeof value.statusBarTranslucent !== 'boolean' ||
      value.navigationBarTranslucent !== undefined && typeof value.navigationBarTranslucent !== 'boolean') return null;
    return Object.freeze({ transparent: value.transparent, animationType: value.animationType, presentationStyle: value.presentationStyle,
      ...(value.statusBarTranslucent === undefined ? {} : { statusBarTranslucent: value.statusBarTranslucent }),
      ...(value.navigationBarTranslucent === undefined ? {} : { navigationBarTranslucent: value.navigationBarTranslucent }) });
  } catch { return null; }
}

/** Ordered presentation ownership. Membership is never native readiness; only the real carrier events establish it. */
export class AdminRootPresentationChain {
  readonly root: AdminRootPresentationParent; readonly platform: 'android' | 'ios';
  private readonly deps: Dependencies; private rootNative: Native | null = null;
  private readonly records = new Map<AdminRootPresentationEntry, Entry>(); private order: AdminRootPresentationEntry[] = [];
  private readonly identities = new WeakSet<object>();
  private readonly outcomes = new WeakMap<object, 'closed' | 'retired'>();
  private state: AdminRootPresentationSnapshot = Object.freeze({ revision: 0, retired: false, rootReady: false, entries: Object.freeze([]), resources: Object.freeze([]), rootResource: 'pending' });
  private readonly listeners = new Set<() => void>(); private checking = false; private issuing = false;
  private readonly sourceListeners = new Set<() => void>(); private readonly resourceListeners = new Set<() => void>();
  private sourceRevision: object = {}; private resourceRevision: object = {};
  private removing = false;
  private unsubscribe: (() => void) | null = null;
  constructor(deps: Dependencies) {
    const { rootIdentity, platform, isCurrent, subscribeCurrent } = deps;
    if (!object(rootIdentity) || !['android', 'ios'].includes(platform) || typeof isCurrent !== 'function' ||
      subscribeCurrent !== undefined && typeof subscribeCurrent !== 'function') throw TypeError('Original Root authority is required');
    this.deps = Object.freeze({ rootIdentity, platform, isCurrent, subscribeCurrent }); this.platform = platform;
    this.root = Object.freeze({ id: createAdminPresentationWindowTicket(), kind: 'root' });
  }
  getSnapshot = () => this.state;
  acceptsRootIdentity = (identity: object): boolean => identity === this.deps.rootIdentity;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeSource = (listener: () => void) => { this.sourceListeners.add(listener); return () => { this.sourceListeners.delete(listener); }; };
  subscribeResource = (listener: () => void) => { this.resourceListeners.add(listener); return () => { this.resourceListeners.delete(listener); }; };
  sourceStamp = () => this.sourceRevision;
  resourceStamp = () => this.resourceRevision;
  private publish(kind: 'source' | 'resource' | 'both' = 'source') {
    if (kind !== 'resource') this.sourceRevision = {};
    if (kind !== 'source') this.resourceRevision = {};
    this.state = Object.freeze({ revision: this.state.revision + 1, retired: this.state.retired,
      rootReady: !this.state.retired && this.ready(this.rootNative), entries: Object.freeze(this.state.retired ? [] : [...this.order]),
      resources: Object.freeze([...this.order]), rootResource: this.state.rootResource });
    const callbacks = [...(kind !== 'resource' ? this.sourceListeners : []), ...(kind !== 'source' ? this.resourceListeners : []), ...this.listeners];
    for (const listener of callbacks) { try { listener(); } catch { /* Observers cannot establish native authority. */ } }
  }
  private ready(native: Native | null) { return !!native && native.members.size > 0 && !native.failed && !native.removal && native.shown && (this.platform === 'ios' || native.armed); }
  current = (): boolean => {
    if (this.state.retired) return false;
    if (this.checking) { this.retire(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.state.retired) { this.retire(); return false; } return true;
  };
  /** Exact opaque current top, including queued accepted requests. Never substitute its owner for the originating authority. */
  top = (): AdminRootPresentationParent | null => this.current() ? this.order[this.order.length - 1] ?? this.root : null;
  private record(value: unknown): Entry | null { return object(value) ? this.records.get(value as AdminRootPresentationEntry) ?? null : null; }
  private entryCurrent(entry: Entry): boolean {
    if (!this.current() || entry.retired || this.records.get(entry.value) !== entry) return false;
    if (entry.checking) { this.retireEntry(entry); return false; } entry.checking = true;
    const valid = isSynchronouslyTrue(entry.request.isCurrent); entry.checking = false;
    if (!valid || !this.current() || this.records.get(entry.value) !== entry || entry.retired) { this.retireEntry(entry); return false; } return true;
  }
  isCurrent = (value: AdminRootPresentationParent): boolean => value === this.root ? this.current() : !!this.record(value) && this.entryCurrent(this.record(value)!);
  /** A real originating owner must cancel its exact entry on actual unmount; focus loss is not cancellation. */
  cancel(value: AdminRootPresentationEntry): boolean {
    const entry = this.record(value); if (!entry || entry.retired || !this.current()) return false; this.retireEntry(entry); return true;
  }
  refreshAuthority = (): boolean => {
    if (!this.current()) return false;
    for (const entry of [...this.records.values()]) if (!entry.retired) this.entryCurrent(entry);
    return this.current();
  };
  /** Native shell/resource authority survives source-owner retirement only to remove its original window. */
  nativeCurrent = (value: AdminRootPresentationParent): boolean => this.state.rootResource === 'pending' &&
    (value === this.root ? !this.state.retired || this.rootNative !== null : this.record(value) !== null);
  isRetired = (value: AdminRootPresentationParent): boolean => this.state.retired || (value !== this.root && this.record(value)?.retired !== false);
  private retireEntry(entry: Entry) {
    if (entry.retired || this.records.get(entry.value) !== entry) return;
    entry.retired = true; entry.resourceRetiring = true; this.settle(entry, 'retired');
    if (!entry.native) {
      // No actual native carrier existed for this suffix. Cancellation is not a native-close success.
      const index = this.order.indexOf(entry.value), suffix = this.order.splice(index);
      for (const value of suffix) { const pending = this.records.get(value)!; this.records.delete(value); pending.retired = true; this.settle(pending, 'retired'); }
    }
    this.publish('both');
  }
  private settle(entry: Entry, result: 'closed' | 'retired'): boolean {
    if (entry.settled) return false; entry.settled = true; this.outcomes.set(entry.value, result); entry.resolve(result); return true;
  }
  /** Passive Source result only; neither a render lease nor native/resource authority. */
  sourceOutcome = (value: AdminRootPresentationEntry): 'closed' | 'retired' | null => this.outcomes.get(value) ?? null;
  private native(value: AdminRootPresentationParent): Native | null { return value === this.root ? this.rootNative : this.record(value)?.native ?? null; }
  hasNativeLease = (value: AdminRootPresentationParent, identity: object): boolean => {
    if (!this.nativeCurrent(value)) return false; const native = this.native(value);
    return !!native && object(identity) && native.identity === identity && native.members.size > 0;
  };
  /** Receipt ownership only, including after the final React member leaves. No readiness or command authority. */
  hasNativeResource = (value: AdminRootPresentationParent, identity: object): boolean => {
    const native = this.native(value); return object(identity) && this.nativeCurrent(value) && !!native && native.identity === identity;
  };
  hasNativeRemovalProof = (value: AdminRootPresentationParent, identity: object): boolean => this.hasNativeResource(value, identity) && this.native(value)?.removal != null;
  private originalNative(value: AdminRootPresentationParent, identity: object): Native | null {
    if (!this.nativeCurrent(value)) return null; const native = this.native(value);
    return native?.identity === identity ? native : null;
  }
  private descendants(entry: Entry) { return this.order.indexOf(entry.value) < this.order.length - 1; }
  canInteract = (value: AdminRootPresentationParent): boolean => {
    if (!this.isCurrent(value) || this.top() !== value || !this.ready(this.rootNative) || !this.ready(this.native(value)) ||
      this.order.some(item => !this.ready(this.record(item)?.native ?? null))) return false;
    return value === this.root || this.record(value)?.closing === false;
  };
  /** Acceptance is immediate and ordered. Native presentation waits for the exact parent receipt. */
  open(request: AdminRootPresentationRequest): Readonly<{ entry: AdminRootPresentationEntry; closed: Promise<'closed' | 'retired'> }> | null {
    if (this.issuing) return null; this.issuing = true;
    try {
      // Native show/dismiss capability is not a mounted original-cleanup receipt or a real Root sheet renderer.
      // No current adapter can admit this kind. Hold before reading callbacks, allocating IDs, or publishing.
      if (request.kind === 'sheet') return null;
      const parent = request.parent, identity = request.identity, kind = request.kind, renderContent = request.renderContent,
        isCurrent = request.isCurrent, onRequestClose = request.onRequestClose, presentation = captureAdminRootPresentationOptions(request.presentation);
      if (!object(identity) || !['page', 'dialog'].includes(kind) || typeof renderContent !== 'function' || typeof isCurrent !== 'function' || typeof onRequestClose !== 'function' || !presentation ||
        this.identities.has(identity) || !this.current() || !this.ready(this.rootNative) || this.top() !== parent || !this.isCurrent(parent) || this.order.some(value => this.records.get(value)!.closing || this.records.get(value)!.resourceRetiring) ||
        !isSynchronouslyTrue(isCurrent) || !this.current() || !this.isCurrent(parent) || !this.current() || !this.ready(this.rootNative) || this.top() !== parent || this.order.some(value => this.records.get(value)!.closing || this.records.get(value)!.resourceRetiring)) return null;
      const captured = Object.freeze({ parent, identity, kind, renderContent, isCurrent, onRequestClose, presentation });
      const value = Object.freeze({ id: createAdminPresentationWindowTicket(), kind }); let resolve!: Entry['resolve'];
      const closed = new Promise<'closed' | 'retired'>(complete => { resolve = complete; });
      this.identities.add(identity);
      this.records.set(value, { value, request: captured, native: null, closing: false, resourceRetiring: false, retired: false, settled: false, checking: false, resolve }); this.order.push(value); this.publish('both');
      return Object.freeze({ entry: value, closed });
    } catch { return null; } finally { this.issuing = false; }
  }
  content(value: AdminRootPresentationEntry): AdminRootPresentationContent | null { const entry = this.record(value); return entry && this.nativeCurrent(value) ? entry.request.renderContent : null; }
  presentation(value: AdminRootPresentationEntry): AdminRootPresentationOptions | null { const entry = this.record(value); return entry && this.nativeCurrent(value) ? entry.request.presentation : null; }
  child(parent: AdminRootPresentationParent): AdminRootPresentationEntry | null {
    if (!this.nativeCurrent(parent)) return null;
    const index = parent === this.root ? -1 : this.order.indexOf(parent as AdminRootPresentationEntry), value = this.order[index + 1];
    return value && this.records.get(value)?.request.parent === parent ? value : null;
  }
  canPresent(value: AdminRootPresentationEntry): boolean {
    const entry = this.record(value); if (!entry || !this.nativeCurrent(value)) return false;
    // A real carrier already exists, including a pending presentation. Source retirement cannot unmount it.
    return entry.native !== null || this.entryCurrent(entry) && this.ready(this.rootNative) && this.ready(this.native(entry.request.parent));
  }
  requestClose(value: AdminRootPresentationEntry): boolean {
    const entry = this.record(value); if (!entry || !this.entryCurrent(entry) || entry.closing) return false;
    entry.closing = true; this.publish(); return this.records.get(value) === entry && !this.state.retired;
  }
  retained(value: AdminRootPresentationEntry): boolean { const entry = this.record(value); return !!entry && (entry.closing || entry.resourceRetiring) && this.descendants(entry); }
  shouldRemove(value: AdminRootPresentationParent): boolean {
    if (value === this.root) return this.state.retired && this.nativeCurrent(value) && !this.order.length && this.ready(this.rootNative);
    const entry = this.record(value); return !!entry && this.nativeCurrent(value) && (entry.closing || entry.resourceRetiring) && !this.descendants(entry) && this.ready(entry.native);
  }
  /** Called by real mounted carriers only. Lease identity stays original through StrictMode reconnect. */
  attachNative(value: AdminRootPresentationParent, identity: object, rootIdentity?: object): (() => void) | null {
    if (!object(identity) || !this.nativeCurrent(value) || value === this.root && rootIdentity !== this.deps.rootIdentity ||
      this.state.retired && this.native(value) === null ||
      value !== this.root && !this.record(value)?.native && !this.canPresent(value as AdminRootPresentationEntry)) return null;
    let native = this.native(value);
    if (native && native.identity !== identity) return null;
    if (!native) {
      native = { identity, members: new Set(), shown: false, armed: false, failed: false, removal: null };
      if (value === this.root) this.rootNative = native; else this.record(value)!.native = native;
    }
    const original = native, member = {}; native.members.add(member);
    if (value === this.root && !this.unsubscribe && this.deps.subscribeCurrent) {
      try {
        const unsubscribe = this.deps.subscribeCurrent(() => { this.refreshAuthority(); });
        if (typeof unsubscribe !== 'function') throw TypeError('Original authority subscription requires cleanup');
        if (this.state.retired) { unsubscribe(); return null; } this.unsubscribe = unsubscribe;
      }
      catch { this.retire(); return null; }
    }
    this.publish('resource');
    let detached = false;
    return () => {
      if (detached) return; detached = true; original.members.delete(member); this.publish('resource');
      // Resource retirement only. This is never a normal-close acknowledgment.
      queueMicrotask(() => { if (!original.members.size && this.native(value) === original && this.nativeCurrent(value)) this.retire(); });
    };
  }
  nativeShown(value: AdminRootPresentationParent, identity: object): boolean {
    const native = this.originalNative(value, identity); if (!native) return false;
    if (native.failed || native.removal) return false; native.shown = true; this.publish('resource'); return this.originalNative(value, identity) === native;
  }
  nativeArmed(value: AdminRootPresentationParent, identity: object): boolean {
    const native = this.originalNative(value, identity); if (!native || this.platform !== 'android') return false;
    if (native.failed || native.removal) return false; native.armed = true; this.publish('resource'); return this.originalNative(value, identity) === native;
  }
  nativeFailed(value: AdminRootPresentationParent, identity: object): void {
    const native = this.originalNative(value, identity); if (!native) return; native.failed = true; this.publish('resource');
  }
  nativeRequestClose(value: AdminRootPresentationEntry, identity: object): void {
    const entry = this.record(value); if (!entry || !this.originalNative(value, identity) || !this.canInteract(value)) return;
    try { void Promise.resolve(entry.request.onRequestClose()).catch(() => {}); } catch { /* Source callback failure never becomes native removal. */ }
  }
  nativeRemoved(value: AdminRootPresentationParent, identity: object): boolean { return this.removeNative(value, identity, false); }
  /** Only an actual original carrier/observer callback may call this. Resource loss never accepts a Source close. */
  nativeResourceRemoved(value: AdminRootPresentationParent, identity: object): boolean { return this.removeNative(value, identity, true); }
  private removeNative(value: AdminRootPresentationParent, identity: object, resourceProof: boolean): boolean {
    if (this.removing) return false; this.removing = true;
    try { return this.commitNativeRemoval(value, identity, resourceProof); }
    finally { this.removing = false; }
  }
  private commitNativeRemoval(value: AdminRootPresentationParent, identity: object, resourceProof: boolean): boolean {
    const native = this.originalNative(value, identity);
    if (!native || native.removal) return false;
    const entry = value === this.root ? null : this.record(value), hasChildren = value === this.root ? this.order.length > 0 : !!entry && this.descendants(entry);
    if (value !== this.root && !entry || !resourceProof && (!native.shown || this.platform === 'android' && !native.armed || hasChildren ||
      (value === this.root ? !this.state.retired : !(entry!.resourceRetiring || entry!.closing && !native.failed)))) return false;
    // This private receipt exists ONLY because the original platform callback above supplied actual proof.
    // It is retained while real descendants remain, never reconstructed from absence or a later hide request.
    native.removal = Object.freeze({});
    if (value === this.root) { native.failed = true; this.retire(); }
    else if (hasChildren) { native.failed = true; this.retireSourceSubtree(entry!); }
    else if (resourceProof && (!entry!.closing || native.failed || !native.shown || this.platform === 'android' && !native.armed)) this.retireEntry(entry!);
    this.publish('resource'); this.drainNativeProofs(); return true;
  }
  private retireSourceSubtree(entry: Entry) {
    const index = this.order.indexOf(entry.value);
    for (const value of this.order.slice(index)) { const child = this.records.get(value)!; child.retired = true; child.resourceRetiring = true; this.settle(child, 'retired'); }
    // Atomic cancellation of never-carrier admissions is not a physical removal receipt.
    while (this.order.length > index && this.records.get(this.order[this.order.length - 1])?.native === null) this.records.delete(this.order.pop()!);
    this.publish('both');
  }
  private drainNativeProofs() {
    // The caller holds the removal frame. Only retained ACTUAL receipts can release the postorder suffix.
    while (this.order.length) {
      const value = this.order[this.order.length - 1], entry = this.records.get(value)!;
      if (!entry.native?.removal) break;
      this.order.pop(); this.records.delete(value); this.publish('both');
      const valid = !entry.retired && !entry.native.failed && entry.closing && this.current() && isSynchronouslyTrue(entry.request.isCurrent) && this.current();
      // Source outcome is linearized before its notification. Retirement loops publish only after their complete state change.
      if (this.settle(entry, valid ? 'closed' : 'retired')) this.publish('source');
    }
    if (!this.order.length && this.rootNative?.removal && this.state.rootResource === 'pending') {
      this.state = Object.freeze({ ...this.state, rootResource: 'removed' }); this.rootNative = null; this.publish('resource');
    }
  }
  retire = (): void => {
    if (this.state.retired) return; const entries = [...this.records.values()];
    for (const entry of entries) { entry.retired = true; entry.resourceRetiring = true; this.settle(entry, 'retired'); }
    // Cancel only requests that never acquired a carrier; delayed layout attachment now cannot reclaim them.
    while (this.order.length && this.records.get(this.order[this.order.length - 1])?.native === null) this.records.delete(this.order.pop()!);
    this.state = Object.freeze({ ...this.state, retired: true, rootReady: false, entries: Object.freeze([]), rootResource: this.rootNative === null ? 'cancelledBeforeCarrier' : this.state.rootResource });
    const unsubscribe = this.unsubscribe; this.unsubscribe = null; try { unsubscribe?.(); } catch {}
    this.publish('both');
  };
}
