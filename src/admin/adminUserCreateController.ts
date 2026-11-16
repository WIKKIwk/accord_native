import type { AdminApparatus } from '../apparatusApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminRoleAssignment } from './adminUsersModel';
import type { AdminSettings } from './adminSettings';
import { adminUserCreateChoices, adminUserCreateChoiceEnabled, adminUserCreateCustomerChoice, adminUserCreateGroups, adminUserCreateIsMaterial,
  adminUserCreatePrincipalRole, adminUserCreateSystemRole, type AdminUserCreateChoice, type AdminUserCreateCustomer, type AdminUserCreateRole } from './adminUserCreateModel';
import { dartTrim } from './dartJsonString';

type Guard = () => void;
type Fields = Readonly<{ name: string; phone: string }>;
type Notice = Readonly<{ id: number; tone: 'success' | 'error'; key?: string; name?: string; error?: unknown; customerFailure?: boolean }>;
export type AdminUserCreatePicker = Readonly<{ id: number; kind: 'roles' | 'groups'; query: string; selected: readonly string[]; closing: boolean }>;
type Code = Readonly<{ id: number; value: string; closing: boolean }>;
export type AdminUserCreateState = Readonly<{ valid: boolean; choices: readonly AdminUserCreateChoice[] | null; choice: AdminUserCreateChoice | null; formId: number; fillVersion: number;
  phase: 'idle' | 'loading' | 'ready' | 'error'; saving: boolean; regenerating: boolean; code: string; seconds: number;
  apparatusLoading: boolean; apparatus: readonly AdminApparatus[]; selectedApparatus: readonly string[]; groupsLoading: boolean; groups: readonly string[]; selectedGroups: readonly string[];
  picker: AdminUserCreatePicker | null; issuedCode: Code | null; notice: Notice | null }>;
export type AdminUserCreateDependencies = {
  current: () => boolean; roles: (guard: Guard, witness: () => boolean) => Promise<readonly AdminUserCreateRole[]>;
  apparatus: (guard: Guard, witness: () => boolean) => Promise<readonly AdminApparatus[]>; groups: (guard: Guard, witness: () => boolean) => Promise<readonly string[]>;
  settings: (guard: Guard, witness: () => boolean) => Promise<AdminSettings>; updateSettings: (value: AdminSettings, guard: Guard) => Promise<AdminSettings>; regenerateWerka: (guard: Guard) => Promise<AdminSettings>;
  customer: (name: string, phone: string, guard: Guard) => Promise<AdminUserCreateCustomer>;
  supplier: (name: string, phone: string, guard: Guard) => Promise<AdminUserCreateCustomer & { code: string }>;
  material: (name: string, phone: string, groups: readonly string[], guard: Guard) => Promise<{ code: string }>;
  system: (role: NonNullable<ReturnType<typeof adminUserCreateSystemRole>>, name: string, phone: string, guard: Guard) => Promise<{ id: string }>;
  regenerateCustomer: (ref: string, guard: Guard) => Promise<{ code: string }>; regenerateSystem: (id: string, guard: Guard) => Promise<{ code: string }>;
  assign: (value: AdminRoleAssignment, guard: Guard) => Promise<unknown>; invalidateUsers: () => void; invalidateCustomerPicker: () => void;
  copy: (value: string, guard: Guard) => Promise<void>; customerCreated?: (customer: AdminUserCreateCustomer) => void;
  everySecond?: (callback: () => void) => unknown; cancelTimer?: (timer: unknown) => void;
};
export type AdminUserCreateOptions = Readonly<{ customerOnly: boolean; returnCustomer: boolean; initialName: string; principalRole: string; capabilities: readonly string[] }>;
const family = (choice: AdminUserCreateChoice | null) => choice?.kind === 'material' ? 'custom' : choice?.kind ?? null;
const initial = (options: AdminUserCreateOptions): AdminUserCreateState => ({ valid: true, choices: options.customerOnly ? [adminUserCreateCustomerChoice] : null,
  choice: options.customerOnly ? adminUserCreateCustomerChoice : null, formId: 0, fillVersion: 0, phase: 'idle', saving: false, regenerating: false, code: '', seconds: 0,
  apparatusLoading: false, apparatus: [], selectedApparatus: [], groupsLoading: false, groups: [], selectedGroups: [], picker: null, issuedCode: null, notice: null });

/** @v2 AdminUserCreateScreen plus its retained per-widget-type form states. */
export class AdminUserCreateController {
  private state: AdminUserCreateState; private fields: Fields = { name: '', phone: '' }; private settings: AdminSettings | null = null;
  private active = false; private retired = false; private checking = false; private lifetime = 0; private serial = 0; private formSerial = 0; private readSerial = 0;
  private roleFuture: Promise<void> | null = null; private rolePickerPending = false; private pickerOutcome: AdminUserCreateChoice | readonly string[] | null = null;
  private codeResolve: (() => void) | null = null; private timer: unknown = null; private listeners = new Set<() => void>();
  constructor(private readonly deps: AdminUserCreateDependencies, private readonly options: AdminUserCreateOptions) {
    if (options.returnCustomer && typeof deps.customerCreated !== 'function') throw new TypeError('Customer creation requires its real return callback'); this.state = initial(options);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get generation() { return this.lifetime; }
  get currentFields(): Fields { return { ...this.fields }; }
  private publish(change: Partial<AdminUserCreateState>) { this.state = Object.freeze({ ...this.state, ...change }); for (const listener of [...this.listeners]) { try { listener(); } catch { /* Keep owned command and dismissal completion independent of one observer. */ } } }
  isCurrent = (lifetime = this.lifetime) => {
    if (!this.active || this.retired || lifetime !== this.lifetime) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.deps.current); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && !this.retired && lifetime === this.lifetime;
  };
  private formCurrent(id: number, lifetime = this.lifetime) { return this.isCurrent(lifetime) && this.state.formId === id; }
  private guard(id?: number, lifetime = this.lifetime): Guard { return () => { if (!this.isCurrent(lifetime) || id !== undefined && id !== this.state.formId) throw new Error('Admin user create owner changed'); }; }
  private witness(guard: Guard) { return () => { guard(); return true; }; }
  start() {
    if (this.active || this.retired) return; this.active = true; this.lifetime++; this.publish(initial(this.options));
    if (!this.isCurrent()) return;
    if (this.options.customerOnly) this.selectChoice(adminUserCreateCustomerChoice); else this.roleFuture = this.loadRoles();
  }
  private async loadRoles() {
    const lifetime = this.lifetime, guard = this.guard(undefined, lifetime); let roles: readonly AdminUserCreateRole[] | null;
    try { guard(); roles = await this.deps.roles(guard, this.witness(guard)); guard(); }
    catch { if (!this.isCurrent(lifetime)) return; roles = null; }
    this.publish({ choices: adminUserCreateChoices(roles, this.options.principalRole, this.options.capabilities) });
  }
  change(id: number, field: keyof Fields, value: string) { if (this.formCurrent(id) && !this.state.picker && !this.state.issuedCode) this.fields = { ...this.fields, [field]: value }; }
  private cancelTimer() { const timer = this.timer; this.timer = null; if (timer !== null) (this.deps.cancelTimer ?? (value => clearInterval(value as ReturnType<typeof setInterval>)))(timer); }
  private countdown(seconds: number) {
    this.cancelTimer(); const value = Math.max(0, seconds); this.publish({ seconds: value }); if (!value || !this.isCurrent()) return;
    const id = this.state.formId, lifetime = this.lifetime;
    const timer = (this.deps.everySecond ?? (fn => setInterval(fn, 1000)))(() => { if (!this.formCurrent(id, lifetime)) return; const remaining = Math.max(0, this.state.seconds - 1); if (!remaining) this.cancelTimer(); this.publish({ seconds: remaining }); });
    if (this.formCurrent(id, lifetime) && this.state.seconds > 0) this.timer = timer;
    else (this.deps.cancelTimer ?? (value => clearInterval(value as ReturnType<typeof setInterval>)))(timer);
  }
  private selectChoice(choice: AdminUserCreateChoice) {
    if (!this.isCurrent() || !adminUserCreateChoiceEnabled(choice)) return;
    if (family(choice) === family(this.state.choice) && this.state.formId !== 0) { this.publish({ choice }); return; }
    this.cancelTimer(); const id = ++this.formSerial; this.readSerial++; this.settings = null; this.fields = { name: choice.kind === 'customer' ? this.options.initialName : '', phone: '' };
    const resolve = this.codeResolve; this.codeResolve = null; resolve?.();
    this.publish({ ...initial(this.options), choices: this.state.choices, choice, formId: id, notice: this.state.notice, fillVersion: this.state.fillVersion + 1, phase: choice.kind === 'werka' ? 'loading' : 'ready' });
    if (!this.formCurrent(id)) return;
    if (choice.kind === 'werka') void this.reloadWerka(id);
    if (family(choice) === 'custom' && choice.role?.id === 'aparatchi') void this.loadApparatus(id);
    if (family(choice) === 'custom' && choice.role && adminUserCreateIsMaterial(choice.role)) void this.loadGroups(id);
  }
  async openRoles(canPresent: () => boolean) {
    if (!this.isCurrent() || this.options.customerOnly || this.state.picker || this.state.issuedCode || this.rolePickerPending || !isSynchronouslyTrue(canPresent)) return;
    const lifetime = this.lifetime; this.rolePickerPending = true;
    // Source checks mounted after the accepted await, even if Profile has since covered this page.
    try { await this.roleFuture; if (this.isCurrent(lifetime) && !this.state.picker && !this.state.issuedCode) {
      this.pickerOutcome = null; this.publish({ picker: { id: ++this.serial, kind: 'roles', query: '', selected: [], closing: false } });
    } } finally { if (lifetime === this.lifetime) this.rolePickerPending = false; }
  }
  pickerSearch(id: number, query: string) { const picker = this.state.picker; if (this.isCurrent() && !this.state.issuedCode && picker?.id === id && picker.kind === 'roles' && !picker.closing) this.publish({ picker: { ...picker, query } }); }
  chooseRole(id: number, choice: AdminUserCreateChoice) {
    const picker = this.state.picker; if (!this.isCurrent() || this.state.issuedCode || picker?.id !== id || picker.kind !== 'roles' || picker.closing || !this.state.choices?.includes(choice) || !adminUserCreateChoiceEnabled(choice)) return;
    this.pickerOutcome = choice; this.publish({ picker: { ...picker, closing: true } });
  }
  toggleGroup(id: number, group: string, selected: boolean) {
    const picker = this.state.picker; if (!this.isCurrent() || this.state.issuedCode || picker?.id !== id || picker.kind !== 'groups' || picker.closing || !this.state.groups.includes(group)) return;
    const values = new Set(picker.selected); if (selected) values.add(group); else values.delete(group); this.publish({ picker: { ...picker, selected: [...values] } });
  }
  confirmGroups(id: number) { const picker = this.state.picker; if (this.isCurrent() && !this.state.issuedCode && picker?.id === id && picker.kind === 'groups' && !picker.closing && picker.selected.length) {
    this.pickerOutcome = adminUserCreateGroups(picker.selected); this.publish({ picker: { ...picker, closing: true } });
  } }
  dismissPicker(id: number) { const picker = this.state.picker; if (picker?.id === id && !picker.closing) { this.pickerOutcome = null; this.publish({ picker: { ...picker, closing: true } }); } }
  completePicker(id: number) {
    const picker = this.state.picker; if (!this.isCurrent() || picker?.id !== id) return; const outcome = this.pickerOutcome; this.pickerOutcome = null;
    if (picker.kind === 'roles' && outcome && !Array.isArray(outcome)) { this.selectChoice(outcome as AdminUserCreateChoice); if (this.state.picker?.id === id) this.publish({ picker: null }); }
    else this.publish({ picker: null, ...(picker.kind === 'groups' && outcome ? { selectedGroups: adminUserCreateGroups(outcome as readonly string[]) } : {}) });
  }
  private async loadApparatus(id: number) {
    const lifetime = this.lifetime, guard = this.guard(id, lifetime); this.publish({ apparatusLoading: true });
    try { guard(); const apparatus = await this.deps.apparatus(guard, this.witness(guard)); guard(); this.publish({ apparatus, apparatusLoading: false }); }
    catch { if (this.formCurrent(id, lifetime)) this.publish({ apparatusLoading: false }); }
  }
  private async loadGroups(id: number) {
    const lifetime = this.lifetime, guard = this.guard(id, lifetime); this.publish({ groupsLoading: true });
    try { guard(); const groups = await this.deps.groups(guard, this.witness(guard)); guard(); this.publish({ groups: adminUserCreateGroups(groups), groupsLoading: false }); }
    catch { if (this.formCurrent(id, lifetime)) this.publish({ groupsLoading: false }); }
  }
  async openGroups(id: number, canPresent: () => boolean) {
    if (!this.formCurrent(id) || !this.state.choice?.role || !adminUserCreateIsMaterial(this.state.choice.role) || this.state.groupsLoading || this.state.picker || this.state.issuedCode || !isSynchronouslyTrue(canPresent)) return; const lifetime = this.lifetime;
    if (!this.state.groups.length) await this.loadGroups(id);
    if (this.formCurrent(id, lifetime) && this.state.groups.length && !this.state.picker && !this.state.issuedCode) {
      this.pickerOutcome = null; this.publish({ picker: { id: ++this.serial, kind: 'groups', query: '', selected: this.state.selectedGroups, closing: false } });
    }
  }
  selectApparatus(id: number, apparatusId: string, selected: boolean) {
    if (!this.formCurrent(id) || family(this.state.choice) !== 'custom' || this.state.choice?.role?.id !== 'aparatchi' || this.state.picker || this.state.issuedCode || !apparatusId || !this.state.apparatus.some(item => item.id === apparatusId)) return;
    const values = new Set(this.state.selectedApparatus); if (selected) values.add(apparatusId); else values.delete(apparatusId); this.publish({ selectedApparatus: [...values] });
  }
  async reloadWerka(id: number) {
    if (!this.formCurrent(id) || this.state.choice?.kind !== 'werka' || this.state.saving || this.state.regenerating) return;
    const lifetime = this.lifetime, read = ++this.readSerial, base = this.guard(id, lifetime), guard = () => { base(); if (read !== this.readSerial) throw new Error('Werka settings read changed'); };
    this.publish({ phase: 'loading' });
    try { guard(); const settings = await this.deps.settings(guard, this.witness(guard)); guard(); this.settings = settings;
      this.fields = { name: settings.werka_name, phone: settings.werka_phone }; this.publish({ phase: 'ready', code: settings.werka_code, fillVersion: this.state.fillVersion + 1 }); this.countdown(settings.werka_code_retry_after_sec);
    } catch { if (this.formCurrent(id, lifetime) && read === this.readSerial) this.publish({ phase: 'error' }); }
  }
  private notice(key: string, tone: 'success' | 'error', extra: Partial<Notice> = {}) { this.publish({ notice: { ...extra, id: ++this.serial, key, tone } }); }
  dismissNotice(id: number) { if (this.isCurrent() && this.state.notice?.id === id) this.publish({ notice: null }); }
  private assign(role: AdminUserCreateRole | null, principalRole: AdminRoleAssignment['principal_role'], ref: string, guard: Guard) {
    guard(); return role ? this.deps.assign({ principal_role: principalRole, principal_ref: ref, role_id: role.id, assigned_apparatus: [], assigned_item_groups: [] }, guard) : Promise.resolve();
  }
  private async showCode(value: string, guard: Guard) {
    guard(); if (!value) return; const result = new Promise<void>(resolve => { this.codeResolve = resolve; }); this.publish({ issuedCode: { id: ++this.serial, value, closing: false } }); await result;
  }
  dismissCode(id: number) { const code = this.state.issuedCode; if (code?.id === id && !code.closing) this.publish({ issuedCode: { ...code, closing: true } }); }
  completeCode(id: number) { if (this.state.issuedCode?.id !== id) return; const resolve = this.codeResolve; this.codeResolve = null; this.publish({ issuedCode: null }); resolve?.(); }
  async copyCode(id?: number) {
    if (!this.isCurrent()) return; const issued = this.state.issuedCode, form = this.state.formId, lifetime = this.lifetime;
    if (id !== undefined && (issued?.id !== id || issued.closing) || id === undefined && (this.state.choice?.kind !== 'werka' || this.state.picker || this.state.issuedCode || !dartTrim(this.state.code))) return;
    const base = this.guard(form, lifetime), guard = () => { base(); if (id !== undefined && this.state.issuedCode?.id !== id) throw new Error('Issued code dialog changed'); };
    try { guard(); await this.deps.copy(id === undefined ? this.state.code : issued!.value, guard); guard(); if (id === undefined) this.notice('user.code_copied', 'success'); } catch { /* Source adds no clipboard error surface. */ }
  }
  async regenerate(id: number) {
    if (!this.formCurrent(id) || this.state.choice?.kind !== 'werka' || this.state.phase !== 'ready' || this.state.regenerating || this.state.seconds > 0 || this.state.picker || this.state.issuedCode) return;
    const lifetime = this.lifetime, guard = this.guard(id, lifetime); this.publish({ regenerating: true });
    try { guard(); const settings = await this.deps.regenerateWerka(guard); guard(); this.publish({ code: settings.werka_code }); this.countdown(settings.werka_code_retry_after_sec); guard(); this.notice('user.warehouse_code_updated', 'success'); }
    catch { if (this.formCurrent(id, lifetime)) this.notice('user.code_update_failed', 'error'); }
    finally { if (this.formCurrent(id, lifetime)) this.publish({ regenerating: false }); }
  }
  async save(id: number) {
    if (!this.formCurrent(id) || this.state.saving || this.state.phase !== 'ready' || !this.state.choice || this.state.picker || this.state.issuedCode) return;
    const choice = this.state.choice, kind = family(choice), role = choice.role, lifetime = this.lifetime, guard = this.guard(id, lifetime);
    if (kind === 'customer' && !dartTrim(this.fields.name)) { this.notice('user.name_required', 'error'); return; }
    if (kind === 'custom' && role?.id === 'aparatchi' && !this.state.selectedApparatus.length) { this.notice('user.minimum_apparatus', 'error'); return; }
    if (kind === 'custom' && role && adminUserCreateIsMaterial(role) && !this.state.selectedGroups.length) { this.notice('user.minimum_item_group', 'error'); return; }
    const name = dartTrim(this.fields.name), phone = dartTrim(this.fields.phone), settings = this.settings; this.publish({ saving: true });
    try {
      guard(); let code = '';
      if (kind === 'werka') {
        if (!settings) return; const updated = await this.deps.updateSettings({ ...settings, werka_name: name, werka_phone: phone, werka_code: '', werka_code_retry_after_sec: this.state.seconds }, guard); guard();
        await this.assign(this.state.choice?.role ?? null, 'werka', 'werka', guard); guard(); this.publish({ code: updated.werka_code }); guard(); this.deps.invalidateUsers(); guard(); this.notice('user.warehouse_saved', 'success'); return;
      }
      if (kind === 'customer') {
        const customer = await this.deps.customer(name, phone, guard); guard(); await this.assign(this.state.choice?.role ?? null, 'customer', customer.ref, guard); guard(); this.deps.invalidateUsers(); guard(); this.deps.invalidateCustomerPicker(); guard();
        if (this.options.returnCustomer) { this.deps.customerCreated?.(customer); return; }
        this.fields = { name: '', phone: '' }; this.publish({ fillVersion: this.state.fillVersion + 1 }); guard(); this.notice('user.customer_created', 'success', { name: customer.name }); return;
      }
      if (kind === 'supplier') {
        const supplier = await this.deps.supplier(name, phone, guard); guard(); await this.assign(this.state.choice?.role ?? null, 'supplier', supplier.ref, guard); guard(); code = supplier.code;
      } else if (role) {
        const systemRole = adminUserCreateSystemRole(role);
        if (systemRole) {
          const user = await this.deps.system(systemRole, name, phone, guard); guard(); code = (await this.deps.regenerateSystem(user.id, guard)).code; guard();
          const currentRole = this.state.choice?.role;
          if (currentRole && ['tayyorlov_masteri', 'homashyo_rezkachi'].includes(currentRole.base_role ?? '') && !currentRole.system) await this.assign(currentRole, systemRole, user.id, guard);
        } else if (adminUserCreateIsMaterial(role)) code = (await this.deps.material(name, phone, adminUserCreateGroups(this.state.selectedGroups), guard)).code;
        else {
          const customer = await this.deps.customer(name, phone, guard); guard(); const currentRole = this.state.choice?.role;
          if (currentRole?.id === 'aparatchi') {
            await this.deps.assign({ principal_role: 'aparatchi', principal_ref: dartTrim(customer.ref), role_id: 'aparatchi', assigned_apparatus: [...this.state.selectedApparatus].sort(), assigned_item_groups: [] }, guard); guard(); code = (await this.deps.regenerateCustomer(customer.ref, guard)).code;
          } else if (currentRole) await this.assign(currentRole, adminUserCreatePrincipalRole(currentRole), customer.ref, guard);
        }
      }
      guard(); this.fields = { name: '', phone: '' }; this.publish({ selectedApparatus: [], selectedGroups: [], fillVersion: this.state.fillVersion + 1 }); guard(); this.deps.invalidateUsers(); guard();
      this.notice(kind === 'supplier' ? 'user.supplier_created' : 'user.created', 'success'); guard(); await this.showCode(code, guard);
    } catch (error) {
      if (this.formCurrent(id, lifetime)) this.notice(kind === 'werka' ? 'user.warehouse_save_failed' : kind === 'supplier' ? 'user.supplier_create_failed' : kind === 'customer' ? 'user.customer_create_failed' : 'user.create_failed', 'error', { error, name: this.fields.name, customerFailure: kind === 'customer' });
    } finally { if (this.formCurrent(id, lifetime)) this.publish({ saving: false }); }
  }
  private clear() { this.cancelTimer(); this.roleFuture = null; this.rolePickerPending = false; this.settings = null; this.fields = { name: '', phone: '' }; this.pickerOutcome = null; const resolve = this.codeResolve; this.codeResolve = null; resolve?.(); }
  dispose() { this.active = false; this.lifetime++; this.readSerial++; this.clear(); this.publish({ ...initial(this.options), valid: !this.retired }); }
  invalidate() { if (this.retired) return; this.retired = true; this.dispose(); }
}
