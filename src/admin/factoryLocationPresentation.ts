import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { FactoryLocationController, FactoryLocationTicket } from './factoryLocationController';

export type FactoryDialog = Readonly<{ id: number; kind: 'editor' | 'rename'; ticket: FactoryLocationTicket; closing: boolean }>;
export type FactoryPicker = Readonly<{ id: number; selected: ReadonlySet<string> }>;
type Snapshot = { dialog: FactoryDialog | null; picker: FactoryPicker | null; invalidName: string | null };
/** Native presentation lifetime. Writes begin only after the owning dialog reports dismissal. */
export class FactoryLocationPresentation {
  private state: Snapshot = { dialog: null, picker: null, invalidName: null };
  private sequence = 0;
  private settling = false;
  private active = true;
  private retired = false;
  private listeners = new Set<() => void>();
  private resolvePicker: ((value: ReadonlySet<string> | null) => void) | null = null;
  private pendingWrite: { id: number; run: () => void } | null = null;
  constructor(private readonly controller: FactoryLocationController, private readonly isCurrent: () => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current() { try { return this.active && isSynchronouslyTrue(this.isCurrent); } catch { return false; } }
  private publish(change: Partial<Snapshot>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private owns(dialog: FactoryDialog) { return this.current() && this.state.dialog?.id === dialog.id && !this.state.dialog.closing && this.controller.isTicketCurrent(dialog.ticket); }
  open(kind: 'editor' | 'rename', ticket: FactoryLocationTicket) {
    if (!this.current() || this.settling || this.state.dialog || !this.controller.isTicketCurrent(ticket) || (kind === 'rename' && !ticket.location)) return;
    this.publish({ dialog: Object.freeze({ id: ++this.sequence, kind, ticket, closing: false }), invalidName: null });
  }
  invalidName(dialog: FactoryDialog, message: string) { if (this.owns(dialog)) this.publish({ invalidName: message }); }
  clearInvalidName() { if (this.current()) this.publish({ invalidName: null }); }
  picker(dialog: FactoryDialog, selected: ReadonlySet<string>): Promise<ReadonlySet<string> | null> {
    if (!this.owns(dialog) || this.state.picker) return Promise.resolve(null);
    const promise = new Promise<ReadonlySet<string> | null>(resolve => { this.resolvePicker = resolve; });
    this.publish({ picker: Object.freeze({ id: ++this.sequence, selected: new Set(selected) }) });
    return promise;
  }
  finishPicker(picker: FactoryPicker, value: ReadonlySet<string> | null) {
    if (this.state.picker?.id !== picker.id) return;
    const resolve = this.resolvePicker; this.resolvePicker = null;
    const accepted = this.current() && this.state.dialog && this.controller.isTicketCurrent(this.state.dialog.ticket);
    this.publish({ picker: null }); resolve?.(accepted && value ? new Set(value) : null);
  }
  cancel(dialog: FactoryDialog) {
    if (!this.owns(dialog) || this.state.picker) return;
    this.pendingWrite = null; this.publish({ dialog: Object.freeze({ ...dialog, closing: true }), invalidName: null });
  }
  submit(dialog: FactoryDialog, name: string, selected?: ReadonlySet<string>) {
    if (!this.owns(dialog) || this.state.picker) return;
    const ids = new Set(selected);
    this.pendingWrite = { id: dialog.id, run: () => {
      if (!this.current() || !this.controller.isTicketCurrent(dialog.ticket)) return;
      if (dialog.kind === 'editor') void this.controller.saveEditor(dialog.ticket, name, ids);
      else void this.controller.rename(dialog.ticket, name);
    } };
    this.publish({ dialog: Object.freeze({ ...dialog, closing: true }), invalidName: null });
  }
  dismissed(dialog: FactoryDialog) {
    if (this.state.dialog?.id !== dialog.id || !this.state.dialog.closing) return;
    const write = this.pendingWrite; this.pendingWrite = null;
    this.settling = write?.id === dialog.id;
    try {
      this.publish({ dialog: null });
      if (write?.id === dialog.id && this.current()) write.run();
    } finally { this.settling = false; }
  }
  activate() { if (!this.retired) this.active = true; }
  invalidate() {
    this.retired = true; this.clear();
  }
  private clear() {
    this.active = false; this.pendingWrite = null;
    const resolve = this.resolvePicker; this.resolvePicker = null;
    this.publish({ dialog: null, picker: null, invalidName: null }); resolve?.(null);
  }
  detach() { this.clear(); }
  dispose() { this.clear(); this.listeners.clear(); }
}
