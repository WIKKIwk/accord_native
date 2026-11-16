import type { SupplierItem } from '../shared/catalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartTrim } from './dartJsonString';
import { itemGroupsCreateParent, itemGroupsMerge, itemGroupsMoveChoices, itemGroupsPickerPage } from './itemGroupsModel';
import type { AdminItemGroup, AdminItemGroupTreeEntry } from './itemGroupModel';
export type ItemGroupsPhase = 'loading' | 'ready' | 'error';
export type ItemGroupsDialog = { id: number; kind: 'create' | 'move'; phase: ItemGroupsPhase; groups: string[];
  name: string; parent: string | null; group: string | null; isGroup: boolean; saving: boolean };
export type ItemGroupsPicker = { id: number; dialogId: number | null; field: 'createParent' | 'moveGroup' | 'moveParent';
  groups: readonly string[]; title: string; hint: string; query: string; loadedQuery: string; limit: number };
export type ItemGroupsNotice = { id: number; key: string; values: Record<string, string>; success: boolean };
export type ItemGroupsState = { valid: boolean; parentsPhase: ItemGroupsPhase; treePhase: ItemGroupsPhase; parents: string[]; tree: AdminItemGroupTreeEntry[];
  tab: 'tree' | 'items'; expanded: ReadonlySet<string>; filterExpanded: boolean; selectedGroup: string | null; loadedGroup: string | null;
  items: SupplierItem[]; itemsLoading: boolean; loadingMore: boolean; hasMore: boolean; itemsError: boolean;
  dialog: ItemGroupsDialog | null; picker: ItemGroupsPicker | null; notice: ItemGroupsNotice | null };
export type ItemGroupsDependencies = { isCurrent: () => boolean; canInteract?: () => boolean;
  groups: (guard: () => void, witness: () => boolean) => Promise<string[]>;
  tree: (guard: () => void, witness: () => boolean) => Promise<AdminItemGroupTreeEntry[]>;
  items: (group: string, offset: number, guard: () => void, witness: () => boolean) => Promise<SupplierItem[]>;
  create: (name: string, parent: string, isGroup: boolean, guard: () => void) => Promise<AdminItemGroup>;
  move: (name: string, parent: string, guard: () => void) => Promise<AdminItemGroup> };
const initial = (): ItemGroupsState => ({ valid: true, parentsPhase: 'loading', treePhase: 'loading', parents: [], tree: [], tab: 'tree',
  expanded: new Set(), filterExpanded: false, selectedGroup: null, loadedGroup: null, items: [], itemsLoading: false,
  loadingMore: false, hasMore: false, itemsError: false, dialog: null, picker: null, notice: null });
/** V2 AdminItemGroupCreateScreen and its two tab/dialog owners, under one original account lifetime. */
export class ItemGroupsController {
  private state = initial(); private listeners = new Set<() => void>(); private active = false; private retired = false;
  private interactionGeneration = 0;
  private pickerTimer: ReturnType<typeof setTimeout> | undefined;
  private epoch = 0; private read = 0; private itemRead = 0; private sequence = 0; private optimistic: string[] = [];
  constructor(private readonly deps: ItemGroupsDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current(epoch = this.epoch): boolean {
    if (!this.active || this.retired || epoch !== this.epoch) return false;
    if (!isSynchronouslyTrue(this.deps.isCurrent)) { this.retired = true; return false; }
    return true;
  }
  private interact() { return this.current() && (!this.deps.canInteract || isSynchronouslyTrue(this.deps.canInteract)); }
  suspendInteraction() { this.interactionGeneration++; this.clearPickerTimer(); this.publish({ dialog: null, picker: null }); }
  private clearPickerTimer() { if (this.pickerTimer !== undefined) clearTimeout(this.pickerTimer); this.pickerTimer = undefined; }
  private dialogCurrent(id: number): boolean { return this.state.dialog?.id === id; }
  private publish(change: Partial<ItemGroupsState>) { if (!this.active) return; this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private boundary(epoch: number) {
    const witness = () => this.current(epoch); return { witness, guard: () => { if (!witness()) throw new Error('Item group session changed'); } };
  }
  start() { if (this.active) return; this.active = true; this.epoch++; if (!this.current()) { this.invalidate(); return; } void this.reload(); }
  dispose() { this.clearPickerTimer(); this.active = false; this.epoch++; this.read++; this.itemRead++; this.state = { ...this.state, dialog: null, picker: null }; }
  invalidate() { this.clearPickerTimer(); this.retired = true; this.publish({ ...initial(), valid: false }); this.epoch++; this.read++; this.itemRead++; }
  async reload() {
    if (!this.current()) return; const serial = ++this.read, epoch = this.epoch, { guard, witness } = this.boundary(epoch);
    this.publish({ parentsPhase: 'loading', treePhase: 'loading', expanded: new Set() });
    await Promise.all([
      this.deps.groups(guard, witness).then(groups => { if (this.current(epoch) && serial === this.read) this.publish({ parents: itemGroupsMerge(groups, this.optimistic), parentsPhase: 'ready' }); },
        () => { if (this.current(epoch) && serial === this.read) this.publish({ parentsPhase: 'error' }); }),
      this.deps.tree(guard, witness).then(tree => { if (this.current(epoch) && serial === this.read) this.publish({ tree, treePhase: 'ready' }); },
        () => { if (this.current(epoch) && serial === this.read) this.publish({ treePhase: 'error' }); }),
    ]);
  }
  setTab(tab: 'tree' | 'items') { if (this.interact()) this.publish({ tab }); }
  toggle(name: string) { if (!this.interact()) return; const expanded = new Set(this.state.expanded); if (!expanded.delete(name)) expanded.add(name); this.publish({ expanded }); }
  toggleFilter() { if (this.interact()) this.publish({ filterExpanded: !this.state.filterExpanded }); }
  selectGroup(value: string) { if (!this.interact()) return; const group = dartTrim(value); this.publish({ selectedGroup: group || null, tab: 'items', filterExpanded: false });
    if (group && group !== this.state.loadedGroup) void this.loadItems(true); }
  async loadItems(replace: boolean) {
    const group = this.state.selectedGroup;
    if (!this.current() || !group || (!replace && (this.state.itemsLoading || this.state.loadingMore || !this.state.hasMore))) return;
    const serial = ++this.itemRead, epoch = this.epoch, { guard, witness } = this.boundary(epoch);
    const offset = replace ? 0 : this.state.items.length;
    this.publish(replace ? { loadedGroup: group, items: [], itemsLoading: true, loadingMore: false, hasMore: false, itemsError: false } : { loadingMore: true });
    try {
      const page = await this.deps.items(group, offset, guard, witness);
      if (this.current(epoch) && serial === this.itemRead && group === this.state.selectedGroup) this.publish({ items: replace ? page : [...this.state.items, ...page],
        itemsLoading: false, loadingMore: false, hasMore: page.length === 40, itemsError: false });
    } catch { if (this.current(epoch) && serial === this.itemRead && group === this.state.selectedGroup) this.publish({ itemsLoading: false, loadingMore: false, hasMore: false, itemsError: true }); }
  }
  async open(kind: 'create' | 'move') {
    if (!this.interact() || this.state.dialog) return;
    const id = ++this.sequence, epoch = this.epoch, { guard, witness } = this.boundary(epoch);
    this.publish({ dialog: { id, kind, phase: 'loading', groups: [], name: '', group: null, parent: null, isGroup: true, saving: false } });
    try {
      const groups = itemGroupsMerge(await this.deps.groups(guard, witness), this.optimistic);
      if (this.current(epoch) && this.dialogCurrent(id)) this.updateDialog({ groups, phase: 'ready', parent: kind === 'create' ? itemGroupsCreateParent(groups, null) : null });
    } catch { if (this.current(epoch) && this.dialogCurrent(id)) this.updateDialog({ phase: 'error' }); }
  }
  private updateDialog(change: Partial<ItemGroupsDialog>) { if (this.state.dialog) this.publish({ dialog: { ...this.state.dialog, ...change } }); }
  setName(id: number, name: string) { if (this.interact() && this.dialogCurrent(id) && this.state.dialog?.kind === 'create' && !this.state.picker) this.updateDialog({ name }); }
  setIsGroup(id: number, isGroup: boolean) { if (this.interact() && this.dialogCurrent(id) && this.state.dialog && !this.state.dialog.saving && !this.state.picker) this.updateDialog({ isGroup }); }
  closeDialog(id: number) { if (this.interact() && this.dialogCurrent(id) && !this.state.picker) this.publish({ dialog: null }); }
  openPicker(id: number, field: ItemGroupsPicker['field']) {
    const dialog = this.state.dialog;
    if (!this.interact() || !dialog || dialog.id !== id || dialog.phase !== 'ready' || dialog.saving || this.state.picker) return;
    const choices = itemGroupsMoveChoices(dialog.groups, dialog.group);
    const groups = field === 'createParent' ? dialog.groups : field === 'moveGroup' ? choices.groups : choices.parents;
    if (!groups.length) return;
    this.publish({ picker: { id: ++this.sequence, dialogId: dialog.id, field, groups: [...groups], query: '', loadedQuery: '', limit: 50,
      title: field === 'createParent' ? 'item_group.parent_select' : field === 'moveGroup' ? 'item_group.movable_group' : 'item_group.new_parent',
      hint: field === 'createParent' ? 'item_group.parent_search' : field === 'moveGroup' ? 'item_group.group_search' : 'item_group.parent_search_short' } });
  }
  pickerSearch(id: number, query: string) {
    if (!this.interact() || this.state.picker?.id !== id) return;
    this.clearPickerTimer(); this.publish({ picker: { ...this.state.picker, query } });
    this.pickerTimer = setTimeout(() => {
      this.pickerTimer = undefined;
      if (this.interact() && this.state.picker?.id === id) this.publish({ picker: { ...this.state.picker, loadedQuery: query, limit: 50 } });
    }, 220);
  }
  pickerMore(id: number) { if (this.interact() && this.state.picker?.id === id) this.publish({ picker: { ...this.state.picker, limit: this.state.picker.limit + 50 } }); }
  pickerRows() { return this.state.picker ? itemGroupsPickerPage(this.state.picker.groups, this.state.picker.loadedQuery, this.state.picker.limit, this.state.picker.query) : { items: [], hasMore: false }; }
  finishPicker(id: number, value: string | null) {
    const picker = this.state.picker, dialog = this.state.dialog;
    if (!this.interact() || picker?.id !== id || !dialog || picker.dialogId !== dialog.id) return;
    this.clearPickerTimer(); if (value === null || !picker.groups.includes(value)) { this.publish({ picker: null }); return; }
    if (picker.field === 'moveGroup') {
      const parents = itemGroupsMoveChoices(dialog.groups, value).parents;
      this.publish({ picker: null, dialog: { ...dialog, group: value, ...(dialog.parent === value ? { parent: parents.includes('All Item Groups') ? 'All Item Groups' : null } : {}) } });
    } else this.publish({ picker: null, dialog: { ...dialog, parent: value } });
  }
  private addOptimistic(group: AdminItemGroup) { if (group.is_group) this.optimistic.push(group.name, ...(group.item_group_name !== group.name ? [group.item_group_name] : [])); }
  private notice(key: string, values: Record<string, string>, success: boolean) { this.publish({ notice: { id: ++this.sequence, key, values, success } }); }
  dismissNotice(id: number) { if (this.current() && this.state.notice?.id === id) this.publish({ notice: null }); }
  async submit(id: number) {
    const dialog = this.state.dialog;
    if (!this.interact() || dialog?.id !== id || dialog.saving || this.state.picker) return;
    const name = dartTrim(dialog.kind === 'create' ? dialog.name : dialog.group ?? ''), parent = dartTrim(dialog.parent ?? '');
    if (!name || !parent) return;
    const epoch = this.epoch, interaction = this.interactionGeneration, boundary = this.boundary(epoch);
    const guard = () => { boundary.guard(); if (!this.interact() || interaction !== this.interactionGeneration) throw new Error('Item group interaction changed'); };
    this.updateDialog({ saving: true });
    try {
      guard(); const group = dialog.kind === 'create' ? await this.deps.create(name, parent, dialog.isGroup, guard) : await this.deps.move(name, parent, guard);
      guard(); if (!this.current(epoch)) return;
      if (dialog.kind === 'create' || this.dialogCurrent(id)) {
        this.addOptimistic(group); void this.reload(); this.notice(dialog.kind === 'create' ? 'item_group.saved' : 'item_group.parent_updated',
          { name: dialog.kind === 'create' ? group.name : group.item_group_name }, true);
      }
      if (this.dialogCurrent(id)) {
        if (dialog.kind === 'create') this.publish({ dialog: null }); else this.updateDialog({ saving: false });
      }
    } catch (error) {
      if (this.current(epoch) && this.dialogCurrent(id)) { this.updateDialog({ saving: false });
        this.notice(dialog.kind === 'create' ? 'item_group.create_failed' : 'item_group.parent_update_failed', { error: error instanceof Error && error.name === 'Error' ? `Exception: ${error.message}` : String(error) }, false); }
    }
  }
}
