import type { AdminScaffoldMarker } from '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout';
import type { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import type { AdminSourceDockLocalPrimary } from './AdminSourceDockScaffoldTypes';
import type { AdminSourceHubPlacementReceipt } from './adminSourceHubPlacementTypes';
import { createAdminPresentationWindowTicket } from './adminPresentationWindowTicket';

type Snapshot = Readonly<{ generation: number; revision: number; retired: boolean; presentation: AdminSourceDockLocalPrimary | null; markerID: string | null; receipt: AdminSourceHubPlacementReceipt | null }>;
/** Measures one original local primary. It intentionally supplies NO global NativeHost/capability or interaction authority. */
export class AdminSourceCreateHubPlacementOwner {
  private readonly original; private readonly observe; private readonly receiptCurrent;
  private active = false; private retired = false; private stopSource: (() => void) | null = null; private stopPair: (() => void) | null = null;
  private intent: object | null = null; private view: object | null = null; private marker: AdminScaffoldMarker | null = null;
  private refreshing = false; private again = false; private readonly listeners = new Set<() => void>();
  private state: Snapshot = Object.freeze({ generation: 0, revision: 0, retired: false, presentation: null, markerID: null, receipt: null });
  constructor(readonly source: AdminSourceDockScaffoldOwner) {
    const original = source.sourceWitness();
    if (!original.rootBinding || typeof original.reader.observeHubPlacement !== 'function' || typeof original.reader.hubPlacementCurrent !== 'function') throw TypeError('The actual Root Source Reader placement owner is required');
    this.original = original; this.observe = original.reader.observeHubPlacement.bind(original.reader); this.receiptCurrent = original.reader.hubPlacementCurrent.bind(original.reader);
  }
  matches = (source: AdminSourceDockScaffoldOwner) => source === this.source && source.sourceWitness() === this.original;
  commit(source: AdminSourceDockScaffoldOwner) { if (!this.matches(source)) this.invalidate(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<Snapshot>) { this.state = Object.freeze({ ...this.state, ...patch, revision: this.state.revision + 1 }); for (const listener of [...this.listeners]) { try { listener(); } catch {} } }
  private clearPair() { this.intent = null; const stop = this.stopPair; this.stopPair = null; stop?.(); }
  private clear() { this.clearPair(); this.view = null; this.marker = null; }
  attach = () => {
    if (this.active || this.retired) return () => {}; this.active = true; this.publish({ generation: this.state.generation + 1 });
    this.stopSource = this.source.subscribe(this.refresh); this.refresh(); return this.detach;
  };
  detach = () => { this.active = false; this.stopSource?.(); this.stopSource = null; this.clear(); this.publish({ generation: this.state.generation + 1, presentation: null, markerID: null, receipt: null }); };
  invalidate = () => { if (this.retired) return; this.retired = true; this.detach(); this.publish({ retired: true }); };
  private current(generation: number, presentation: AdminSourceDockLocalPrimary): boolean {
    if (!this.active || this.retired || generation !== this.state.generation || !this.source.current(presentation.sourceGeneration)) return false;
    const actual = this.source.localPrimary(); return !!actual && actual.targetIdentity === presentation.targetIdentity && actual.windowIdentity === presentation.windowIdentity && this.active && !this.retired && generation === this.state.generation;
  }
  placement(): AdminSourceHubPlacementReceipt | null {
    const { generation, presentation, receipt } = this.state;
    return presentation && receipt && this.current(generation, presentation) && this.receiptCurrent(receipt, this.original.scaffold.ticket!, presentation.windowIdentity) && this.current(generation, presentation) ? receipt : null;
  }
  bindMarker(view: object, marker: AdminScaffoldMarker, generation = this.state.generation) {
    const presentation = this.state.presentation;
    if (!view || !presentation || marker.nativeID !== this.state.markerID || !Number.isSafeInteger(marker.tag) || marker.tag <= 0 || marker.tag > 0x7fffffff || !this.current(generation, presentation)) return;
    if (this.view && (this.view !== view || this.marker?.tag !== marker.tag)) { this.invalidate(); return; }
    this.view = view; this.marker = Object.freeze({ ...marker }); this.refresh();
  }
  private refresh = () => {
    if (this.refreshing) { this.again = true; return; } this.refreshing = true;
    try { let turns = 0; do { this.again = false; this.refreshNow(); if (++turns > 16 && this.again) { this.invalidate(); break; } } while (this.again && !this.retired); }
    finally { this.refreshing = false; this.again = false; }
  };
  private refreshNow() {
    if (!this.active || this.retired) return; const membership = this.source.sourceMembership(); if (membership.retired) { this.invalidate(); return; }
    const presentation = membership.active ? this.source.localPrimary() : null, old = this.state.presentation;
    const same = !!presentation && !!old && presentation.sourceGeneration === old.sourceGeneration && presentation.targetIdentity === old.targetIdentity && presentation.windowIdentity === old.windowIdentity;
    if (!same) { this.clear(); this.publish({ presentation, markerID: presentation ? createAdminPresentationWindowTicket() : null, receipt: null }); }
    else if (presentation && old && (presentation.state !== old.state || presentation.primary !== old.primary)) this.publish({ presentation });
    if (!this.source.getSnapshot().geometryReady) { if (this.stopPair || this.state.receipt) { this.clearPair(); this.publish({ receipt: null }); } return; }
    if (!presentation || !this.marker || this.stopPair) return;
    const generation = this.state.generation, intent = {}; this.intent = intent;
    const stop = this.observe({ scaffold: this.original.scaffold.ticket!, windowIdentity: presentation.windowIdentity, marker: this.marker, isCurrent: () => this.current(generation, presentation) }, receipt => {
      if (this.intent !== intent || !this.current(generation, presentation)) return;
      if (receipt && !this.receiptCurrent(receipt, this.original.scaffold.ticket!, presentation.windowIdentity)) return;
      this.publish({ receipt });
    });
    if (this.intent !== intent || !this.current(generation, presentation)) { stop?.(); return; } this.stopPair = stop;
  }
}
