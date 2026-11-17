import type { AdminRootPresentationChain, AdminRootPresentationParent } from './adminRootPresentationChain';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export type AdminRootNativeParentOriginal = Readonly<{ chain: AdminRootPresentationChain; parent: AdminRootPresentationParent; nativeIdentity: object }>;
export type AdminRootNativeParentBinding = Readonly<{
  identity: object; chain: AdminRootPresentationChain; parent: AdminRootPresentationParent;
  marker: Readonly<{ tag: number; nativeID: string }>;
  /** Original mounted native resource only. This is neither Source read/command authority nor a shown receipt. */
  isCurrent: () => boolean;
  /** Separate original Source/account read authority; expected focus loss does not replace it. */
  sourceCurrent: () => boolean;
}>;

/** One actual outlet ancestor and its existing native lease. A sibling marker cannot supply this binding. */
export class AdminRootNativeParentOwner {
  private readonly original: AdminRootNativeParentOriginal;
  private readonly members = new Set<object>(); private readonly listeners = new Set<() => void>();
  private retired = false; private checking = false; private revision = 0;
  private resourceRevision: object = {};
  private view: object | null = null; private binding: AdminRootNativeParentBinding | null = null;
  constructor(original: AdminRootNativeParentOriginal) {
    if (!original.chain || !original.parent || typeof original.parent.id !== 'string' || !original.nativeIdentity || typeof original.nativeIdentity !== 'object' ||
      typeof original.chain.hasNativeLease !== 'function' || typeof original.chain.isCurrent !== 'function') throw TypeError('The original Root parent and existing native lease are required');
    this.original = Object.freeze({ ...original });
  }
  matches = (value: AdminRootNativeParentOriginal) => value.chain === this.original.chain && value.parent === this.original.parent && value.nativeIdentity === this.original.nativeIdentity;
  commit(value: AdminRootNativeParentOriginal) { if (!this.matches(value)) this.retire(); }
  getSnapshot = () => this.revision;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeResource = this.subscribe;
  resourceStamp = () => this.resourceRevision;
  private publish() { this.resourceRevision = {}; this.revision++; for (const listener of [...this.listeners]) { try { listener(); } catch {} } }
  attach = () => {
    if (this.retired) return () => {}; const member = {}; this.members.add(member); this.publish(); let detached = false;
    return () => {
      if (detached) return; detached = true; this.members.delete(member); this.publish();
      // Strict replay may restore the SAME original resource before this cleanup. This never acknowledges a window.
      queueMicrotask(() => { if (!this.members.size) this.retire(); });
    };
  };
  private current = (): boolean => {
    if (this.retired || !this.members.size) return false;
    if (this.checking) { this.retire(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(() => this.original.chain.hasNativeLease(this.original.parent, this.original.nativeIdentity) &&
      !this.original.chain.hasNativeRemovalProof(this.original.parent, this.original.nativeIdentity)); this.checking = false;
    return valid && !this.retired && this.members.size > 0;
  };
  capture(view: object | null, tag: number | null): boolean {
    if (!view || !Number.isInteger(tag) || tag === null || tag <= 0 || tag > 0x7fffffff || !this.current()) return false;
    if (this.binding) {
      if (this.view !== view || this.binding.marker.tag !== tag) { this.retire(); return false; }
      return this.current();
    }
    const marker = Object.freeze({ tag, nativeID: this.original.parent.id }); this.view = view;
    this.binding = Object.freeze({ identity: Object.freeze({}), chain: this.original.chain, parent: this.original.parent, marker,
      isCurrent: this.current, sourceCurrent: () => this.current() && this.original.chain.isCurrent(this.original.parent) && this.current() });
    this.publish(); return this.current();
  }
  read(chain: AdminRootPresentationChain, parent: AdminRootPresentationParent): AdminRootNativeParentBinding | null {
    return chain === this.original.chain && parent === this.original.parent && this.binding && this.current() ? this.binding : null;
  }
  retire = () => { if (this.retired) return; this.retired = true; this.binding = null; this.view = null; this.publish(); };
}
