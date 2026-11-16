import type { SupplierItem } from '../shared/catalogApi';
import type { AdminItemCreateMemoryCache } from './adminItemCreateCache';
import { AdminItemCreateFormController, type AdminItemCreateDialog } from './adminItemCreateFormController';
import { AdminItemCreateListController } from './adminItemCreateListController';
import { adminItemCreateCustomerSubtitle, type AdminItemCreateCustomer } from './adminItemCreateModel';
import { AdminItemCreatePickerController } from './adminItemCreatePickerController';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminItemCreatePicker = Readonly<{ id: number; dialogId: number; kind: 'group' | 'uom'; controller: AdminItemCreatePickerController<string> }> |
  Readonly<{ id: number; dialogId: number; kind: 'customer'; controller: AdminItemCreatePickerController<AdminItemCreateCustomer> }>;
type FormDeps = ConstructorParameters<typeof AdminItemCreateFormController>[0];
type ListDeps = ConstructorParameters<typeof AdminItemCreateListController>[0];
type ControllerDeps = { isCurrent: () => boolean; namespace: string; cache: AdminItemCreateMemoryCache; form: Omit<FormDeps, 'isCurrent' | 'clearItemCache' | 'reloadItems'>;
  list: Omit<ListDeps, 'isCurrent' | 'namespace' | 'cache'>;
  customers: (query: string, limit: number, offset: number, guard: () => void, witness: () => boolean) => Promise<readonly AdminItemCreateCustomer[]>;
  createCustomer?: (query: string) => Promise<AdminItemCreateCustomer | null>; onReturnCreated?: (item: SupplierItem) => void };

/** Screen-owned coordination. Native dialog/sheet acknowledgements are required, never replaced by elapsed timers. */
export class AdminItemCreateController {
  readonly list: AdminItemCreateListController; readonly form: AdminItemCreateFormController;
  private picker: AdminItemCreatePicker | null = null; private pickerSerial = 0; private unsubscribePicker: (() => void) | null = null;
  private readonly listeners = new Set<() => void>(); private active = false; private publishing = false;
  private returned: { dialogId: number; generation: number; item: SupplierItem } | null = null;
  private closingDialog: { id: number; generation: number } | null = null;
  private state: ReturnType<AdminItemCreateController['snapshot']>;
  constructor(private readonly deps: ControllerDeps) {
    this.list = new AdminItemCreateListController({ ...deps.list, isCurrent: deps.isCurrent, namespace: deps.namespace, cache: deps.cache });
    this.form = new AdminItemCreateFormController({ ...deps.form, isCurrent: deps.isCurrent,
      clearItemCache: () => deps.cache.clearList(deps.namespace), reloadItems: () => this.list.reload() });
    this.state = this.snapshot(); this.list.subscribe(this.publish); this.form.subscribe(this.publish);
  }
  private snapshot() { return { list: this.list.getSnapshot(), form: this.form.getSnapshot(), picker: this.picker,
    pickerState: this.picker?.controller.getSnapshot() ?? null, closingDialog: this.closingDialog, generation: this.form.interactionGeneration }; }
  private publish = () => { this.state = this.snapshot(); const previous = this.publishing; this.publishing = true;
    try { for (const listener of [...this.listeners]) listener(); } finally { this.publishing = previous; } };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isCurrent = (generation?: number) => this.active && this.form.isCurrent(generation) && this.list.isCurrent();
  start() { if (this.active) return; this.active = true; this.form.start(); this.list.start(); this.publish(); }
  openDialog() { if (!this.publishing && this.active && !this.picker && !this.closingDialog && !this.form.getSnapshot().dialog) this.form.openDialog(); }
  closeDialog(dialog: AdminItemCreateDialog, outsideOrBack = false) {
    if (this.publishing || !this.isCurrent(dialog.generation) || this.picker || this.closingDialog || !this.form.dialogCurrent(dialog) || !outsideOrBack && dialog.savingView) return;
    this.closingDialog = { id: dialog.id, generation: dialog.generation }; if (!this.form.closeDialog(dialog, outsideOrBack)) this.closingDialog = null;
  }
  async save(dialog: AdminItemCreateDialog) {
    if (this.publishing || !this.isCurrent(dialog.generation) || this.picker) return;
    const item = await this.form.save(dialog);
    if (!this.isCurrent(dialog.generation) || this.form.getSnapshot().dialog?.id !== dialog.id) return;
    if (item === null) { this.form.refreshDialog(dialog.id); return; }
    // Install the original result before publishing dialog removal. A reentrant
    // native callback cannot acknowledge until removal publication has settled.
    this.returned = { dialogId: dialog.id, generation: dialog.generation, item };
    this.closingDialog = { id: dialog.id, generation: dialog.generation };
    if (!this.form.finishSaveDialog(dialog.id, item)) { this.returned = null; this.closingDialog = null; }
  }
  completeDialog(dialogId: number) {
    const closing = this.closingDialog, result = this.returned;
    if (this.publishing || !closing || closing.id !== dialogId || !this.isCurrent(closing.generation)) return;
    this.closingDialog = null; this.returned = null; this.publish();
    if (result?.dialogId === dialogId && this.deps.form.returnOnCreate && this.isCurrent(result.generation)) this.deps.onReturnCreated?.(result.item);
  }
  openPicker(kind: AdminItemCreatePicker['kind'], dialog: AdminItemCreateDialog) {
    if (this.publishing || !this.isCurrent(dialog.generation) || !this.form.dialogCurrent(dialog) || dialog.savingView || this.picker || this.closingDialog) return;
    const state = this.form.getSnapshot();
    if (kind === 'group' && (state.groups.loading || state.groups.error !== null) || kind === 'uom' && (state.uoms.loading || state.uoms.error !== null || !state.uoms.value.length)) return;
    const id = ++this.pickerSerial;
    const current = () => this.isCurrent(dialog.generation) && this.picker?.id === id;
    const selected = (item: string | AdminItemCreateCustomer | null) => {
      if (!current()) return; this.unsubscribePicker?.(); this.unsubscribePicker = null; this.picker = null;
      if (item !== null && this.form.getSnapshot().dialog?.id === dialog.id) {
        if (kind === 'group') this.form.setGroup(dialog.id, item as string);
        else if (kind === 'uom') this.form.setUom(dialog.id, item as string);
        else this.form.setCustomer(dialog.id, item as AdminItemCreateCustomer);
      } else if (this.form.getSnapshot().dialog?.id === dialog.id) this.form.refreshDialog(dialog.id);
      this.publish();
    };
    if (kind === 'customer') {
      this.picker = { id, dialogId: dialog.id, kind, controller: new AdminItemCreatePickerController({ isCurrent: current,
        fetch: this.deps.customers, title: value => value.name, subtitle: adminItemCreateCustomerSubtitle, onClosed: selected, create: this.deps.createCustomer,
        cache: { store: this.deps.cache, namespace: this.deps.namespace, isCustomer: (value): value is AdminItemCreateCustomer => true } }) };
    } else {
      const values = kind === 'group' ? state.groups.value : state.uoms.value;
      this.picker = { id, dialogId: dialog.id, kind, controller: new AdminItemCreatePickerController({ isCurrent: current,
        fetch: async (query, limit, offset, guard) => { guard(); const normalized = dartPartialLower(dartTrim(query)); const filtered = normalized ? values.filter(value => dartPartialLower(value).includes(normalized)) : values; guard(); return filtered.slice(offset, offset + limit); },
        title: value => value, subtitle: () => '', onClosed: selected }) };
    }
    this.unsubscribePicker = this.picker.controller.subscribe(this.publish); this.picker.controller.start(); this.publish();
  }
  dispose() { this.active = false; this.returned = null; this.closingDialog = null; this.unsubscribePicker?.(); this.unsubscribePicker = null; this.picker?.controller.dispose(); this.picker = null; this.form.dispose(); this.list.dispose(); this.publish(); }
  invalidate() { this.active = false; this.returned = null; this.closingDialog = null; this.unsubscribePicker?.(); this.unsubscribePicker = null; this.picker?.controller.invalidate(); this.picker = null; this.form.invalidate(); this.list.invalidate(); this.publish(); }
}
