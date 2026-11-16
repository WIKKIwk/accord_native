import type { AdminApparatus } from '../apparatusApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminCustomerApparatusAssignment, adminCustomerApparatusUpsert, adminCustomerApparatusVisible } from './adminCustomerApparatusModel';
import type { AdminRoleAssignment } from './adminUsersModel';

export type AdminCustomerApparatusSheet = Readonly<{ id: number; apparatus: readonly AdminApparatus[]; selected: readonly string[]; saving: boolean; closing: boolean }>;
export type AdminCustomerApparatusState = Readonly<{ valid: boolean; loading: boolean; saving: boolean; error: unknown | null; apparatus: readonly AdminApparatus[];
  assignment: AdminRoleAssignment | null; selected: readonly string[]; sheet: AdminCustomerApparatusSheet | null; notice: Readonly<{ serial: number; key: string; error?: unknown }> | null }>;
export type AdminCustomerApparatusDependencies = { isCurrent: () => boolean; ref: string; material: boolean;
  assignments: (guard: () => void, witness: () => boolean) => Promise<readonly AdminRoleAssignment[]>;
  apparatus: (guard: () => void, witness: () => boolean) => Promise<readonly AdminApparatus[]>;
  save: (assignment: AdminRoleAssignment, guard: () => void) => Promise<unknown>; changed: () => void };
const initial = (valid = true): AdminCustomerApparatusState => Object.freeze({ valid, loading: true, saving: false, error: null, apparatus: Object.freeze([]), assignment: null, selected: Object.freeze([]), sheet: null, notice: null });
/** @v2 AdminAparatchiApparatusCard and its independent _AdminMaterialApparatusSheet. */
export class AdminCustomerApparatusController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0; private serial = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminCustomerApparatusDependencies) {}
  get interactionGeneration() { return this.generation; }
  get material() { return this.deps.material; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminCustomerApparatusState>) { if (!this.active) return; this.state = Object.freeze({ ...this.state, ...patch }); for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const allowed = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!allowed || this.retired) { this.invalidate(); return false; } return this.active && !this.retired && generation === this.generation;
  };
  private guard(generation: number) { if (!this.isCurrent(generation)) throw new Error('Admin customer apparatus changed'); }
  private notice(key: string, error?: unknown) { if (this.isCurrent()) this.publish({ notice: Object.freeze({ serial: ++this.serial, key, ...(error === undefined ? {} : { error }) }) }); }
  dismissNotice(serial: number) { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  start() { if (this.retired || this.active) return; this.active = true; void this.load(); }
  async load(): Promise<void> {
    if (!this.isCurrent()) return; const generation = this.generation; let live = true;
    const guard = () => { this.guard(generation); if (!live) throw new Error('Admin customer apparatus read settled'); }, witness = () => { guard(); return true; };
    this.publish({ loading: true, error: null });
    try {
      guard(); const roles = async () => { guard(); return this.deps.assignments(guard, witness); }, apparatus = async () => { guard(); return this.deps.apparatus(guard, witness); };
      // Future.wait's default eagerError:false waits for both source reads and preserves the first settled error.
      let failed = false, firstError: unknown;
      const capture = async <T>(job: () => Promise<T>): Promise<T> => { try { return await job(); } catch (error) { if (!failed) { failed = true; firstError = error; } throw error; } };
      const results = await Promise.allSettled([capture(roles), capture(apparatus)] as const); guard();
      if (failed) throw firstError;
      if (results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled') throw new Error('Admin customer apparatus read failed');
      const rows = results[0].value, catalog = results[1].value, assignment = adminCustomerApparatusAssignment(rows, this.deps.ref, this.deps.material);
      this.publish({ assignment, apparatus: Object.freeze([...catalog]), selected: Object.freeze([...new Set(assignment?.assigned_apparatus ?? [])]), loading: false });
    } catch (error) { if (this.isCurrent(generation)) this.publish({ error, loading: false }); } finally { live = false; }
  }
  visible() { return adminCustomerApparatusVisible(this.state.assignment, this.deps.material); }
  toggle(id: string, checked: boolean, sheetId?: number) {
    if (!this.isCurrent()) return; const sheet = sheetId === undefined ? null : this.state.sheet;
    if (sheetId !== undefined && (sheet?.id !== sheetId || sheet.closing)) return;
    const catalog = sheet ? sheet.apparatus : this.state.apparatus; if (!id || !catalog.some(item => item.id === id)) return;
    const values = new Set(sheet ? sheet.selected : this.state.selected); if (checked) values.add(id); else values.delete(id);
    if (sheet) this.publish({ sheet: Object.freeze({ ...sheet, selected: Object.freeze([...values]) }) }); else this.publish({ selected: Object.freeze([...values]) });
  }
  openSheet() {
    if (!this.isCurrent() || !this.deps.material || this.state.saving || !this.state.assignment || this.state.sheet) return;
    this.publish({ sheet: Object.freeze({ id: ++this.serial, apparatus: this.state.apparatus, selected: Object.freeze([...this.state.selected]), saving: false, closing: false }) });
  }
  dismissSheet(id: number) { if (this.isCurrent() && this.state.sheet?.id === id) this.publish({ sheet: null }); }
  async save(sheetId?: number): Promise<boolean> {
    if (!this.isCurrent() || this.state.saving) return false;
    const sheet = sheetId === undefined ? null : this.state.sheet;
    if (sheetId !== undefined && (sheet?.id !== sheetId || sheet.saving || sheet.closing)) return false;
    const selected = sheet ? sheet.selected : this.state.selected, assignment = this.state.assignment;
    const generation = this.generation; let live = true;
    const guard = () => { this.guard(generation); if (!live) throw new Error('Admin customer apparatus save settled'); };
    if (sheet) this.publish({ sheet: Object.freeze({ ...sheet, saving: true }) });
    try {
      guard();
      if (!selected.length) { this.notice('scope.select_required'); if (sheet) await Promise.resolve(); return false; }
      if (this.deps.material && !assignment) { this.notice('scope.material_supplier_missing'); if (sheet) await Promise.resolve(); return false; }
      const input = adminCustomerApparatusUpsert(this.deps.ref, this.deps.material, assignment, selected);
      this.publish({ selected: Object.freeze([...selected]), saving: true });
      guard(); await this.deps.save(input, guard); guard(); this.deps.changed(); guard(); this.notice('scope.saved'); guard(); await this.load(); guard();
      if (sheet && this.state.sheet?.id === sheet.id) this.publish({ sheet: Object.freeze({ ...this.state.sheet, closing: true }) }); return true;
    } catch (error) { if (this.isCurrent(generation)) this.notice('scope.save_failed', error); return false; }
    finally { live = false; if (this.isCurrent(generation)) this.publish({ saving: false, ...(sheet && this.state.sheet?.id === sheet.id && !this.state.sheet.closing ? { sheet: Object.freeze({ ...this.state.sheet, saving: false }) } : {}) }); }
  }
  invalidate() { if (this.retired) return; this.retired = true; this.generation++; this.publish(initial(false)); }
  dispose() { this.active = false; this.generation++; this.state = initial(!this.retired); }
}
