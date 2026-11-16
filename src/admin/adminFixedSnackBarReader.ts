import type { AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';
import { adminScaffoldLayoutEvent, type AdminScaffoldLayoutEvent, type AdminScaffoldLayoutObserver, type AdminScaffoldLayoutReceipt, type AdminScaffoldMarker, type AdminScaffoldViewport } from '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminFixedSnackBarNativeReader } from './AdminFixedSnackBarTypes';
import type { AdminFixedSnackBarNativePair } from './adminFixedSnackBarGeometry';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';
import type { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

export type AdminScaffoldLayoutBindingSnapshot = Readonly<{
  revision: number; phase: 'binding' | 'bound' | 'unavailable' | 'retired'; viewport: AdminScaffoldViewport | null;
  metrics: AdminSystemInsets | null; dockHeight: number | null; windowIdentity: object | null;
}>;
export type AdminScaffoldLayoutBinding = Readonly<{
  getSnapshot: () => AdminScaffoldLayoutBindingSnapshot; subscribe: (listener: () => void) => () => void;
  setDockMarker: (marker: AdminScaffoldMarker | null) => void; dispose: () => void;
}>;
type Watch = { kind: 'viewport' | 'dock' | 'pair'; ticket: string; record: RecordOwner; receipt: AdminScaffoldLayoutReceipt | null; pending: AdminScaffoldLayoutEvent | null;
  revision: number; closed: boolean; current?: () => boolean; receive?: (pair: AdminFixedSnackBarNativePair | null) => void };
type RecordOwner = { scaffold: AdminTopNoticeScaffold; marker: AdminScaffoldMarker; current: () => boolean; checking: boolean; retired: boolean; failed: boolean;
  viewportWatch: Watch | null; dockWatch: Watch | null; dockMarker: AdminScaffoldMarker | null; pairWatches: Set<Watch>; frame: number;
  dockChanging: boolean; dockIntent: object | null;
  snapshot: AdminScaffoldLayoutBindingSnapshot; listeners: Set<() => void> };
type Options = Readonly<{ observer: AdminScaffoldLayoutObserver; messenger: AdminTopNoticeMessenger; isCurrent: () => boolean }>;
const validMarker = (value: AdminScaffoldMarker) => value && Number.isSafeInteger(value.tag) && value.tag > 0 && value.tag <= 0x7fffffff && typeof value.nativeID === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.exec(value.nativeID)?.[0] === value.nativeID;
const copyMarker = (value: AdminScaffoldMarker) => Object.freeze({ tag: value.tag, nativeID: value.nativeID });

/** Owns actual per-Scaffold native registrations. No Source ancestor, marker, metric, or available module is fabricated. */
export class AdminFixedSnackBarReaderOwner {
  readonly reader: AdminFixedSnackBarNativeReader;
  private readonly options: Options; private readonly records = new Map<AdminTopNoticeScaffold, RecordOwner>(); private readonly watches = new Map<string, Watch>();
  private readonly stopNative: () => void; private readonly stopSource: () => void; private checking = false; private retired = false;
  constructor(options: Options) {
    if (!options?.observer || options.observer.capability?.protocol !== 1 || options.observer.capability.guarantee !== 'original-window-layout-snapshot' || options.observer.capability.rawIme !== true ||
      !['android', 'ios'].includes(options.observer.capability.platform) || ['bindViewport', 'bindDock', 'bindParts', 'release', 'cancelTicket', 'subscribe'].some(key => typeof (options.observer as unknown as Record<string, unknown>)[key] !== 'function') ||
      !options.messenger || typeof options.isCurrent !== 'function') throw TypeError('Actual scaffold layout observer and original Source Messenger authority are required');
    this.options = Object.freeze({ ...options });
    this.reader = Object.freeze({ isAvailable: () => this.current(), observe: (request, receive) => this.observe(request, receive) });
    this.stopNative = options.observer.subscribe(event => this.nativeEvent(event)); this.stopSource = options.messenger.subscribe(() => { this.current(); });
    if (this.retired) { this.stopNative(); this.stopSource(); }
  }
  private current(): boolean {
    if (this.retired) return false; if (this.checking) { this.dispose(); return false; } this.checking = true;
    const current = this.options.messenger.current() && isSynchronouslyTrue(this.options.isCurrent) && this.options.messenger.current(); this.checking = false;
    if (!current || this.retired) { this.dispose(); return false; } return true;
  }
  private recordCurrent(record: RecordOwner): boolean {
    if (!this.current() || record.retired || record.failed || this.records.get(record.scaffold) !== record) return false;
    if (record.checking) { this.retireRecord(record); return false; } record.checking = true;
    const current = isSynchronouslyTrue(record.current); record.checking = false;
    if (!current || !this.current() || record.retired || !this.options.messenger.isRootScaffold(record.scaffold)) { this.retireRecord(record); return false; } return true;
  }
  private publish(record: RecordOwner, patch: Partial<AdminScaffoldLayoutBindingSnapshot>) {
    record.snapshot = Object.freeze({ ...record.snapshot, ...patch, revision: record.snapshot.revision + 1 });
    for (const listener of [...record.listeners]) { try { listener(); } catch { /* A render listener cannot acknowledge native layout. */ } }
  }
  registerScaffold(options: Readonly<{ scaffold: AdminTopNoticeScaffold; viewportMarker: AdminScaffoldMarker; isCurrent: () => boolean }>): AdminScaffoldLayoutBinding | null {
    if (!options || !validMarker(options.viewportMarker) || typeof options.isCurrent !== 'function' || !this.current() || !this.options.messenger.isRootScaffold(options.scaffold) || this.records.has(options.scaffold)) return null;
    const record: RecordOwner = { scaffold: options.scaffold, marker: copyMarker(options.viewportMarker), current: options.isCurrent, checking: false, retired: false, failed: false,
      viewportWatch: null, dockWatch: null, dockMarker: null, pairWatches: new Set(), frame: 0, dockChanging: false, dockIntent: null, listeners: new Set(),
      snapshot: Object.freeze({ revision: 0, phase: 'binding', viewport: null, metrics: null, dockHeight: null, windowIdentity: null }) };
    this.records.set(record.scaffold, record); if (!this.recordCurrent(record)) return null;
    const watch = this.watch(record, 'viewport'); record.viewportWatch = watch;
    this.send(watch, () => this.options.observer.bindViewport(record.marker, watch.ticket));
    return Object.freeze({ getSnapshot: () => record.snapshot, subscribe: listener => { record.listeners.add(listener); return () => { record.listeners.delete(listener); }; },
      setDockMarker: marker => this.setDock(record, marker), dispose: () => this.retireRecord(record) });
  }
  private watch(record: RecordOwner, kind: Watch['kind']): Watch {
    const watch: Watch = { kind, record, ticket: createAdminPresentationWindowTicket(), receipt: null, pending: null, revision: 0, closed: false };
    this.watches.set(watch.ticket, watch); return watch;
  }
  private watchCurrent(watch: Watch): boolean {
    if (watch.closed || this.watches.get(watch.ticket) !== watch || !this.recordCurrent(watch.record)) return false;
    if (watch.current && (!isSynchronouslyTrue(watch.current) || watch.closed || !this.recordCurrent(watch.record))) { this.closeWatch(watch); return false; }
    return !watch.closed && this.watches.get(watch.ticket) === watch && !watch.record.retired && this.records.get(watch.record.scaffold) === watch.record;
  }
  private send(watch: Watch, send: () => Promise<AdminScaffoldLayoutReceipt>) {
    if (!this.watchCurrent(watch)) { this.closeWatch(watch); return; }
    let pending: Promise<AdminScaffoldLayoutReceipt>;
    try { pending = send(); } catch { this.failed(watch); return; }
    void pending.then(receipt => {
      if (!this.watchCurrent(watch)) { this.release(receipt); return; }
      let initial: AdminScaffoldLayoutEvent;
      try { initial = adminScaffoldLayoutEvent(receipt.initial, this.options.observer.capability.platform); } catch { this.release(receipt); this.failed(watch); return; }
      if (receipt.ticket !== watch.ticket || initial.ticket !== watch.ticket || initial.kind !== watch.kind || initial.handle !== receipt.handle || initial.windowID !== receipt.windowID || initial.retired) { this.release(receipt); this.failed(watch); return; }
      const viewport = watch.record.viewportWatch?.receipt;
      if (watch.kind !== 'viewport' && (!viewport || initial.viewportHandle !== viewport.handle || receipt.windowID !== viewport.windowID)) { this.release(receipt); this.failed(watch); return; }
      if (!this.watchCurrent(watch)) { this.release(receipt); return; }
      watch.receipt = receipt;
      const latest = watch.pending; watch.pending = null;
      // A newer exact native event received before its Promise ACK is already authoritative.
      // Do not transiently publish obsolete geometry (or a retired window's old initial snapshot).
      const newer = latest && latest.handle === receipt.handle && latest.windowID === receipt.windowID && latest.viewportHandle === initial.viewportHandle && latest.revision > initial.revision;
      this.apply(watch, newer ? latest : initial);
      if (watch.kind === 'viewport' && this.watchCurrent(watch)) this.startDock(watch.record);
    }).catch(() => { this.failed(watch); });
  }
  private nativeEvent(raw: AdminScaffoldLayoutEvent) {
    let event: AdminScaffoldLayoutEvent; try { event = adminScaffoldLayoutEvent(raw, this.options.observer.capability.platform); } catch { return; }
    const watch = this.watches.get(event.ticket); if (!watch || !this.watchCurrent(watch) || event.kind !== watch.kind) return;
    if (!watch.receipt) { if (!watch.pending || event.revision > watch.pending.revision) watch.pending = event; return; } this.apply(watch, event);
  }
  private viewportPatch(record: RecordOwner, value: AdminScaffoldViewport | null): Partial<AdminScaffoldLayoutBindingSnapshot> {
    const platform = this.options.observer.capability.platform;
    return { viewport: value, metrics: value ? Object.freeze({ platform, width: value.rect.width, height: value.rect.height, viewPaddingBottom: value.viewPaddingBottom,
      systemGestureInsetsBottom: value.systemGestureBottom, viewInsetsBottom: value.rawImeBottom }) : null,
      windowIdentity: record.snapshot.windowIdentity ?? Object.freeze({ originalViewport: record.viewportWatch?.receipt?.handle, windowID: record.viewportWatch?.receipt?.windowID }) };
  }
  private apply(watch: Watch, event: AdminScaffoldLayoutEvent) {
    const receipt = watch.receipt, record = watch.record;
    if (!receipt || !this.watchCurrent(watch) || event.handle !== receipt.handle || event.ticket !== receipt.ticket || event.windowID !== receipt.windowID || event.viewportHandle !== receipt.initial.viewportHandle || event.revision <= watch.revision) return;
    watch.revision = event.revision;
    if (event.retired) { if (watch.kind === 'viewport') this.retireRecord(record); else if (watch.kind === 'dock') this.setDock(record, null); else { this.receive(watch, null); this.closeWatch(watch); } return; }
    if (watch.kind === 'viewport' && event.frame >= record.frame) {
      record.frame = event.frame; this.publish(record, { ...this.viewportPatch(record, event.viewport), phase: 'bound', dockHeight: null });
    } else if (watch.kind === 'dock' && event.frame >= record.frame) {
      record.frame = event.frame; this.publish(record, { ...(event.dock ? this.viewportPatch(record, event.dock.viewport) : {}), phase: 'bound', dockHeight: event.dock?.dockHeight ?? null });
    } else if (watch.kind === 'pair') {
      const pair = event.pair, identity = record.snapshot.windowIdentity;
      if (event.frame < record.frame) { this.receive(watch, null); return; }
      if (pair) { record.frame = event.frame; this.publish(record, { ...this.viewportPatch(record, pair.viewport), phase: 'bound', dockHeight: pair.dockHeight }); }
      this.receive(watch, pair && identity ? Object.freeze({ window: Object.freeze({ identity, viewport: pair.viewport.rect, rawImeBottom: pair.viewport.rawImeBottom }),
        host: Object.freeze({ windowIdentity: identity, frame: pair.fixed }), dock: Object.freeze({ windowIdentity: identity, height: pair.dockHeight }),
        remainingSafeArea: Object.freeze({ left: pair.viewport.safeLeft, right: pair.viewport.safeRight, bottom: 0 as const }) }) : null);
    }
  }
  private setDock(record: RecordOwner, marker: AdminScaffoldMarker | null) {
    if (!this.recordCurrent(record) || marker !== null && !validMarker(marker)) return;
    const same = marker === null ? record.dockMarker === null : record.dockMarker?.tag === marker.tag && record.dockMarker.nativeID === marker.nativeID;
    if (same && (record.dockChanging || marker !== null && record.dockWatch && !record.dockWatch.closed)) return;
    const intent = {}; record.dockIntent = intent; record.dockChanging = true;
    const oldPairs = [...record.pairWatches], oldDock = record.dockWatch;
    // Install the new original intent and retire every old callback before notifying a receiver.
    record.dockWatch = null; record.dockMarker = marker ? copyMarker(marker) : null;
    for (const watch of oldPairs) this.closeWatch(watch); if (oldDock) this.closeWatch(oldDock);
    try {
      for (const watch of oldPairs) {
        if (record.dockIntent !== intent || !this.recordCurrent(record)) return;
        if (watch.current && isSynchronouslyTrue(watch.current) && this.recordCurrent(record) && record.dockIntent === intent) { try { watch.receive?.(null); } catch {} }
      }
      if (record.dockIntent !== intent || !this.recordCurrent(record)) return;
      this.publish(record, { dockHeight: null }); if (record.dockIntent === intent && this.recordCurrent(record)) this.startDock(record);
    } finally { if (record.dockIntent === intent) record.dockChanging = false; }
  }
  private startDock(record: RecordOwner) {
    const viewport = record.viewportWatch?.receipt, marker = record.dockMarker;
    if (!viewport || !marker || record.dockWatch || !this.recordCurrent(record)) return;
    const watch = this.watch(record, 'dock'); record.dockWatch = watch;
    this.send(watch, () => this.options.observer.bindDock(viewport, marker, watch.ticket));
  }
  private observe(request: Parameters<AdminFixedSnackBarNativeReader['observe']>[0], receive: (pair: AdminFixedSnackBarNativePair | null) => void): () => void {
    const record = this.records.get(request.scaffold), viewport = record?.viewportWatch?.receipt, dock = record?.dockMarker;
    if (!record || !viewport || !dock || !record.dockWatch?.receipt || !this.recordCurrent(record) || typeof request.isCurrent !== 'function' || typeof receive !== 'function' ||
      !validMarker({ tag: request.nativeTag, nativeID: request.nativeID }) || !isSynchronouslyTrue(request.isCurrent)) { try { receive(null); } catch {} return () => {}; }
    const watch = this.watch(record, 'pair'); watch.current = request.isCurrent; watch.receive = receive; record.pairWatches.add(watch);
    this.send(watch, () => this.options.observer.bindParts(viewport, dock, { tag: request.nativeTag, nativeID: request.nativeID }, watch.ticket));
    return () => this.closeWatch(watch);
  }
  private receive(watch: Watch, pair: AdminFixedSnackBarNativePair | null) { if (!this.watchCurrent(watch)) return; try { watch.receive?.(pair); } catch {} }
  private failed(watch: Watch) {
    if (watch.closed || !this.recordCurrent(watch.record)) return; const record = watch.record;
    if (watch.kind === 'viewport') { record.failed = true; this.publish(record, { phase: 'unavailable', viewport: null, metrics: null, dockHeight: null, windowIdentity: null }); }
    else if (watch.kind === 'dock') this.publish(record, { dockHeight: null }); else this.receive(watch, null); this.closeWatch(watch);
  }
  private release(receipt: AdminScaffoldLayoutReceipt) { try { void this.options.observer.release(receipt).catch(() => {}); } catch {} }
  private closeWatch(watch: Watch) {
    if (watch.closed) return; watch.closed = true; this.watches.delete(watch.ticket); watch.record.pairWatches.delete(watch);
    if (watch.receipt) this.release(watch.receipt); else { try { void this.options.observer.cancelTicket(watch.ticket).catch(() => {}); } catch {} }
  }
  private retireRecord(record: RecordOwner) {
    if (record.retired) return; record.retired = true; if (this.records.get(record.scaffold) === record) this.records.delete(record.scaffold);
    for (const watch of [...record.pairWatches]) this.closeWatch(watch); if (record.dockWatch) this.closeWatch(record.dockWatch); if (record.viewportWatch) this.closeWatch(record.viewportWatch);
    this.publish(record, { phase: 'retired', viewport: null, metrics: null, dockHeight: null, windowIdentity: null });
  }
  dispose = (): void => {
    if (this.retired) return; this.retired = true; for (const record of [...this.records.values()]) this.retireRecord(record);
    try { this.stopNative?.(); } catch {} try { this.stopSource?.(); } catch {}
  };
}
