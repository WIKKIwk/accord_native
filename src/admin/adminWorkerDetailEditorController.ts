import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { WarehouseAssignment } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { searchRelevanceScore } from '../qolip/qolipSearchRelevance';
import type { GScaleAdminWarehouse } from '../gscale/gscaleAdminApi';
import type { AdminWorkerDetailMaterial, AdminWorkerDetailResponsibility } from './adminWorkerDetailAssignmentsApi';
import { adminWorkerDetailWarehouseNames } from './adminWorkerDetailModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

type WarehousePicker = { id: number; kind: 'warehouse'; available: readonly string[]; query: string; selected: string | null };
type MaterialPicker = { id: number; kind: 'material'; available: readonly AdminWorkerDetailMaterial[]; query: string; items: readonly AdminWorkerDetailMaterial[];
  loading: boolean; loadingMore: boolean; hasMore: boolean; error: boolean };
export type AdminWorkerDetailEditorPicker = WarehousePicker | MaterialPicker;
export type AdminWorkerDetailEditorDialog = { id: number; kind: 'warehouse'; warehouse: string; name: string } |
  { id: number; kind: 'material'; material: AdminWorkerDetailResponsibility; name: string };
export type AdminWorkerDetailEditorState = { phase: 'content' | 'invalidated'; adding: boolean; removing: string | null;
  picker: AdminWorkerDetailEditorPicker | null; dialog: AdminWorkerDetailEditorDialog | null };
export type AdminWorkerDetailEditorDependencies = {
  mode: 'warehouse' | 'material'; isCurrent: () => boolean; nextId: () => number; name: () => string;
  assignedWarehouses: () => readonly string[]; assignedMaterials: () => readonly AdminWorkerDetailResponsibility[];
  warehouses: (guard: () => void, witness: () => boolean) => Promise<readonly GScaleAdminWarehouse[]>;
  materials: (guard: () => void, witness: () => boolean) => Promise<readonly AdminWorkerDetailMaterial[]>;
  assignWarehouse: (warehouse: string, displayName: string, guard: () => void) => Promise<WarehouseAssignment>;
  unassignWarehouse: (warehouse: string, guard: () => void) => Promise<unknown>;
  reloadWarehouses: (guard: () => void, witness: () => boolean) => Promise<readonly string[]>;
  assignMaterial: (materialId: string, guard: () => void) => Promise<AdminWorkerDetailResponsibility>;
  unassignMaterial: (materialId: string, guard: () => void) => Promise<void>;
  reloadMaterials: (guard: () => void, witness: () => boolean) => Promise<readonly AdminWorkerDetailResponsibility[]>;
  changedWarehouses: (warehouses: readonly string[]) => void; changedMaterials: (materials: readonly AdminWorkerDetailResponsibility[]) => void;
  text: (key: string, values?: Record<string, unknown>) => string;
  notice: (key: string, values?: Record<string, unknown>) => void; rawNotice: (message: string) => void;
  schedule?: (callback: () => void, delay: number) => unknown; cancel?: (handle: unknown) => void;
};
const initial = (): AdminWorkerDetailEditorState => ({ phase: 'content', adding: false, removing: null, picker: null, dialog: null });
const key = (value: string) => dartPartialLower(dartTrim(value));
/** @v2 AdminWarehouseAssignmentEditor
 * One instance per source editor preserves independent adding/removing state and component lifetimes. */
export class AdminWorkerDetailEditorController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0; private pageSerial = 0; private searchTimer: unknown = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminWorkerDetailEditorDependencies) {}
  get interactionGeneration(): number { return this.generation; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkerDetailEditorState>): void { if (this.active) { this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); } }
  start(): void { if (!this.retired) { this.active = true; this.publish({}); } }
  isCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const current = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!current || this.retired) { this.invalidate(); return false; } return true;
  };
  private guard(generation: number): void { if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin worker editor session changed'); }
  private stopped(generation: number): boolean { return generation !== this.generation || !this.isCurrent(); }
  async add(): Promise<void> {
    if (!this.isCurrent() || this.state.adding || this.state.picker || this.state.dialog) return;
    const generation = this.generation, check = () => this.guard(generation), witness = () => { check(); return true; }; this.publish({ adding: true });
    try {
      check();
      if (this.deps.mode === 'warehouse') {
        const catalog = await this.deps.warehouses(check, witness); check();
        const assigned = new Set(this.deps.assignedWarehouses().map(key)); check();
        const available = adminWorkerDetailWarehouseNames(catalog.filter(item => !item.is_group).map(item => item.warehouse).filter(name => !assigned.has(key(name))));
        if (!available.length) { this.deps.notice('warehouse.assignment_available_empty'); check(); this.publish({ adding: false }); return; }
        this.publish({ picker: { id: this.deps.nextId(), kind: 'warehouse', available, query: '', selected: null } });
      } else {
        const catalog = await this.deps.materials(check, witness); check(); const assigned = new Set(this.deps.assignedMaterials().map(item => key(item.material_id))); check();
        const available = catalog.filter(item => item.active && !assigned.has(key(item.id)));
        if (!available.length) { this.deps.rawNotice('Barcha homashyolar allaqachon biriktirilgan'); check(); this.publish({ adding: false }); return; }
        const id = this.deps.nextId(); this.publish({ picker: { id, kind: 'material', available, query: '', items: [], loading: true, loadingMore: false, hasMore: true, error: false } }); check();
        void this.loadMaterialPage(id, true);
      }
    } catch (error) {
      if (this.stopped(generation)) return;
      if (this.deps.mode === 'warehouse') this.deps.notice('warehouse.assign_failed', { error }); else this.deps.rawNotice(`Biriktirilmadi: ${String(error)}`);
      if (!this.stopped(generation)) this.publish({ adding: false });
    }
  }
  dismissPicker(id: number): void {
    if (!this.isCurrent() || this.state.picker?.id !== id) return;
    this.cancelSearch(); this.pageSerial++; this.publish({ picker: null, adding: false });
  }
  search(id: number, query: string): void {
    if (!this.isCurrent() || this.state.picker?.id !== id) return;
    const picker = this.state.picker, generation = this.generation; this.publish({ picker: { ...picker, query } });
    if (picker.kind === 'material' && !this.stopped(generation)) {
      this.cancelSearch();
      this.searchTimer = (this.deps.schedule ?? setTimeout)(() => { this.searchTimer = null; if (!this.stopped(generation)) void this.loadMaterialPage(id, true); }, 220);
    }
  }
  visibleWarehouses(): readonly string[] {
    const picker = this.state.picker; return picker?.kind === 'warehouse' ? picker.available.filter(name => !key(picker.query) || dartPartialLower(name).includes(key(picker.query))) : [];
  }
  visibleMaterials(): readonly AdminWorkerDetailMaterial[] {
    const picker = this.state.picker; if (picker?.kind !== 'material' || !dartTrim(picker.query) || picker.items.length < 2) return picker?.kind === 'material' ? picker.items : [];
    return picker.items.map((item, index) => ({ item, index, score: searchRelevanceScore(picker.query, item.name, [`${item.variants.length} mikron varianti`]) }))
      .sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.item);
  }
  selectWarehouse(id: number, warehouse: string): void {
    if (this.isCurrent() && this.state.picker?.id === id && this.state.picker.kind === 'warehouse' && this.state.picker.available.includes(warehouse)) this.publish({ picker: { ...this.state.picker, selected: warehouse } });
  }
  async confirmWarehouse(id: number): Promise<void> {
    if (!this.isCurrent() || this.state.picker?.id !== id || this.state.picker.kind !== 'warehouse' || this.state.picker.selected === null) return;
    const generation = this.generation, check = () => this.guard(generation), witness = () => { check(); return true; }, warehouse = this.state.picker.selected;
    this.publish({ picker: null });
    try {
      check(); const assignment = await this.deps.assignWarehouse(warehouse, this.deps.name(), check); check();
      const updated = await this.deps.reloadWarehouses(check, witness); check();
      if (!updated.some(name => key(name) === key(assignment.warehouse))) throw new MobileApiException({ code: 'warehouse_assignment_not_confirmed', message: this.deps.text('warehouse.assignment_not_confirmed') });
      this.deps.changedWarehouses(adminWorkerDetailWarehouseNames(updated)); check(); this.deps.notice('warehouse.assigned', { warehouse: assignment.warehouse });
    } catch (error) { if (!this.stopped(generation)) this.deps.notice('warehouse.assign_failed', { error }); }
    finally { if (!this.stopped(generation)) this.publish({ adding: false }); }
  }
  private async loadMaterialPage(id: number, reset: boolean): Promise<void> {
    if (!this.isCurrent() || this.state.picker?.id !== id || this.state.picker.kind !== 'material') return;
    const picker = this.state.picker;
    if (!reset && (picker.loading || picker.loadingMore || !picker.hasMore)) return;
    const generation = this.generation, serial = ++this.pageSerial, query = key(picker.query), offset = reset ? 0 : picker.items.length;
    this.publish({ picker: { ...picker, ...(reset ? { loading: true, loadingMore: false, items: [], error: false, hasMore: true } : { loadingMore: true }) } });
    try {
      // Source loadPage is async even though its page is selected from the already loaded catalog.
      const page = await Promise.resolve(picker.available.filter(item => dartPartialLower(item.name).includes(query)).slice(offset, offset + 50));
      if (this.stopped(generation) || serial !== this.pageSerial || this.state.picker?.id !== id || this.state.picker.kind !== 'material') return;
      const current = this.state.picker;
      this.publish({ picker: { ...current, items: reset ? page : [...current.items, ...page], hasMore: page.length >= 50, loading: false, loadingMore: false, error: false } });
    } catch {
      if (!this.stopped(generation) && serial === this.pageSerial && this.state.picker?.id === id && this.state.picker.kind === 'material') this.publish({ picker: { ...this.state.picker, loading: false, loadingMore: false, error: true } });
    }
  }
  materialScroll(id: number, extentAfter: number): void { if (extentAfter <= 240) void this.loadMaterialPage(id, false); }
  retryMaterial(id: number): void { void this.loadMaterialPage(id, true); }
  async selectMaterial(id: number, material: AdminWorkerDetailMaterial): Promise<void> {
    if (!this.isCurrent() || this.state.picker?.id !== id || this.state.picker.kind !== 'material' || !this.state.picker.items.includes(material)) return;
    const generation = this.generation, check = () => this.guard(generation), witness = () => { check(); return true; };
    this.cancelSearch(); this.pageSerial++; this.publish({ picker: null });
    try {
      check(); const saved = await this.deps.assignMaterial(material.id, check); check(); const updated = await this.deps.reloadMaterials(check, witness); check();
      if (!updated.some(item => key(item.material_id) === key(saved.material_id))) throw new MobileApiException({ code: 'responsibility_not_confirmed', message: 'Biriktirish tasdiqlanmadi' });
      this.deps.changedMaterials(updated); check(); this.deps.rawNotice(`Biriktirildi: ${saved.material_name}`);
    } catch (error) { if (!this.stopped(generation)) this.deps.rawNotice(`Biriktirilmadi: ${String(error)}`); }
    finally { if (!this.stopped(generation)) this.publish({ adding: false }); }
  }
  requestRemove(value: string | AdminWorkerDetailResponsibility): void {
    if (!this.isCurrent() || this.state.removing !== null || this.state.dialog || this.state.picker) return;
    if (this.deps.mode === 'warehouse' && typeof value === 'string' && this.deps.assignedWarehouses().includes(value)) this.publish({ dialog: { id: this.deps.nextId(), kind: 'warehouse', warehouse: value, name: this.deps.name() } });
    else if (this.deps.mode === 'material' && typeof value !== 'string' && this.deps.assignedMaterials().includes(value)) this.publish({ dialog: { id: this.deps.nextId(), kind: 'material', material: value, name: this.deps.name() } });
  }
  dismissDialog(id: number): void { if (this.isCurrent() && this.state.dialog?.id === id) this.publish({ dialog: null }); }
  async confirmRemove(id: number): Promise<void> {
    if (!this.isCurrent() || this.state.dialog?.id !== id || this.state.removing !== null) return;
    const dialog = this.state.dialog, generation = this.generation, check = () => this.guard(generation), witness = () => { check(); return true; };
    this.publish({ dialog: null, removing: dialog.kind === 'warehouse' ? dialog.warehouse : dialog.material.material_id });
    try {
      check();
      if (dialog.kind === 'warehouse') {
        await this.deps.unassignWarehouse(dialog.warehouse, check); check(); const updated = await this.deps.reloadWarehouses(check, witness); check();
        if (updated.some(name => key(name) === key(dialog.warehouse))) throw new MobileApiException({ code: 'warehouse_unassignment_not_confirmed', message: this.deps.text('warehouse.unassignment_not_confirmed') });
        this.deps.changedWarehouses(adminWorkerDetailWarehouseNames(updated)); check(); this.deps.notice('warehouse.unassigned', { warehouse: dialog.warehouse });
      } else {
        await this.deps.unassignMaterial(dialog.material.material_id, check); check(); const updated = await this.deps.reloadMaterials(check, witness); check();
        if (updated.some(item => key(item.material_id) === key(dialog.material.material_id))) throw new MobileApiException({ code: 'unassignment_not_confirmed', message: 'Olib tashlash tasdiqlanmadi' });
        this.deps.changedMaterials(updated); check(); this.deps.rawNotice(`Olib tashlandi: ${dialog.material.material_name}`);
      }
    } catch (error) { if (!this.stopped(generation)) { if (dialog.kind === 'warehouse') this.deps.notice('warehouse.unassign_failed', { error }); else this.deps.rawNotice(`Olib tashlanmadi: ${String(error)}`); } }
    finally { if (!this.stopped(generation)) this.publish({ removing: null }); }
  }
  private cancelSearch(): void { if (this.searchTimer !== null) { (this.deps.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.searchTimer); this.searchTimer = null; } }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.pageSerial++; this.cancelSearch(); this.publish({ ...initial(), phase: 'invalidated' }); }
  dispose(): void { this.active = false; this.generation++; this.pageSerial++; this.cancelSearch(); this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'content' }; this.listeners.clear(); }
}
