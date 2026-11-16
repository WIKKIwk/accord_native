import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminWarehouseMainRow } from './AdminWarehouseMainRows';

export type AdminWarehouseMainDialog = { id: number; kind: 'create' } | { id: number; kind: 'details' | 'item'; row: AdminWarehouseMainRow };
type Snapshot = { active: boolean; focused: boolean; generation: number; mountGeneration: number; dialog: AdminWarehouseMainDialog | null;
  searchFocused: boolean; fillVersion: number; fillText: string; summarySeen: boolean };

/** Presentation tickets are independent of account authority: blur closes UI without retiring reads. */
export class AdminWarehouseMainViewState {
  private state: Snapshot = { active: false, focused: false, generation: 0, mountGeneration: 0, dialog: null, searchFocused: false, fillVersion: 0, fillText: '', summarySeen: false };
  private listeners = new Set<() => void>(); private serial = 0; private nativeText = ''; private rows = new Set<AdminWarehouseMainRow>(); private action = 0; private closing = 0; private lifetime = 0;
  constructor(private readonly current: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<Snapshot>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  attach(focused: boolean) { this.lifetime++; this.publish({ active: true, focused, mountGeneration: this.lifetime, generation: this.state.generation + 1 }); }
  detach() { this.lifetime++; this.action = 0; this.closing = 0; this.rows.clear(); this.publish({ active: false, focused: false, mountGeneration: this.lifetime, generation: this.state.generation + 1, dialog: null, searchFocused: false }); }
  setFocused(focused: boolean) {
    if (focused === this.state.focused) return;
    // An awaited routed child legitimately blurs this parent. Its issued account/lifetime ticket survives.
    const child = this.state.dialog?.kind === 'item' || this.action < 0;
    if (!child) this.action = 0;
    this.publish({ focused, generation: this.state.generation + 1, ...(!focused ? { ...(!child ? { dialog: null } : {}), searchFocused: false } : {}) });
  }
  canInteract = () => {
    const generation = this.state.generation;
    return this.state.active && this.state.focused && isSynchronouslyTrue(this.current) && this.state.active && this.state.focused && generation === this.state.generation;
  };
  capture(generation = this.state.generation) { return () => this.canInteract() && generation === this.state.generation; }
  captureMounted(lifetime = this.lifetime) {
    return () => this.state.active && lifetime === this.lifetime && isSynchronouslyTrue(this.current) && this.state.active && lifetime === this.lifetime;
  }
  setRows(rows: readonly AdminWarehouseMainRow[]) { this.rows = new Set(rows); }
  setSearchFocused(focused: boolean) { if (this.canInteract() && (!focused || !this.state.dialog)) this.publish({ searchFocused: focused }); }
  typed(text: string) { if (this.canInteract()) this.nativeText = text; }
  synchronizeText(text: string) {
    if (text === this.nativeText) return;
    this.nativeText = text; this.publish({ fillVersion: this.state.fillVersion + 1, fillText: text });
  }
  markSummaryReady() { if (!this.state.summarySeen) this.publish({ summarySeen: true }); }
  markSummaryError() { if (this.state.summarySeen) this.publish({ summarySeen: false }); }
  openCreate() { if (this.canInteract() && !this.state.dialog) this.publish({ dialog: { id: ++this.serial, kind: 'create' }, searchFocused: false, generation: this.state.generation + 1 }); }
  openRow(row: AdminWarehouseMainRow) {
    if (!this.canInteract() || this.state.dialog || !this.rows.has(row)) return null;
    const dialog: AdminWarehouseMainDialog = { id: ++this.serial, kind: row.kind === 'item' ? 'item' : 'details', row };
    this.publish({ dialog, searchFocused: false, generation: this.state.generation + 1 }); return dialog;
  }
  dialogCurrent = (id: number) => {
    const lifetime = this.lifetime, dialog = this.state.dialog;
    return this.state.active && this.closing !== id && dialog?.id === id && isSynchronouslyTrue(this.current) && this.state.active && lifetime === this.lifetime && this.state.dialog === dialog && this.closing !== id;
  };
  beginDismiss(id: number) { if (this.state.dialog?.id === id) { this.closing = id; this.action = 0; } }
  close(id: number) { if (this.state.dialog?.id === id) { this.closing = 0; this.action = 0; this.publish({ dialog: null, generation: this.state.generation + 1 }); } }
  /** Only one nested QR/editor action can be launched from the original captured detail sheet. */
  beginAction(id: number) {
    if (!this.canInteract() || !this.dialogCurrent(id) || this.action < 0) return null;
    const ticket = ++this.serial; this.action = -ticket;
    return { current: () => this.dialogCurrent(id) && this.action === -ticket,
      finish: () => { if (this.action === -ticket) this.action = 0; } };
  }
}
