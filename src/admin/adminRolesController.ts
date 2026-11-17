import type { AdminRoleAssignment } from './adminUsersModel';
import { adminRolesAssignment, adminRolesCanAssign, adminRolesDraftAssignment, adminRolesEditedRole, adminRolesNeedsApparatus, adminRolesUpsertAssignment, adminRolesUpsertRole,
  type AdminRolesData, type AdminRolesPrincipal, type AdminRolesRole } from './adminRolesModel';
import { dartTrim } from './dartJsonString';

type Pending = { kind: 'role'; value: AdminRolesRole } | { kind: 'assignment'; value: AdminRoleAssignment };
export type AdminRolesSheet = Readonly<{ id: number; data: AdminRolesData; closing: boolean; pending: Pending | null } &
  ({ kind: 'editor'; role: AdminRolesRole | null; label: string; capabilities: readonly string[] } | { kind: 'assignment'; principal: AdminRolesPrincipal; selected: readonly string[] })>;
export type AdminRolesNotice = Readonly<{ serial: number; channel: 'top' | 'snackbar'; key: string; tone: 'success' | 'error'; icon: 'verified_user' | 'assignment_turned_in_outlined' | 'error' | 'error_outline' }>;
export type AdminRolesState = Readonly<{ valid: boolean; loading: boolean; refreshing: boolean; data: AdminRolesData | null; tab: 0 | 1; expandedRoleId: string | null; sheet: AdminRolesSheet | null; notice: AdminRolesNotice | null }>;
type Dependencies = { isCurrent(): boolean; read(guard: () => void, witness: () => boolean): Promise<AdminRolesData>;
  saveRole(role: AdminRolesRole, guard: () => void): Promise<AdminRolesRole>; saveAssignment(assignment: AdminRoleAssignment, guard: () => void): Promise<AdminRoleAssignment> };
/** @v2 _AdminRolesScreenState; sheet results settle only after the actual native sheet dismissal. */
export class AdminRolesController {
  private state: AdminRolesState = Object.freeze({ valid: true, loading: true, refreshing: false, data: null, tab: 0, expandedRoleId: null, sheet: null, notice: null });
  private listeners = new Set<() => void>(); private active = false; private generation = 0; private serial = 0;
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(patch: Partial<AdminRolesState>) { this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener()); }
  current = () => this.active && this.state.valid && this.deps.isCurrent();
  start() { if (!this.active) { this.active = true; this.generation++; void this.reload(); } }
  stop() { this.active = false; this.generation++; }
  invalidate() { this.stop(); this.publish({ valid: false, data: null, sheet: null, notice: null }); }
  private notice(key: string, tone: 'success' | 'error', icon: AdminRolesNotice['icon'], channel: 'top' | 'snackbar' = 'top') { if (this.current()) this.publish({ notice: { serial: ++this.serial, channel, key, tone, icon } }); }
  async reload(): Promise<void> {
    if (!this.current()) return; const owner = this.generation, hadData = this.state.data !== null;
    const current = () => this.current() && owner === this.generation, guard = () => { if (!current()) throw Error('Roles scope changed'); };
    this.publish({ loading: !hadData, refreshing: true });
    try { guard(); const data = await this.deps.read(guard, current); guard(); this.publish({ data, loading: false, refreshing: false }); }
    catch { if (current()) { this.publish({ loading: false, refreshing: false }); if (hadData) this.notice('serverDisconnectedRetry', 'error', 'error_outline'); } }
  }
  selectTab(tab: 0 | 1) { if (this.current()) this.publish({ tab }); }
  expand(id: string) { if (this.current() && this.state.data?.roles.some(role => role.id === id)) this.publish({ expandedRoleId: this.state.expandedRoleId === id ? null : id }); }
  openEditor(role: AdminRolesRole | null = null) {
    const data = this.state.data; if (!this.current() || !data || this.state.sheet || (role && (role.system || !data.roles.includes(role)))) return;
    this.publish({ sheet: { id: ++this.serial, kind: 'editor', data, closing: false, pending: null, role, label: role?.label ?? '', capabilities: Object.freeze([...new Set(role?.capability_codes ?? [])]) } });
  }
  openAssignment(principal: AdminRolesPrincipal) {
    const data = this.state.data; if (!this.current() || !data || this.state.sheet) return;
    this.publish({ sheet: { id: ++this.serial, kind: 'assignment', data, closing: false, pending: null, principal,
      selected: Object.freeze([...new Set(adminRolesAssignment(data, principal)?.assigned_apparatus ?? [])]) } });
  }
  private sheet(id: number) { return this.current() && this.state.sheet?.id === id && !this.state.sheet.closing ? this.state.sheet : null; }
  setLabel(id: number, label: string) { const sheet = this.sheet(id); if (sheet?.kind === 'editor') this.publish({ sheet: { ...sheet, label } }); }
  toggleCapability(id: number, code: string, checked: boolean) {
    const sheet = this.sheet(id); if (sheet?.kind !== 'editor' || !sheet.data.capabilities.some(item => item.code === code)) return;
    const values = new Set(sheet.capabilities); if (checked) values.add(code); else values.delete(code); this.publish({ sheet: { ...sheet, capabilities: Object.freeze([...values]) } });
  }
  toggleApparatus(id: number, code: string, checked: boolean) {
    const sheet = this.sheet(id); if (sheet?.kind !== 'assignment' || !code || !sheet.data.apparatus.some(item => item.id === code)) return;
    const values = new Set(sheet.selected); if (checked) values.add(code); else values.delete(code); this.publish({ sheet: { ...sheet, selected: Object.freeze([...values]) } });
  }
  saveEditor(id: number) {
    const sheet = this.sheet(id); if (sheet?.kind !== 'editor' || !dartTrim(sheet.label) || !sheet.capabilities.length) return;
    this.publish({ sheet: { ...sheet, closing: true, pending: { kind: 'role', value: adminRolesEditedRole(sheet.label, sheet.capabilities, sheet.role) } } });
  }
  assign(id: number, role: AdminRolesRole) {
    const sheet = this.sheet(id); if (sheet?.kind !== 'assignment' || !sheet.data.roles.includes(role) || !adminRolesCanAssign(role, sheet.principal)) return;
    if (adminRolesNeedsApparatus(role) && !sheet.selected.length) { this.notice('roles.save_apparatus_required', 'error', 'error', 'snackbar'); return; }
    const value = adminRolesDraftAssignment(sheet.principal, role, sheet.selected); if (value) this.publish({ sheet: { ...sheet, closing: true, pending: { kind: 'assignment', value } } });
  }
  closeSheet(id: number) { const sheet = this.sheet(id); if (sheet) this.publish({ sheet: { ...sheet, closing: true } }); }
  nativeDismiss(id: number) {
    const sheet = this.state.sheet; if (!this.current() || sheet?.id !== id) return;
    this.publish({ sheet: null }); if (sheet.pending) void this.save(sheet.pending, sheet.data);
  }
  private async save(pending: Pending, original: AdminRolesData) {
    const owner = this.generation, current = () => this.current() && owner === this.generation, guard = () => { if (!current()) throw Error('Roles scope changed'); };
    try {
      guard(); if (pending.kind === 'role') { const role = await this.deps.saveRole(pending.value, guard); guard(); this.publish({ data: adminRolesUpsertRole(this.state.data ?? original, role) }); this.notice('adminRoleSaved', 'success', 'verified_user'); }
      else { const assignment = await this.deps.saveAssignment(pending.value, guard); guard(); this.publish({ data: adminRolesUpsertAssignment(this.state.data ?? original, assignment) }); this.notice('adminRoleAssigned', 'success', 'assignment_turned_in_outlined'); }
    } catch { if (current()) this.notice(pending.kind === 'role' ? 'adminRoleSaveFailed' : 'adminRoleAssignFailed', 'error', 'error'); }
  }
}
