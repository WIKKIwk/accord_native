import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminItemDetailController } from './adminItemDetailController';
import { AdminItemDetailCustomersController } from './adminItemDetailCustomersController';
import { adminItemDetailActions, type AdminItemDetailAction, type AdminItemDetailActionMenuTicket } from './adminItemDetailActionMenuModel';
import { adminItemDetailEditDraft, adminItemDetailEditUnchanged, type AdminItemDetailEditDraft, type AdminItemDetailEditValidation } from './adminItemDetailEditModel';
import { adminItemDetailGroupChoices, adminItemDetailSameGroup } from './adminItemDetailGroupModel';
import { adminItemDetailKind, retainAdminItemDetailImage, type AdminItemDetail, type AdminItemDetailCustomer } from './adminItemDetailModel';
import { dartTrim } from './dartJsonString';

type BaseDialog = Readonly<{ id: number; detail: AdminItemDetail; closing: boolean }>;
export type AdminItemDetailDecisionDialog =
  | BaseDialog & Readonly<{ kind: 'edit'; validation: AdminItemDetailEditValidation | null }>
  | BaseDialog & Readonly<{ kind: 'delete' }>
  | BaseDialog & Readonly<{ kind: 'group'; groups: readonly string[]; query: string; selected: string }>
  | BaseDialog & Readonly<{ kind: 'customers'; owner: AdminItemDetailCustomersController }>;
export type AdminItemDetailDecisionNotice = Readonly<{ serial: number }> & (
  | Readonly<{ kind: 'key'; key: 'detail.item_saved' | 'detail.group_updated' | 'detail.item_deleted' }>
  | Readonly<{ kind: 'raw'; message: string }>
  | Readonly<{ kind: 'operation'; key: 'detail.groups_save_failed' | 'detail.item_delete_failed'; error: unknown }>
  | Readonly<{ kind: 'customer'; error: unknown }>);
export type AdminItemDetailDecisionState = Readonly<{
  phase: 'loading' | 'content' | 'error' | 'removed' | 'invalidated'; itemCode: string; detail: AdminItemDetail | null;
  saving: boolean; changingGroup: boolean; deleting: boolean; changed: boolean;
  dialogs: readonly AdminItemDetailDecisionDialog[]; notice: AdminItemDetailDecisionNotice | null;
}>;
export type AdminItemDetailCloseTicket = Readonly<{ id: number; kind: AdminItemDetailDecisionDialog['kind'] }>;
export type AdminItemDetailDecisionResult = Readonly<{ removed: boolean; changed: boolean }>;
export type AdminItemDetailDecisionDependencies = Readonly<{
  isCurrent: () => boolean;
  read: (code: string, guard: () => void, witness: () => boolean) => Promise<AdminItemDetail>;
  rename: (detail: AdminItemDetail, draft: AdminItemDetailEditDraft, guard: () => void) => Promise<AdminItemDetail>;
  remove: (detail: AdminItemDetail, guard: () => void) => Promise<void>;
  groups: (guard: () => void, witness: () => boolean) => Promise<readonly string[]>;
  moveGroup: (detail: AdminItemDetail, group: string, guard: () => void, witness: () => boolean) => Promise<AdminItemDetail>;
  customers: (query: string, guard: () => void, witness: () => boolean) => Promise<readonly AdminItemDetailCustomer[]>;
  setCustomer: (detail: AdminItemDetail, customer: AdminItemDetailCustomer, assigned: boolean, guard: () => void, witness: () => boolean) => Promise<AdminItemDetail>;
}>;
type CloseDecision = Readonly<{ generation: number; dialog: AdminItemDetailDecisionDialog; value: AdminItemDetailEditDraft | string | boolean | AdminItemDetail | null }>;
const initial = (itemCode: string): AdminItemDetailDecisionState => Object.freeze({ phase: 'loading', itemCode, detail: null,
  saving: false, changingGroup: false, deleting: false, changed: false, dialogs: Object.freeze([]), notice: null });

/** Source ordinary-item decisions and picker ownership. A host must acknowledge genuine native removal before completeClose. */
export class AdminItemDetailDecisionController {
  private readonly initialCode: string; private state: AdminItemDetailDecisionState;
  private active = false; private retired = false; private checking = false; private generation = 0; private serial = 0; private settling: object | null = null;
  private preparingCustomerClose: number | null = null;
  private reader: AdminItemDetailController | null = null; private unsubscribeRead: (() => void) | null = null;
  private finishRead: (() => void) | null = null;
  private closeTickets = new WeakMap<AdminItemDetailCloseTicket, CloseDecision>();
  private closing = new Map<number, AdminItemDetailCloseTicket>();
  private editBuffers = new Map<number, { code: string; name: string }>();
  private menuTickets = new WeakMap<AdminItemDetailActionMenuTicket, { generation: number; detail: AdminItemDetail }>();
  private readonly listeners = new Set<() => void>();
  constructor(itemCode: string, private readonly deps: AdminItemDetailDecisionDependencies) {
    this.initialCode = dartTrim(itemCode); this.state = initial(this.initialCode);
  }
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminItemDetailDecisionState>): void {
    this.state = Object.freeze({ ...this.state, ...patch }); for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && generation === this.generation;
  };
  private guard(generation: number): () => void { return () => { if (!this.isCurrent(generation)) throw new Error('Item detail decision changed'); }; }
  private busy(): boolean { return this.state.saving || this.state.changingGroup || this.state.deleting; }
  private admit(detail: AdminItemDetail): boolean {
    return this.isCurrent() && this.state.phase === 'content' && this.state.detail === detail && adminItemDetailKind(detail) !== 'combo' && !this.busy() && !this.settling && this.closing.size === 0;
  }
  private dialog(id: number): AdminItemDetailDecisionDialog | undefined { return this.state.dialogs.find(value => value.id === id); }
  private interactive(id: number): AdminItemDetailDecisionDialog | undefined {
    if (!this.isCurrent() || this.settling || this.closing.has(id)) return undefined;
    const dialog = this.state.dialogs[this.state.dialogs.length - 1]; return dialog?.id === id ? dialog : undefined;
  }
  private patchDialog(id: number, patch: object): void {
    this.publish({ dialogs: Object.freeze(this.state.dialogs.map(dialog => dialog.id === id ? Object.freeze({ ...dialog, ...patch }) : dialog)) });
  }
  private detachRead(): void {
    const reader = this.reader; this.reader = null; this.unsubscribeRead?.(); this.unsubscribeRead = null;
    const finish = this.finishRead; this.finishRead = null; finish?.(); reader?.dispose();
  }
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.beginRead(); }
  private beginRead(): Promise<void> {
    this.detachRead(); const generation = this.generation;
    const reader = new AdminItemDetailController(this.state.itemCode, { isCurrent: () => this.isCurrent(generation), read: this.deps.read }); this.reader = reader;
    let complete!: () => void; const pending = new Promise<void>(resolve => { complete = resolve; }); this.finishRead = complete;
    this.unsubscribeRead = reader.subscribe(() => {
      if (this.reader !== reader || !this.isCurrent(generation)) return;
      const snapshot = reader.getSnapshot(); this.publish({ phase: snapshot.phase, detail: snapshot.detail });
      if (snapshot.phase !== 'loading') complete();
    });
    reader.start(); return pending;
  }
  /** Source replaces the future; each real retry uses the then-current renamed item code. */
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.phase === 'removed') return; await this.beginRead();
  }
  private install(detail: AdminItemDetail, rename = false, changed = true): void {
    this.detachRead(); this.publish({ phase: this.state.phase === 'removed' ? 'removed' : 'content', detail, ...(rename ? { itemCode: detail.code } : {}), ...(changed ? { changed: true } : {}) });
  }
  /** Source header opens against its rendered DTO; its accepted continuation has a separate code/scope contract. */
  captureActionMenu(detail: AdminItemDetail): AdminItemDetailActionMenuTicket | null {
    if (!this.isCurrent() || this.state.phase !== 'content' || this.state.detail !== detail || this.settling || this.closing.size) return null;
    const kind = adminItemDetailKind(detail); if (kind === 'ordinary' || kind === 'finished' && this.busy()) return null;
    const ticket = Object.freeze({ id: ++this.serial, kind }); this.menuTickets.set(ticket, { generation: this.generation, detail }); return ticket;
  }
  discardActionMenu(ticket: AdminItemDetailActionMenuTicket): void { this.menuTickets.delete(ticket); }
  /** @v2 _showFinishedItemActions after its actual sheet Future completes; no new DTO-reference/branch/phase admission here. */
  async continueActionMenu(ticket: AdminItemDetailActionMenuTicket, action: AdminItemDetailAction | null): Promise<number | null> {
    const captured = this.menuTickets.get(ticket); if (!captured) return null; this.menuTickets.delete(ticket);
    if (ticket.kind === 'combo' || !this.isCurrent(captured.generation) || this.state.itemCode !== captured.detail.code || this.busy() || action === null || !adminItemDetailActions.includes(action)) return null;
    const result = action === 'rename' ? this.openEdit(captured.detail) : action === 'customers' ? this.openCustomers(captured.detail)
      : action === 'group' ? await this.openGroup(captured.detail) : this.openDelete(captured.detail);
    return this.isCurrent(captured.generation) ? result : null;
  }
  requestEdit(detail: AdminItemDetail): number | null {
    if (!this.admit(detail)) return null; return this.openEdit(detail);
  }
  private openEdit(detail: AdminItemDetail): number {
    const id = ++this.serial;
    this.editBuffers.set(id, { code: detail.code, name: detail.name });
    this.publish({ dialogs: Object.freeze([...this.state.dialogs, Object.freeze({ id, kind: 'edit', detail, closing: false, validation: null })]) }); return id;
  }
  editValues(id: number): AdminItemDetailEditDraft | null {
    if (!this.isCurrent() || !this.dialog(id) || !this.editBuffers.has(id)) return null; return Object.freeze({ ...this.editBuffers.get(id)! });
  }
  changeEdit(id: number, field: 'code' | 'name', value: string): void {
    if (this.interactive(id)?.kind !== 'edit') return; const buffer = this.editBuffers.get(id); if (buffer) buffer[field] = value;
  }
  requestDelete(detail: AdminItemDetail): number | null {
    if (!this.admit(detail)) return null; return this.openDelete(detail);
  }
  private openDelete(detail: AdminItemDetail): number {
    const id = ++this.serial;
    this.publish({ dialogs: Object.freeze([...this.state.dialogs, Object.freeze({ id, kind: 'delete', detail, closing: false })]) }); return id;
  }
  async requestGroup(detail: AdminItemDetail): Promise<number | null> {
    if (!this.admit(detail)) return null; return this.openGroup(detail);
  }
  private async openGroup(detail: AdminItemDetail): Promise<number | null> {
    const generation = this.generation, guard = this.guard(generation); let shown = false; this.publish({ changingGroup: true });
    try {
      guard(); const groups = await this.deps.groups(guard, () => { guard(); return true; }); guard();
      const id = ++this.serial, dialog = Object.freeze({ id, kind: 'group' as const, detail, closing: false, groups: adminItemDetailGroupChoices(detail.item_group, groups), query: '', selected: dartTrim(detail.item_group) });
      // Source clears the loading flag before the sheet is presented.
      shown = true;
      this.publish({ changingGroup: false, dialogs: Object.freeze([...this.state.dialogs, dialog]) }); return this.isCurrent(generation) && !!this.dialog(id) ? id : null;
    } catch (error) { if (this.isCurrent(generation)) this.publish({ notice: { serial: ++this.serial, kind: 'operation', key: 'detail.groups_save_failed', error } }); return null; }
    finally { if (!shown && this.isCurrent(generation)) this.publish({ changingGroup: false }); }
  }
  changeGroupQuery(id: number, query: string): void { if (this.interactive(id)?.kind === 'group') this.patchDialog(id, { query }); }
  selectGroup(id: number, group: string): void {
    const dialog = this.interactive(id); if (dialog?.kind === 'group' && dialog.groups.includes(group)) this.patchDialog(id, { selected: group });
  }
  requestCustomers(detail: AdminItemDetail): number | null {
    if (!this.admit(detail) || adminItemDetailKind(detail) !== 'finished') return null; return this.openCustomers(detail);
  }
  private openCustomers(detail: AdminItemDetail): number {
    const generation = this.generation, guard = this.guard(generation), id = ++this.serial;
    const owner = new AdminItemDetailCustomersController(detail, {
      isCurrent: () => this.isCurrent(generation) && this.dialog(id)?.kind === 'customers', load: this.deps.customers,
      canInteract: () => this.preparingCustomerClose === id
        ? this.isCurrent(generation) && this.state.dialogs[this.state.dialogs.length - 1]?.id === id && !this.closing.has(id)
        : this.interactive(id)?.kind === 'customers',
      setAssigned: async (customer, assigned) => {
        guard(); const result = await this.deps.setCustomer(detail, customer, assigned, guard, () => { guard(); return true; }); guard();
        const updated = retainAdminItemDetailImage(result, detail); this.install(updated); guard(); return updated;
      },
      notice: error => { if (this.isCurrent(generation) && this.dialog(id)) this.publish({ notice: { serial: ++this.serial, kind: 'customer', error } }); },
    });
    this.publish({ dialogs: Object.freeze([...this.state.dialogs, Object.freeze({ id, kind: 'customers', detail, closing: false, owner })]) }); return id;
  }
  /** The genuine native picker host admits its child read after attaching, not while preparing an unmounted sheet. */
  activateCustomers(id: number): boolean {
    const dialog = this.interactive(id); if (dialog?.kind !== 'customers') return false; dialog.owner.start(); return this.isCurrent() && !!this.dialog(id);
  }
  /** true confirms/applies/done; false is source cancel/barrier/back. No command runs during this native-hide phase. */
  prepareClose(id: number, confirm: boolean): AdminItemDetailCloseTicket | null {
    const dialog = this.interactive(id); if (!dialog) return null;
    let value: CloseDecision['value'] = null;
    if (dialog.kind === 'edit' && confirm) {
      const buffer = this.editBuffers.get(id)!; const draft = adminItemDetailEditDraft(buffer.code, buffer.name);
      if (typeof draft === 'string') { this.patchDialog(id, { validation: draft }); return null; } value = draft;
    } else if (dialog.kind === 'delete') value = confirm;
    else if (dialog.kind === 'group' && confirm) { if (!dartTrim(dialog.selected)) return null; value = dialog.selected; }
    else if (dialog.kind === 'customers') {
      const settling = {}; this.settling = settling; this.preparingCustomerClose = id;
      try { const result = dialog.owner.prepareClose(confirm); if (result === false) return null; value = result; }
      finally { if (this.preparingCustomerClose === id) this.preparingCustomerClose = null; if (this.settling === settling) this.settling = null; }
    }
    if (!this.isCurrent() || this.closing.has(id) || this.dialog(id) !== dialog) return null;
    const ticket = Object.freeze({ id, kind: dialog.kind }); this.closeTickets.set(ticket, { generation: this.generation, dialog, value }); this.closing.set(id, ticket);
    this.patchDialog(id, { closing: true }); return ticket;
  }
  /** Call only from the actual native completion callback. A forged/replayed/older presentation ticket is rejected. */
  async completeClose(ticket: AdminItemDetailCloseTicket): Promise<AdminItemDetailDecisionResult> {
    const captured = this.closeTickets.get(ticket), none = Object.freeze({ changed: false, removed: false });
    if (!captured || !this.isCurrent(captured.generation) || this.closing.get(ticket.id) !== ticket) return none;
    this.closeTickets.delete(ticket); this.closing.delete(ticket.id); this.editBuffers.delete(ticket.id); const settling = {}; this.settling = settling;
    const { dialog, value, generation } = captured, guard = this.guard(generation);
    if (dialog.kind === 'customers') dialog.owner.dispose();
    if (!this.isCurrent(generation)) { if (this.settling === settling) this.settling = null; return none; }
    const rename = dialog.kind === 'edit' && value !== null && !adminItemDetailEditUnchanged(value as AdminItemDetailEditDraft, dialog.detail);
    const move = dialog.kind === 'group' && typeof value === 'string' && !adminItemDetailSameGroup(value, dialog.detail.item_group);
    const remove = dialog.kind === 'delete' && value === true;
    this.publish({ dialogs: Object.freeze(this.state.dialogs.filter(item => item.id !== dialog.id)), ...(rename ? { saving: true } : {}), ...(move ? { changingGroup: true } : {}), ...(remove ? { deleting: true } : {}) });
    try {
      guard();
      if (dialog.kind === 'customers') {
        if (value !== null) this.install(value as AdminItemDetail, false, false); guard(); return Object.freeze({ changed: this.state.changed, removed: false });
      }
      if (rename) {
        guard(); const pending = this.deps.rename(dialog.detail, value as AdminItemDetailEditDraft, guard); if (this.settling === settling) this.settling = null;
        const updated = retainAdminItemDetailImage(await pending, dialog.detail); guard(); this.install(updated, true); guard();
        this.publish({ notice: { serial: ++this.serial, kind: 'key', key: 'detail.item_saved' } });
      } else if (move) {
        guard(); const pending = this.deps.moveGroup(dialog.detail, value as string, guard, () => { guard(); return true; }); if (this.settling === settling) this.settling = null;
        const updated = retainAdminItemDetailImage(await pending, dialog.detail); guard(); this.install(updated); guard();
        this.publish({ notice: { serial: ++this.serial, kind: 'key', key: 'detail.group_updated' } });
      } else if (remove) {
        guard(); const pending = this.deps.remove(dialog.detail, guard); if (this.settling === settling) this.settling = null; await pending; guard(); this.detachRead();
        this.publish({ phase: 'removed', changed: true, notice: { serial: ++this.serial, kind: 'key', key: 'detail.item_deleted' } });
        return Object.freeze({ changed: true, removed: this.isCurrent(generation) });
      }
      guard(); return Object.freeze({ changed: this.state.changed, removed: false });
    } catch (error) {
      if (this.isCurrent(generation)) {
        const message = dialog.kind === 'edit' ? String(error) : null;
        if (this.isCurrent(generation)) this.publish({ notice: dialog.kind === 'edit' ? { serial: ++this.serial, kind: 'raw', message: message! }
          : { serial: ++this.serial, kind: 'operation', key: dialog.kind === 'delete' ? 'detail.item_delete_failed' : 'detail.groups_save_failed', error } });
      }
      return none;
    } finally {
      if (this.settling === settling) this.settling = null;
      if ((rename || move || remove) && this.isCurrent(generation)) this.publish({ ...(rename ? { saving: false } : {}), ...(move ? { changingGroup: false } : {}), ...(remove ? { deleting: false } : {}) });
    }
  }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  private stop(): void {
    this.detachRead(); this.settling = null; this.preparingCustomerClose = null; this.closeTickets = new WeakMap(); this.closing.clear(); this.editBuffers.clear(); this.menuTickets = new WeakMap();
    for (const dialog of this.state.dialogs) if (dialog.kind === 'customers') dialog.owner.dispose();
  }
  invalidate(): void {
    if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.stop(); this.state = initial(this.initialCode); this.publish({ phase: 'invalidated' });
  }
  dispose(): void {
    this.active = false; this.generation++; this.stop(); this.state = initial(this.initialCode); this.publish({ phase: this.retired ? 'invalidated' : 'loading' });
  }
}
