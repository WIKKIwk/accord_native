import type { Session } from '../auth';
import { canOpenRoute } from '../shared/appRoutes';
import { brigaderFlowSupport } from './brigaderFlowSupport';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export type BrigaderFlowTarget = Readonly<{ route: string; args?: unknown }>;
export type BrigaderFlowEntry = Readonly<{ id: string; target: BrigaderFlowTarget; isCurrent: () => boolean }>;
type Entry = { value: BrigaderFlowEntry; parent: () => boolean; resolve: (value: unknown) => void; result: unknown; nativeKey: string | null; mounts: Set<object>; closing: boolean };
let sequence = 0;
/** Original in-memory route arguments and results; URLs contain only an opaque identifier. */
export class BrigaderFlowRoutes {
  private active = false; private retired = false; private version = 0;
  private readonly entries = new Map<string, Entry>(); private readonly listeners = new Set<() => void>();
  constructor(private readonly session: Session, private readonly original: () => boolean, private readonly push: (id: string) => void) {}
  getSnapshot = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { this.version++; this.listeners.forEach(listener => listener()); }
  start() { if (!this.retired) { this.active = true; this.publish(); } }
  current = () => {
    if (!this.active || this.retired) return false;
    if (!isSynchronouslyTrue(this.original)) { this.invalidate(); return false; }
    return true;
  };
  private entryCurrent(entry: Entry): boolean {
    if (!this.current() || this.entries.get(entry.value.id) !== entry) return false;
    if (!isSynchronouslyTrue(entry.parent) || !canOpenRoute(this.session, entry.value.target.route)) { this.finish(entry); return false; }
    return this.current() && this.entries.get(entry.value.id) === entry;
  }
  open<T = unknown>(target: BrigaderFlowTarget, parent: { isCurrent: () => boolean; canInteract: () => boolean }): Promise<T | undefined> {
    if (!this.current() || !isSynchronouslyTrue(parent.isCurrent) || !isSynchronouslyTrue(parent.canInteract) || !brigaderFlowSupport.has(target.route) || !canOpenRoute(this.session, target.route)) return Promise.resolve(undefined);
    const id = String(++sequence); let resolve!: (value: unknown) => void;
    const result = new Promise<T | undefined>(done => { resolve = done as (value: unknown) => void; });
    const entry: Entry = { value: Object.freeze({ id, target: Object.freeze({ ...target }), isCurrent: () => this.entryCurrent(entry) }), parent: parent.isCurrent,
      resolve, result: undefined, nativeKey: null, mounts: new Set(), closing: false };
    this.entries.set(id, entry);
    try { if (this.entryCurrent(entry) && isSynchronouslyTrue(parent.canInteract)) this.push(id); else this.finish(entry); } catch { this.finish(entry); }
    return result;
  }
  get(id: string | undefined): BrigaderFlowEntry | null { const entry = id ? this.entries.get(id) : undefined; return entry && this.entryCurrent(entry) ? entry.value : null; }
  mount(id: string, key: string): (() => void) | null {
    const entry = this.entries.get(id); if (!entry || !this.entryCurrent(entry) || entry.nativeKey !== null && entry.nativeKey !== key) return null;
    const member = {}; entry.nativeKey = key; entry.mounts.add(member); this.publish();
    return () => { entry.mounts.delete(member); queueMicrotask(() => { if (!entry.mounts.size && this.entries.get(id) === entry) this.finish(entry); }); };
  }
  isMounted(id: string, key: string) { const entry = this.entries.get(id); return !!entry && entry.nativeKey === key && entry.mounts.size > 0 && this.entryCurrent(entry); }
  accept(id: string, key: string, result: unknown): boolean {
    const entry = this.entries.get(id); if (!entry || entry.closing || entry.nativeKey !== key || !entry.mounts.size || !this.entryCurrent(entry)) return false;
    entry.closing = true; entry.result = result; return true;
  }
  private finish(entry: Entry) { if (this.entries.get(entry.value.id) !== entry) return; this.entries.delete(entry.value.id); const result = entry.result; entry.result = undefined; entry.resolve(result); this.publish(); }
  detach() { this.active = false; for (const entry of [...this.entries.values()]) this.finish(entry); this.publish(); }
  invalidate() { this.retired = true; this.detach(); }
}
