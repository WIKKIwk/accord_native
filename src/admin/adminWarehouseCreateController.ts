import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminWarehouseAssigneeSearch, adminWarehouseRoleForUser } from './adminWarehouseAssignees';
import type { AdminUserListEntry } from './adminUsersModel';
import type { AdminWarehouseAssignmentInput } from './adminWarehouseAssignmentApi';
import { dartTrim } from './dartJsonString';

export type AdminWarehousePicker = { id: number; users: readonly AdminUserListEntry[]; query: string };
export type AdminWarehouseCreateState = {
  phase: 'content' | 'invalidated' | 'closed'; name: string; fillVersion: number; selected: AdminUserListEntry | null;
  loadingUsers: boolean; saving: boolean; picker: AdminWarehousePicker | null;
  notice: { serial: number; key: 'warehouse.users_load_failed' | 'warehouse.no_users' } | null;
};
export type AdminWarehouseCreateDependencies = {
  isCurrent: () => boolean;
  users: (guard: () => void, witness: () => boolean) => Promise<readonly AdminUserListEntry[]>;
  create: (warehouse: string, guard: () => void) => Promise<unknown>;
  assign: (input: AdminWarehouseAssignmentInput, guard: () => void) => Promise<unknown>;
  onSaved: () => Promise<void>; onClose: () => void;
};
const initial = (): AdminWarehouseCreateState => ({ phase: 'content', name: '', fillVersion: 0, selected: null, loadingUsers: false, saving: false, picker: null, notice: null });

/** @v2 _WarehouseCreateCardState
 * Create and assignment are deliberately two independent commands. */
export class AdminWarehouseCreateController {
  private state = initial();
  private readonly listeners = new Set<() => void>();
  private active = false;
  private retired = false;
  private generation = 0;
  private serial = 0;
  private checking = false;
  private closing = false;
  private usersFuture: Promise<readonly AdminUserListEntry[]> | null = null;
  constructor(private readonly deps: AdminWarehouseCreateDependencies) {}
  get interactionGeneration(): number { return this.generation; }
  getSnapshot = (): AdminWarehouseCreateState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWarehouseCreateState>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener();
  }
  start(): void { if (!this.retired) this.active = true; }
  private authorityCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true;
    const current = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!current || this.retired) { this.invalidate(); return false; }
    return true;
  };
  isCurrent = (): boolean => !this.closing && this.authorityCurrent();
  private check(generation: number): void {
    if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin warehouse session changed');
  }
  changeName(value: string): void { if (this.isCurrent()) this.publish({ name: value }); }
  async openPicker(): Promise<void> {
    if (!this.isCurrent() || this.state.loadingUsers || this.state.picker) return;
    const generation = this.generation, guard = () => this.check(generation);
    this.publish({ loadingUsers: true });
    try {
      guard();
      this.usersFuture ??= this.deps.users(guard, () => { guard(); return true; });
      const users = await this.usersFuture; guard();
      if (!users.length) { this.publish({ loadingUsers: false, notice: { serial: ++this.serial, key: 'warehouse.no_users' } }); return; }
      this.publish({ loadingUsers: false, picker: { id: ++this.serial, users, query: '' } });
    } catch {
      if (generation !== this.generation || !this.isCurrent()) return;
      this.usersFuture = null;
      this.publish({ loadingUsers: false, notice: { serial: ++this.serial, key: 'warehouse.users_load_failed' } });
    }
  }
  searchPicker(id: number, query: string): void {
    if (this.isCurrent() && this.state.picker?.id === id) this.publish({ picker: { ...this.state.picker, query } });
  }
  visibleUsers(): readonly AdminUserListEntry[] {
    const picker = this.state.picker; return picker ? adminWarehouseAssigneeSearch(picker.users, picker.query) : [];
  }
  selectUser(id: number, user: AdminUserListEntry): void {
    if (!this.isCurrent() || this.state.picker?.id !== id || !this.state.picker.users.includes(user)) return;
    this.publish({ selected: user, picker: null });
  }
  dismissPicker(id: number): void { if (this.isCurrent() && this.state.picker?.id === id) this.publish({ picker: null }); }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  async save(): Promise<void> {
    if (!this.isCurrent() || this.state.saving || !this.state.selected) return;
    const warehouse = dartTrim(this.state.name); if (!warehouse) return;
    const generation = this.generation, guard = () => this.check(generation);
    this.publish({ saving: true });
    try {
      guard(); await this.deps.create(warehouse, guard); guard();
      // Source reads the selected user after create returns. Picker and text input remain enabled while saving.
      const user = this.state.selected!;
      await this.deps.assign({ warehouse, principal_role: adminWarehouseRoleForUser(user), principal_ref: user.id, display_name: user.name }, guard); guard();
      this.publish({ name: '', selected: null, fillVersion: this.state.fillVersion + 1 }); guard();
      await this.deps.onSaved(); guard();
      this.finishClose();
    } finally {
      if (generation === this.generation && this.isCurrent()) this.publish({ saving: false });
    }
  }
  /** V2 blocks only its close button while saving; the dialog's outside/back dismissal remains available. */
  closeButton(): void { if (this.isCurrent() && !this.state.saving) this.finishClose(); }
  dismissDialog(): void { if (this.isCurrent()) this.finishClose(); }
  private finishClose(): void {
    const generation = this.generation; this.closing = true;
    this.publish({ ...initial(), phase: 'closed' });
    // A subscriber may synchronously retire this owner during publication.
    if (generation !== this.generation || !this.authorityCurrent()) return;
    this.retired = true; this.generation++; this.usersFuture = null; this.deps.onClose();
  }
  invalidate(): void {
    if (this.retired) return;
    this.retired = true; this.generation++; this.usersFuture = null;
    this.publish({ ...initial(), phase: 'invalidated' });
  }
  /** React's development effect replay may attach the same owner again. Account retirement remains sticky. */
  dispose(): void {
    this.active = false; this.generation++; this.usersFuture = null;
    if (!this.retired) this.closing = false;
    this.state = { ...initial(), phase: this.retired ? this.state.phase : 'content', fillVersion: this.state.fillVersion + 1 };
    this.listeners.clear();
  }
}
