import type { SupplierItem } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminCustomerSameScope, adminCustomerScopeValues, type AdminCustomerDetail } from './adminCustomerDetailModel';
import { dartTrim } from './dartJsonString';

export type AdminCustomerDetailMode = Readonly<{ management: boolean; items: boolean; remove: boolean; material: boolean }>;
export type AdminCustomerDetailNotice = Readonly<{ serial: number; key: string; error?: unknown; operationError?: boolean }> | Readonly<{ serial: number; message: string }>;
export type AdminCustomerDetailPrompt = Readonly<{ serial: number; kind: 'customer' }> | Readonly<{ serial: number; kind: 'item'; item: SupplierItem }>;
export type AdminCustomerDetailState = {
  valid: boolean; removed: boolean; loading: boolean; loadError: unknown; detail: AdminCustomerDetail | null; seconds: number; expanded: boolean; changed: boolean;
  savingPhone: boolean; regenerating: boolean; removing: boolean; addingItem: boolean; editingGroups: boolean; removingItemCode: string | null;
  notice: AdminCustomerDetailNotice | null; prompt: AdminCustomerDetailPrompt | null;
};
export type AdminCustomerGroupChoices = Readonly<{ available: readonly string[]; selected: readonly string[]; isCurrent: () => boolean }>;
export type AdminCustomerDetailDependencies = {
  isCurrent: () => boolean; mode: AdminCustomerDetailMode;
  read: (guard: () => void, witness: () => boolean) => Promise<AdminCustomerDetail>;
  phone: (detail: AdminCustomerDetail, phone: string, guard: () => void) => Promise<AdminCustomerDetail>;
  regenerate: (guard: () => void) => Promise<AdminCustomerDetail>; remove: (guard: () => void) => Promise<void>;
  items: (guard: () => void, witness: () => boolean) => Promise<readonly SupplierItem[]>;
  assign: (item: SupplierItem, guard: () => void) => Promise<AdminCustomerDetail>;
  unassign: (item: SupplierItem, guard: () => void) => Promise<AdminCustomerDetail>;
  groups: (guard: () => void, witness: () => boolean) => Promise<readonly string[]>;
  updateGroups: (detail: AdminCustomerDetail, values: readonly string[], guard: () => void, witness: () => boolean) => Promise<AdminCustomerDetail>;
  copy: (code: string, guard: () => void) => Promise<void>;
  timeout?: <T>(promise: Promise<T>) => Promise<T>;
  everySecond?: (callback: () => void) => unknown; cancelTimer?: (handle: unknown) => void;
};
const initial = (): AdminCustomerDetailState => ({ valid: true, removed: false, loading: true, loadError: null, detail: null, seconds: 0, expanded: false, changed: false,
  savingPhone: false, regenerating: false, removing: false, addingItem: false, editingGroups: false, removingItemCode: null, notice: null, prompt: null });
class CustomerDetailTimeout extends Error { toString() { return 'Exception: Customer detail timeout'; } }

/** @v2 _AdminCustomerDetailScreenState */
export class AdminCustomerDetailController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0; private readSerial = 0; private serial = 0;
  private countdownTimer: unknown = null; private readonly timeouts = new Set<() => void>(); private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminCustomerDetailDependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  get mode() { return this.deps.mode; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminCustomerDetailState>) { if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && !this.retired && generation === this.generation;
  };
  private editable() { return this.isCurrent() && !this.state.removed && this.deps.mode.management; }
  private boundary(generation = this.generation) {
    const witness = () => this.isCurrent(generation) && !this.state.removed;
    return { witness, guard: () => { if (!witness()) throw new Error('Admin customer detail session changed'); } };
  }
  private stopCountdown() {
    const timer = this.countdownTimer; this.countdownTimer = null;
    if (timer !== null) (this.deps.cancelTimer ?? (value => clearInterval(value as ReturnType<typeof setInterval>)))(timer);
  }
  private countdown(seconds: number, patch: Partial<AdminCustomerDetailState> = {}) {
    this.stopCountdown(); const value = Math.max(0, seconds), generation = this.generation; this.publish({ ...patch, seconds: value });
    if (!this.isCurrent(generation) || !value || this.state.removed) return;
    this.countdownTimer = (this.deps.everySecond ?? (callback => setInterval(callback, 1000)))(() => {
      if (!this.isCurrent(generation)) return; const seconds = Math.max(0, this.state.seconds - 1); if (!seconds) this.stopCountdown(); this.publish({ seconds });
    });
  }
  private timed<T>(promise: Promise<T>): Promise<T> {
    if (this.deps.timeout) return this.deps.timeout(promise);
    return new Promise<T>((resolve, reject) => {
      const stop = () => { clearTimeout(timer); this.timeouts.delete(stop); reject(new Error('Admin customer detail owner closed')); };
      const timer = setTimeout(() => { this.timeouts.delete(stop); reject(new CustomerDetailTimeout()); }, 15_000); this.timeouts.add(stop);
      promise.then(value => { clearTimeout(timer); this.timeouts.delete(stop); resolve(value); }, error => { clearTimeout(timer); this.timeouts.delete(stop); reject(error); });
    });
  }
  /** Source _loadDetail resets countdown even when the caller only consumes warehouse scopes. */
  async loadDetail(): Promise<AdminCustomerDetail> {
    const generation = this.generation, base = this.boundary(generation); let pending = true;
    const guard = () => { base.guard(); if (!pending) throw new Error('Customer detail read settled'); };
    try { guard(); const detail = await this.timed(this.deps.read(guard, () => { guard(); return true; })); guard(); this.countdown(detail.code_retry_after_sec); base.guard(); return detail; }
    finally { pending = false; }
  }
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.removed) return; const generation = this.generation, serial = ++this.readSerial; this.publish({ loading: true, loadError: null });
    try { const detail = await this.loadDetail(); if (this.isCurrent(generation) && serial === this.readSerial && !this.state.removed) this.publish({ detail, loading: false, loadError: null }); }
    catch (error) { if (this.isCurrent(generation) && serial === this.readSerial && !this.state.removed) this.publish({ detail: null, loading: false, loadError: error }); }
  }
  toggle(): void { if (this.editable()) this.publish({ expanded: !this.state.expanded }); }
  private notice(key: string, error?: unknown, operationError = false) { if (this.isCurrent() && !this.state.removed) this.publish({ notice: { serial: ++this.serial, key, error, operationError } }); }
  /** A genuine source child shares this screen's ScaffoldMessenger and captured localized message. */
  childNotice(message: string): void { if (this.editable()) this.publish({ notice: Object.freeze({ serial: ++this.serial, message }) }); }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  /** Phone failure/empty input resolves normally in V2, so a still-mounted editor closes. */
  async savePhone(detail: AdminCustomerDetail, input: string): Promise<boolean> {
    if (!this.editable() || this.state.savingPhone) return false; const phone = dartTrim(input); if (!phone) return true;
    const generation = this.generation, { guard } = this.boundary(generation); this.publish({ savingPhone: true });
    try { guard(); const updated = await this.deps.phone(detail, phone, guard); guard(); this.countdown(updated.code_retry_after_sec, { detail: updated, changed: true }); }
    catch (error) { if (this.isCurrent(generation) && !this.state.removed) this.notice('detail.phone_save_failed', error); }
    finally { if (this.isCurrent(generation)) this.publish({ savingPhone: false }); }
    return this.isCurrent(generation) && !this.state.removed;
  }
  async regenerate(): Promise<void> {
    if (!this.editable() || this.state.regenerating) return; const generation = this.generation, { guard } = this.boundary(generation); this.publish({ regenerating: true });
    try { guard(); const updated = await this.deps.regenerate(guard); guard(); this.countdown(updated.code_retry_after_sec, { detail: updated, changed: true }); }
    catch (error) { if (this.isCurrent(generation) && !this.state.removed) this.notice('detail.code_update_failed', error); }
    finally { if (this.isCurrent(generation)) this.publish({ regenerating: false }); }
  }
  async copy(code: string): Promise<void> {
    if (!this.editable() || !dartTrim(code)) return; const { guard } = this.boundary(); guard(); await this.deps.copy(code, guard); guard(); this.notice('detail.code_copied');
  }
  async availableItems(): Promise<{ detail: AdminCustomerDetail; items: readonly SupplierItem[] } | null> {
    if (!this.editable() || !this.deps.mode.items || !this.state.detail) return null;
    const detail = this.state.detail, { guard, witness } = this.boundary(); guard(); const all = await this.deps.items(guard, witness); guard();
    const assigned = new Set(detail.assigned_items.map(item => item.code)), items = all.filter(item => !assigned.has(item.code));
    if (!items.length) { this.notice('detail.no_items'); return null; } return { detail, items };
  }
  /** Other sheet rows remain enabled: source uses a boolean, rather than counting concurrent item operations. */
  async assignItem(item: SupplierItem): Promise<boolean> {
    if (!this.editable() || !this.deps.mode.items) return false; const generation = this.generation, { guard } = this.boundary(generation); this.publish({ addingItem: true });
    try { guard(); const detail = await this.deps.assign(item, guard); guard(); this.publish({ detail, changed: true }); return true; }
    catch (error) { if (this.isCurrent(generation) && !this.state.removed) this.notice('detail.item_assign_failed', error); return false; }
    finally { if (this.isCurrent(generation)) this.publish({ addingItem: false }); }
  }
  requestRemove(item?: SupplierItem): void {
    if (!this.editable() || this.state.prompt || (item ? !this.deps.mode.items : !this.deps.mode.remove || this.state.removing)) return;
    this.publish({ prompt: item ? Object.freeze({ serial: ++this.serial, kind: 'item', item }) : Object.freeze({ serial: ++this.serial, kind: 'customer' }) });
  }
  dismissPrompt(prompt: AdminCustomerDetailPrompt): void { if (this.isCurrent() && this.state.prompt === prompt) this.publish({ prompt: null }); }
  async confirmRemove(prompt: AdminCustomerDetailPrompt): Promise<boolean> {
    if (!this.editable() || this.state.prompt !== prompt) return false;
    const generation = this.generation, { guard } = this.boundary(generation);
    this.publish({ prompt: null, ...(prompt.kind === 'customer' ? { removing: true } : { removingItemCode: prompt.item.code }) });
    try {
      guard();
      if (prompt.kind === 'customer') { await this.deps.remove(guard); guard(); this.stopCountdown(); this.publish({ changed: true, removed: true }); }
      else { const detail = await this.deps.unassign(prompt.item, guard); guard(); this.publish({ changed: true, detail }); }
      return this.isCurrent(generation);
    } catch (error) { if (this.isCurrent(generation) && !this.state.removed) this.notice(prompt.kind === 'customer' ? 'detail.customer_remove_failed' : 'detail.item_unlink_failed', error); return false; }
    finally { if (this.isCurrent(generation)) this.publish(prompt.kind === 'customer' ? { removing: false } : { removingItemCode: null }); }
  }
  async editGroups(pick: (choices: AdminCustomerGroupChoices) => Promise<readonly string[] | null>): Promise<void> {
    if (!this.editable() || !this.deps.mode.material || !this.state.detail || this.state.editingGroups) return;
    const detail = this.state.detail, generation = this.generation, { guard, witness } = this.boundary(generation); this.publish({ editingGroups: true });
    try {
      guard(); const available = adminCustomerScopeValues([...(await this.deps.groups(guard, witness)), ...detail.assigned_item_groups]); guard();
      if (!available.length) { this.notice('detail.no_groups'); return; }
      const selected = await pick({ available, selected: detail.assigned_item_groups, isCurrent: witness }); guard(); if (selected === null) return;
      const normalized = adminCustomerScopeValues(selected); if (adminCustomerSameScope(normalized, detail.assigned_item_groups)) return;
      await this.deps.updateGroups(detail, normalized, guard, witness); guard(); const updated = await this.loadDetail(); guard();
      if (!adminCustomerSameScope(updated.assigned_item_groups, normalized)) throw new MobileApiException({ code: 'material_item_groups_not_confirmed', message: 'Server mahsulot guruhlari saqlanganini tasdiqlamadi' });
      this.publish({ detail: updated, changed: true }); this.notice('detail.groups_saved');
    } catch (error) { if (this.isCurrent(generation) && !this.state.removed) this.notice('detail.groups_save_failed', error, true); }
    finally { if (this.isCurrent(generation)) this.publish({ editingGroups: false }); }
  }
  warehousesChanged(warehouses: readonly string[]): void {
    if (this.editable() && this.deps.mode.material) this.publish({ changed: true, detail: this.state.detail ? Object.freeze({ ...this.state.detail, assigned_warehouses: Object.freeze([...warehouses]) }) : null });
  }
  apparatusChanged(): void { if (this.editable()) this.publish({ changed: true }); }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.readSerial++; this.stopCountdown(); for (const stop of [...this.timeouts]) stop(); this.publish({ ...initial(), valid: false, loading: false }); }
  dispose(): void { this.active = false; this.generation++; this.readSerial++; this.stopCountdown(); for (const stop of [...this.timeouts]) stop(); this.state = { ...initial(), valid: !this.retired }; this.listeners.clear(); }
}
