import type { SupplierItem } from '../shared/catalogApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { adminItemGroupRequiresCustomer, type AdminItemGroupTreeEntry } from './itemGroupModel';
import { adminItemCreateFailure, orderAdminItemCreateGroups, syncAdminItemCreateGroup, syncAdminItemCreateUom, validateAdminItemCreate,
  type AdminItemCreateCustomer, type AdminItemCreateDraft, type AdminItemCreateNotice } from './adminItemCreateModel';
import { AdminItemCreateScope } from './adminItemCreateScope';

export type AdminItemCreateDialog = Readonly<{ id: number; generation: number; version: number; savingView: boolean;
  customerView: AdminItemCreateCustomer | null; finishedView: boolean }>;
type Catalog<T> = Readonly<{ loading: boolean; value: readonly T[]; error: unknown | null }>;
export type AdminItemCreateFormSnapshot = Readonly<{ valid: boolean; draft: AdminItemCreateDraft; fillVersion: number; tree: readonly AdminItemGroupTreeEntry[];
  groups: Catalog<string>; uoms: Catalog<string>; saving: boolean; dialog: AdminItemCreateDialog | null; notice: AdminItemCreateNotice | null }>;
type Read<T> = (guard: () => void, witness: () => boolean) => Promise<readonly T[]>;
type FormDeps = { isCurrent: () => boolean; sales: boolean; initialItemGroup: string; returnOnCreate: boolean;
  tree: Read<AdminItemGroupTreeEntry>; groups: Read<string>; uoms: Read<string>;
  duplicateItems: (code: string, guard: () => void, witness: () => boolean) => Promise<readonly SupplierItem[]>;
  create: (input: { code: string; name: string; uom: string; itemGroup: string; customerRef: string }, guard: () => void) => Promise<SupplierItem>;
  clearItemCache: () => void; reloadItems: () => Promise<void> };

/** @v2 _AdminItemCreateScreenState and _ItemCreateDialogCard
 * The StatefulBuilder's visual saving/customer snapshot is intentionally separate
 * from the screen's live command lock and shared TextEditingControllers.
 */
export class AdminItemCreateFormController {
  private readonly scope: AdminItemCreateScope; private readonly listeners = new Set<() => void>();
  private state: AdminItemCreateFormSnapshot; private dialogSerial = 0; private noticeSerial = 0; private catalogSerial = 0; private publishing = false;
  private uomFuture: Promise<readonly string[]> | null = null;
  constructor(private readonly deps: FormDeps) {
    this.scope = new AdminItemCreateScope(deps.isCurrent);
    this.state = { valid: true, draft: { code: '', name: '', group: dartTrim(deps.initialItemGroup), uom: '', customer: null }, fillVersion: 0, tree: [],
      groups: { loading: true, value: [], error: null }, uoms: { loading: true, value: [], error: null }, saving: false, dialog: null, notice: null };
  }
  get interactionGeneration() { return this.scope.interactionGeneration; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isCurrent = (generation?: number) => this.scope.current(generation);
  dialogCurrent(dialog: AdminItemCreateDialog) { return this.state.dialog === dialog && this.isCurrent(dialog.generation); }
  private publish(patch: Partial<AdminItemCreateFormSnapshot>) {
    this.state = { ...this.state, ...patch }; const previous = this.publishing; this.publishing = true;
    try { for (const listener of [...this.listeners]) listener(); } finally { this.publishing = previous; }
  }
  private notice(value: Pick<AdminItemCreateNotice, 'literal' | 'key' | 'values'>, tone: 'success' | 'error' = 'error') {
    this.publish({ notice: Object.freeze({ ...value, serial: ++this.noticeSerial, surface: 'top', tone }) });
  }
  start() {
    if (this.scope.isActive) return; if (!this.scope.start()) { this.invalidate(); return; } const serial = ++this.catalogSerial;
    this.publish({ valid: true, groups: { loading: true, value: [], error: null }, uoms: { loading: true, value: [], error: null } });
    void this.loadGroups(serial); this.uomFuture = this.loadUoms(serial); void this.uomFuture.catch(() => {});
  }
  private updateGroup(group: string) {
    const changed = this.state.draft.group !== group, dialog = this.state.dialog;
    this.publish({ draft: { ...this.state.draft, group }, ...(changed && dialog ? { dialog: Object.freeze({ ...dialog,
      finishedView: adminItemGroupRequiresCustomer(group, this.state.tree) }) } : {}) });
  }
  private async loadGroups(serial: number) {
    const operation = this.scope.begin(() => serial === this.catalogSerial);
    try {
      let groups: readonly string[] | null = null;
      try {
        operation.guard(); const tree = await operation.wait(this.deps.tree(operation.guard, operation.current)); operation.guard(); this.publish({ tree });
        const ordered = orderAdminItemCreateGroups(tree).filter(group => !this.deps.sales || adminItemGroupRequiresCustomer(group, tree)); operation.guard();
        if (ordered.length) groups = ordered;
      } catch { if (!operation.current()) return; }
      if (groups === null) {
        operation.guard(); const names = await operation.wait(this.deps.groups(operation.guard, operation.current)); operation.guard();
        groups = names.filter(group => !this.deps.sales || adminItemGroupRequiresCustomer(group, this.state.tree)); operation.guard();
      }
      this.updateGroup(syncAdminItemCreateGroup(this.state.draft.group, groups));
      if (operation.current()) this.publish({ groups: { loading: false, value: Object.freeze([...groups]), error: null } });
    } catch (error) { if (operation.current()) this.publish({ groups: { loading: false, value: [], error } }); }
    finally { operation.expire(); }
  }
  private async loadUoms(serial: number): Promise<readonly string[]> {
    const operation = this.scope.begin(() => serial === this.catalogSerial);
    try {
      operation.guard(); const values = await operation.wait(this.deps.uoms(operation.guard, operation.current)); operation.guard();
      const uom = syncAdminItemCreateUom(this.state.draft.uom, values); operation.guard();
      this.publish({ draft: { ...this.state.draft, uom }, uoms: { loading: false, value: Object.freeze([...values]), error: null } }); return values;
    } catch (error) { if (operation.current()) this.publish({ uoms: { loading: false, value: [], error } }); throw error; }
    finally { operation.expire(); }
  }
  private renderedDialog(id: number, version: number): AdminItemCreateDialog {
    return Object.freeze({ id, generation: this.interactionGeneration, version, savingView: this.state.saving, customerView: this.state.draft.customer,
      finishedView: adminItemGroupRequiresCustomer(this.state.draft.group, this.state.tree) });
  }
  openDialog(): AdminItemCreateDialog | null {
    if (this.publishing || !this.isCurrent()) return null;
    this.publish({ draft: { ...this.state.draft, code: '', name: '', customer: null }, fillVersion: this.state.fillVersion + 1 });
    if (!this.isCurrent()) return null; const dialog = this.renderedDialog(++this.dialogSerial, 1); this.publish({ dialog }); return dialog;
  }
  /** Explicit StatefulBuilder rebuild, not every parent saving/catalog publication. */
  refreshDialog(id: number) {
    const dialog = this.state.dialog; if (this.publishing || !dialog || dialog.id !== id || !this.isCurrent(dialog.generation)) return;
    let group = this.state.draft.group, uom = this.state.draft.uom;
    if (!this.state.groups.loading && this.state.groups.error === null) group = syncAdminItemCreateGroup(group, this.state.groups.value);
    if (!this.state.uoms.loading && this.state.uoms.error === null && this.state.uoms.value.length) uom = syncAdminItemCreateUom(uom, this.state.uoms.value);
    this.publish({ draft: { ...this.state.draft, group, uom } }); if (this.state.dialog?.id === id && this.isCurrent(dialog.generation)) this.publish({ dialog: this.renderedDialog(id, dialog.version + 1) });
  }
  closeDialog(dialog: AdminItemCreateDialog, outsideOrBack = false): boolean {
    if (this.publishing || !this.dialogCurrent(dialog) || !outsideOrBack && dialog.savingView) return false;
    this.publish({ dialog: null }); return true;
  }
  changeField(dialog: AdminItemCreateDialog, field: 'code' | 'name', value: string) {
    if (this.publishing || !this.dialogCurrent(dialog)) return; this.publish({ draft: { ...this.state.draft, [field]: value } });
  }
  setGroup(id: number, group: string) {
    const dialog = this.state.dialog; if (this.publishing || !dialog || dialog.id !== id || !this.isCurrent(dialog.generation)) return;
    this.updateGroup(group); if (!this.isCurrent(dialog.generation)) return;
    if (!adminItemGroupRequiresCustomer(group, this.state.tree)) this.publish({ draft: { ...this.state.draft, customer: null } }); this.refreshDialog(id);
  }
  setUom(id: number, uom: string) { if (!this.publishing && this.state.dialog?.id === id && this.isCurrent()) { this.publish({ draft: { ...this.state.draft, uom } }); this.refreshDialog(id); } }
  setCustomer(id: number, customer: AdminItemCreateCustomer | null) { if (!this.publishing && this.state.dialog?.id === id && this.isCurrent()) { this.publish({ draft: { ...this.state.draft, customer } }); this.refreshDialog(id); } }
  async save(dialog: AdminItemCreateDialog): Promise<SupplierItem | null> {
    if (this.publishing || !this.dialogCurrent(dialog) || this.state.saving) return null;
    const operation = this.scope.begin();
    try {
      let uoms: readonly string[];
      try { if (!this.uomFuture) return null; uoms = await operation.wait(this.uomFuture); }
      catch { if (operation.current()) this.notice({ key: 'item.uom_load_failed' }); return null; }
      if (!operation.current() || this.state.saving) return null;
      const validated = validateAdminItemCreate(this.state.draft, uoms, this.state.tree, this.deps.sales); operation.guard();
      if ('error' in validated) { this.notice(validated.error!); return null; }
      this.publish({ draft: { ...this.state.draft, uom: validated.uom } }); operation.guard();
      // Source captures group/finished before duplicate lookup, and rereads the
      // editable buffers after it completes. The command remains screen-owned.
      this.publish({ saving: true }); operation.guard();
      try {
        const lookupCode = dartTrim(this.state.draft.code);
        if (!validated.finished && lookupCode) {
          const items = await operation.wait(this.deps.duplicateItems(lookupCode, operation.guard, operation.current)); operation.guard();
          if (items.some(item => dartPartialLower(dartTrim(item.code)) === dartPartialLower(lookupCode))) { operation.guard(); this.notice({ key: 'item.already_exists' }); return null; }
        }
        const current = this.state.draft; operation.guard();
        const item = await operation.wait(this.deps.create({ code: validated.finished ? '' : dartTrim(current.code), name: dartTrim(current.name),
          uom: dartTrim(current.uom), itemGroup: validated.group, customerRef: validated.finished ? dartTrim(current.customer?.ref ?? '') : '' }, operation.guard)); operation.guard();
        if (!dartTrim(item.code)) throw new Error('Created item has no code'); operation.guard();
        this.publish({ draft: { ...this.state.draft, code: '', name: '', customer: null }, fillVersion: this.state.fillVersion + 1 }); operation.guard();
        this.deps.clearItemCache(); operation.guard();
        if (!this.deps.returnOnCreate) await operation.wait(this.deps.reloadItems()); operation.guard(); this.notice({ key: 'item.created', values: { name: item.name } }, 'success'); return item;
      } catch (error) { if (operation.current()) this.notice(adminItemCreateFailure(error)); return null; }
      finally { if (operation.current()) this.publish({ saving: false }); }
    } finally { operation.expire(); }
  }
  /** Request original native dialog removal; its owner awaits the actual close acknowledgement before returning a result. */
  finishSaveDialog(dialogId: number, item: SupplierItem): { item: SupplierItem; returnOnCreate: boolean } | null {
    const dialog = this.state.dialog; if (!dialog || dialog.id !== dialogId || !this.isCurrent(dialog.generation)) return null;
    this.publish({ dialog: null }); return { item, returnOnCreate: this.deps.returnOnCreate };
  }
  dispose() { this.scope.dispose(); this.catalogSerial++; this.uomFuture = null; this.publish({ dialog: null, saving: false }); }
  invalidate() { this.scope.invalidate(); this.catalogSerial++; this.uomFuture = null; this.publish({ valid: false, dialog: null, saving: false,
    draft: { code: '', name: '', group: '', uom: '', customer: null }, fillVersion: this.state.fillVersion + 1, tree: [], notice: null,
    groups: { loading: false, value: [], error: null }, uoms: { loading: false, value: [], error: null } }); }
}
