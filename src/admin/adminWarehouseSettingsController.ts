import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { WarehouseAssignment } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminWarehouseAssigneeSearch, adminWarehouseRoleForUser } from './adminWarehouseAssignees';
import { adminUserRoleLabel, type AdminUserListEntry } from './adminUsersModel';
import type { AdminWarehouseAssignmentInput } from './adminWarehouseAssignmentApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
import type { AdminWarehouseSummary } from './warehouseApi';

type Notice = { serial: number; key: string; values?: Record<string, unknown> } | { serial: number; message: string };
export type AdminWarehouseSettingsDialog = { id: number; kind: 'unassign'; assignment: WarehouseAssignment; displayName: string; warehouse: string } |
  { id: number; kind: 'delete'; summary: AdminWarehouseSummary } | { id: number; kind: 'blocked'; summary: AdminWarehouseSummary };
export type AdminWarehouseSettingsState = {
  phase: 'content' | 'invalidated'; warehouse: string; summaries: readonly AdminWarehouseSummary[];
  assignments: readonly WarehouseAssignment[]; assignmentsLoading: boolean; assigning: boolean; removingKey: string | null; deleting: boolean;
  picker: { id: number; users: readonly AdminUserListEntry[]; query: string } | null; dialog: AdminWarehouseSettingsDialog | null; notice: Notice | null;
};
export type AdminWarehouseSettingsDependencies = {
  isCurrent: () => boolean;
  users: (guard: () => void, witness: () => boolean) => Promise<readonly AdminUserListEntry[]>;
  assignments: (warehouse: string, guard: () => void, witness: () => boolean) => Promise<readonly WarehouseAssignment[]>;
  assign: (input: AdminWarehouseAssignmentInput, guard: () => void) => Promise<unknown>;
  unassign: (assignment: WarehouseAssignment, guard: () => void) => Promise<unknown>;
  deleteWarehouse: (warehouse: string, deleteProducts: boolean, guard: () => void) => Promise<void>;
  onChanged: () => Promise<void>; onDeleted: () => Promise<void>;
};
const initial = (): AdminWarehouseSettingsState => ({ phase: 'content', warehouse: '', summaries: [], assignments: [], assignmentsLoading: false,
  assigning: false, removingKey: null, deleting: false, picker: null, dialog: null, notice: null });
const lower = (value: string) => dartPartialLower(dartTrim(value));
/** @v2 _warehouseAssignmentKey */
export const adminWarehouseSettingsAssignmentKey = (row: WarehouseAssignment) => `${lower(row.warehouse)}-${row.principal_role}-${lower(row.principal_ref)}`;
/** @v2 _warehousePrincipalKey */
const principalKey = (role: string, ref: string) => `${role}:${lower(ref)}`;
/** @v2 userRoleLabel
 * Canonical user labels with the plain worker-role branch and no apparatus decoration. */
export function adminWarehouseSettingsRoleLabel(role: AdminWarehouseAssignmentInput['principal_role']): string {
  return adminUserRoleLabel({ id: '', name: '', phone: '', kind: 'worker', avatar_url: '', principal_role: role,
    blocked: false, role_label: null, apparatus_display: '', apparatus_id: '' });
}
/** @v2 _WarehouseSettingsTabState */
export class AdminWarehouseSettingsController {
  private state = initial(); private active = false; private retired = false; private checking = false;
  private generation = 0; private readSerial = 0; private serial = 0; private rawWarehouse: string | null | undefined;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminWarehouseSettingsDependencies) {}
  get interactionGeneration(): number { return this.generation; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWarehouseSettingsState>): void {
    if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener();
  }
  start(): void { if (!this.retired) this.active = true; }
  isCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const current = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!current || this.retired) { this.invalidate(); return false; } return true;
  };
  private guard(generation: number): void { if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin warehouse settings session changed'); }
  setSelection(warehouse: string | null, summaries: readonly AdminWarehouseSummary[]): void {
    if (!this.isCurrent()) return;
    const changed = warehouse !== this.rawWarehouse; this.rawWarehouse = warehouse;
    this.publish({ warehouse: dartTrim(warehouse ?? ''), summaries: Object.freeze([...summaries]),
      ...(changed ? { assignments: [], assignmentsLoading: !!dartTrim(warehouse ?? '') } : {}) });
    if (changed && this.isCurrent()) void this.reloadAssignments().catch(() => {});
  }
  summary(): AdminWarehouseSummary | null {
    const name = lower(this.state.warehouse); return name ? this.state.summaries.find(row => lower(row.warehouse) === name) ?? null : null;
  }
  private async reloadAssignments(): Promise<void> {
    const generation = this.generation, serial = ++this.readSerial, warehouse = this.state.warehouse;
    const check = () => this.guard(generation);
    if (!warehouse) { this.publish({ assignments: [], assignmentsLoading: false }); return; }
    this.publish({ assignmentsLoading: true });
    try {
      check(); const rows = await this.deps.assignments(warehouse, check, () => { check(); return true; }); check();
      if (serial === this.readSerial) this.publish({ assignments: Object.freeze([...rows]), assignmentsLoading: false });
    } catch (error) {
      if (serial === this.readSerial && this.isCurrent()) this.publish({ assignments: [], assignmentsLoading: false });
      throw error;
    }
  }
  private notice(key: string, values?: Record<string, unknown>): void { this.publish({ notice: { serial: ++this.serial, key, values } }); }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  async requestAssign(): Promise<void> {
    if (!this.isCurrent() || !this.state.warehouse || this.state.assigning || this.state.picker || this.state.dialog) return;
    const generation = this.generation, check = () => this.guard(generation), witness = () => { check(); return true; }, warehouse = this.state.warehouse;
    this.publish({ assigning: true });
    try {
      check(); const [candidates, assignments] = await Promise.all([this.deps.users(check, witness), this.deps.assignments(warehouse, check, witness)]); check();
      const assigned = new Set(assignments.map(row => principalKey(row.principal_role, row.principal_ref)));
      const users = candidates.filter(user => !assigned.has(principalKey(adminWarehouseRoleForUser(user), user.id)));
      if (!users.length) { this.publish({ assigning: false, notice: { serial: ++this.serial, key: 'warehouse.all_assigned' } }); return; }
      this.publish({ assigning: false, picker: { id: ++this.serial, users, query: '' } });
    } catch {
      if (generation === this.generation && this.isCurrent()) this.publish({ assigning: false, notice: { serial: ++this.serial, key: 'warehouse.users_load_failed' } });
    }
  }
  searchPicker(id: number, query: string): void { if (this.isCurrent() && this.state.picker?.id === id) this.publish({ picker: { ...this.state.picker, query } }); }
  visibleUsers(): readonly AdminUserListEntry[] { return this.state.picker ? adminWarehouseAssigneeSearch(this.state.picker.users, this.state.picker.query) : []; }
  dismissPicker(id: number): void { if (this.isCurrent() && this.state.picker?.id === id) this.publish({ picker: null }); }
  async selectUser(id: number, user: AdminUserListEntry): Promise<void> {
    if (!this.isCurrent() || this.state.picker?.id !== id || !this.state.picker.users.includes(user)) return;
    const generation = this.generation, check = () => this.guard(generation), warehouse = this.state.warehouse;
    this.publish({ picker: null, assigning: true });
    try {
      check(); await this.deps.assign({ warehouse, principal_role: adminWarehouseRoleForUser(user), principal_ref: user.id, display_name: user.name }, check); check();
      await this.reloadAssignments(); check(); await this.deps.onChanged(); check(); this.notice('warehouse.assigned_user_success', { name: user.name });
    } catch {
      if (generation === this.generation && this.isCurrent()) this.notice('warehouse.assign_user_failed');
    } finally { if (generation === this.generation && this.isCurrent()) this.publish({ assigning: false }); }
  }
  requestUnassign(assignment: WarehouseAssignment): void {
    if (!this.isCurrent() || this.state.removingKey !== null || this.state.dialog || this.state.picker || !this.state.assignments.includes(assignment)) return;
    const displayName = dartTrim(assignment.display_name) || dartTrim(assignment.principal_ref);
    this.publish({ dialog: { id: ++this.serial, kind: 'unassign', assignment, displayName, warehouse: this.state.warehouse } });
  }
  requestDelete(): void {
    if (!this.isCurrent() || this.state.deleting || this.state.dialog || this.state.picker) return;
    const summary = this.summary(); if (!summary) return;
    this.publish({ dialog: { id: ++this.serial, kind: summary.reserved_count > 0 ? 'blocked' : 'delete', summary } });
  }
  dismissDialog(id: number): void { if (this.isCurrent() && this.state.dialog?.id === id) this.publish({ dialog: null }); }
  async confirmDialog(id: number): Promise<void> {
    if (!this.isCurrent() || this.state.dialog?.id !== id) return;
    const dialog = this.state.dialog; if (dialog.kind === 'blocked') { this.dismissDialog(id); return; }
    const generation = this.generation, check = () => this.guard(generation);
    this.publish({ dialog: null, ...(dialog.kind === 'delete' ? { deleting: true } : { removingKey: adminWarehouseSettingsAssignmentKey(dialog.assignment) }) });
    try {
      check();
      if (dialog.kind === 'delete') { await this.deps.deleteWarehouse(dialog.summary.warehouse, dialog.summary.product_count > 0, check); check(); await this.deps.onDeleted(); check(); this.notice('warehouse.deleted'); }
      else { await this.deps.unassign(dialog.assignment, check); check(); await this.reloadAssignments(); check(); await this.deps.onChanged(); check(); this.notice('warehouse.unassigned_user_success', { name: dialog.displayName }); }
    } catch (error) {
      if (generation !== this.generation || !this.isCurrent()) return;
      if (dialog.kind === 'delete') {
        const codes: Record<string, string> = { warehouse_has_active_reservations: 'active', warehouse_has_children: 'children', warehouse_not_empty: 'not_empty', warehouse_not_found: 'not_found' };
        const suffix = error instanceof MobileApiException && Object.hasOwn(codes, error.code) ? `_${codes[error.code]}` : '';
        this.notice(`warehouse.delete_error${suffix}`);
      } else if (error instanceof MobileApiException) this.publish({ notice: { serial: ++this.serial, message: error.message } });
      else this.notice('warehouse.unassign_user_failed');
    } finally {
      if (generation === this.generation && this.isCurrent()) this.publish(dialog.kind === 'delete' ? { deleting: false } : { removingKey: null });
    }
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.readSerial++; this.publish({ ...initial(), phase: 'invalidated' }); }
  dispose(): void {
    this.active = false; this.generation++; this.readSerial++; this.rawWarehouse = undefined;
    this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'content' }; this.listeners.clear();
  }
}
