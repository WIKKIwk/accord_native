import type { AdminApparatus } from '../apparatusApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminUserListEntry } from './adminUsersModel';
import type { AdminWorkerDetail, AdminWorkerDetailProfile } from './adminWorkerDetailModel';
import { adminWorkerDetailIsPreparation, adminWorkerDetailIsSystem, adminWorkerDetailWarehouseEnabled } from './adminWorkerDetailModel';
import type { AdminWorkerDetailResponsibility } from './adminWorkerDetailAssignmentsApi';
import { dartTrim } from './dartJsonString';

export type AdminWorkerDetailNotice = { serial: number; key: string; values?: Record<string, unknown> } | { serial: number; message: string };
export type AdminWorkerDetailState = {
  phase: 'content' | 'invalidated'; detail: AdminWorkerDetail | null; profile: AdminWorkerDetailProfile | null; apparatus: readonly AdminApparatus[];
  loading: boolean; loadError: boolean; profileLoading: boolean; profileError: boolean; expanded: boolean;
  savingPhone: boolean; regeneratingCode: boolean; phoneEditing: boolean; phoneDraft: string; phoneFillVersion: number;
  changed: boolean; retryAfterSec: number; warehouses: readonly string[]; responsibilities: readonly AdminWorkerDetailResponsibility[]; notice: AdminWorkerDetailNotice | null;
};
export type AdminWorkerDetailDependencies = {
  entry: AdminUserListEntry; readOnly: boolean; isCurrent: () => boolean;
  detail: (guard: () => void, witness: () => boolean) => Promise<AdminWorkerDetail>;
  profile: (guard: () => void, witness: () => boolean) => Promise<AdminWorkerDetailProfile>;
  apparatus: (guard: () => void, witness: () => boolean) => Promise<readonly AdminApparatus[]>;
  warehouses: (guard: () => void, witness: () => boolean) => Promise<readonly string[]>;
  responsibilities: (guard: () => void, witness: () => boolean) => Promise<readonly AdminWorkerDetailResponsibility[]>;
  savePhone: (detail: AdminWorkerDetail, phone: string, guard: () => void) => Promise<string>;
  regenerate: (guard: () => void) => Promise<AdminWorkerDetail>;
  copy: (value: string) => Promise<unknown>;
  timeout?: <T>(promise: Promise<T>, message: string) => Promise<T>;
  schedule?: (callback: () => void, delay: number) => unknown; cancel?: (handle: unknown) => void;
};
const initial = (): AdminWorkerDetailState => ({ phase: 'content', detail: null, profile: null, apparatus: [], loading: true, loadError: false, profileLoading: false, profileError: false,
  expanded: false, savingPhone: false, regeneratingCode: false, phoneEditing: false, phoneDraft: '', phoneFillVersion: 0, changed: false, retryAfterSec: 0, warehouses: [], responsibilities: [], notice: null });
/** @v2 _AdminWorkerDetailScreenState */
export class AdminWorkerDetailController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0;
  private loadSerial = 0; private profileSerial = 0; private noticeSerial = 0; private phoneGeneration = 0; private retryTimer: unknown = null;
  private readonly timeouts = new Set<() => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminWorkerDetailDependencies) {}
  get interactionGeneration(): number { return this.generation; }
  get phoneInteractionGeneration(): number { return this.phoneGeneration; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkerDetailState>): void {
    if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const current = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!current || this.retired) { this.invalidate(); return false; } return true;
  };
  private guard(generation: number): void { if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin worker detail session changed'); }
  private timeout<T>(promise: Promise<T>, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false, timer: unknown = null;
      const settle = (complete: () => void) => {
        if (finished) return; finished = true;
        if (timer !== null) (this.deps.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>)))(timer);
        this.timeouts.delete(stop); complete();
      };
      const stop = () => settle(() => reject(new Error('Admin worker detail owner closed')));
      this.timeouts.add(stop);
      if (!this.deps.timeout) timer = (this.deps.schedule ?? setTimeout)(() => settle(() => reject(new Error(message))), 15_000);
      try {
        const result = this.deps.timeout ? this.deps.timeout(promise, message) : promise;
        void Promise.resolve(result).then(value => settle(() => resolve(value)), error => settle(() => reject(error)));
      } catch (error) { settle(() => reject(error)); }
    });
  }
  start(): void { if (this.active || this.retired) return; this.active = true; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent()) return;
    let pending = true;
    const generation = this.generation, serial = ++this.loadSerial, check = () => { this.guard(generation); if (!pending || serial !== this.loadSerial) throw new Error('Admin worker detail load changed'); }, witness = () => { check(); return true; };
    this.profileSerial++;
    this.publish({ loading: true, loadError: false, profile: null, profileError: false, profileLoading: !adminWorkerDetailIsSystem(this.deps.entry) });
    try {
      check(); const detail = await this.timeout(this.deps.detail(check, witness), 'Profil yuklash vaqti tugadi'); check();
      const warehouses = adminWorkerDetailWarehouseEnabled(this.deps.entry, this.deps.readOnly) ? await this.timeout(this.deps.warehouses(check, witness), 'Omborlar yuklash vaqti tugadi') : []; check();
      const responsibilities = adminWorkerDetailIsPreparation(this.deps.entry) ? await this.timeout(this.deps.responsibilities(check, witness), 'Homashyolar yuklash vaqti tugadi') : []; check();
      this.setRetry(detail.code_retry_after_sec); check(); this.installDetail(detail, { loading: false, loadError: false, warehouses, responsibilities }); check();
      if (!adminWorkerDetailIsSystem(this.deps.entry)) await this.reloadProfile();
    } catch {
      if (generation === this.generation && serial === this.loadSerial && this.isCurrent()) this.publish({ loading: false, loadError: true, profileLoading: false, profileError: !adminWorkerDetailIsSystem(this.deps.entry) });
    } finally { pending = false; }
  }
  async reloadProfile(): Promise<void> {
    if (!this.isCurrent() || adminWorkerDetailIsSystem(this.deps.entry)) return;
    let pending = true;
    const generation = this.generation, serial = ++this.profileSerial, check = () => { this.guard(generation); if (!pending || serial !== this.profileSerial) throw new Error('Admin worker profile load changed'); }, witness = () => { check(); return true; };
    this.publish({ profileLoading: true, profileError: false });
    try {
      check(); const [profile, apparatus] = await this.timeout(Promise.all([this.deps.profile(check, witness), this.deps.apparatus(check, witness)]), 'Ish faoliyati yuklash vaqti tugadi'); check();
      this.publish({ profile, apparatus, profileLoading: false, profileError: false });
    } catch { if (generation === this.generation && serial === this.profileSerial && this.isCurrent()) this.publish({ profileLoading: false, profileError: true }); }
    finally { pending = false; }
  }
  private installDetail(detail: AdminWorkerDetail, patch: Partial<AdminWorkerDetailState> = {}): void {
    const fill = !this.state.phoneEditing && this.state.detail?.phone !== detail.phone;
    this.publish({ detail, ...(fill ? { phoneDraft: dartTrim(detail.phone), phoneFillVersion: this.state.phoneFillVersion + 1 } : {}), ...patch });
  }
  expand(expanded: boolean, fallback: AdminWorkerDetail): void {
    if (!this.isCurrent() || this.deps.readOnly) return;
    if (expanded === this.state.expanded) return;
    this.phoneGeneration++;
    this.publish({ expanded, phoneEditing: false, phoneDraft: expanded ? dartTrim((this.state.detail ?? fallback).phone) : '', phoneFillVersion: this.state.phoneFillVersion + 1 });
  }
  editPhone(): void { if (this.isCurrent() && !this.deps.readOnly && this.state.expanded && !this.state.savingPhone) this.publish({ phoneEditing: true }); }
  changePhone(phoneDraft: string): void { if (this.isCurrent() && !this.deps.readOnly && this.state.expanded && this.state.phoneEditing) this.publish({ phoneDraft }); }
  async savePhone(fallback: AdminWorkerDetail): Promise<boolean> {
    if (!this.isCurrent() || this.deps.readOnly || !this.state.expanded || !this.state.phoneEditing) return false;
    const phone = dartTrim(this.state.phoneDraft); if (!phone) return false;
    const generation = this.generation, phoneGeneration = this.phoneGeneration, check = () => this.guard(generation), detail = this.state.detail ?? fallback;
    this.publish({ savingPhone: true });
    try {
      check(); const updatedPhone = await this.deps.savePhone(detail, phone, check); check();
      // Source copies the captured detail, including its code, after the phone acknowledgement.
      this.installDetail(Object.freeze({ ...detail, phone: updatedPhone }), { changed: true,
        ...(phoneGeneration === this.phoneGeneration ? { phoneEditing: false, phoneDraft: dartTrim(updatedPhone), phoneFillVersion: this.state.phoneFillVersion + 1 } : {}) }); return true;
    } catch (error) { if (generation === this.generation && this.isCurrent()) this.notice('detail.phone_save_failed', { error }); return false; }
    finally { if (generation === this.generation && this.isCurrent()) this.publish({ savingPhone: false }); }
  }
  async regenerate(): Promise<void> {
    if (!this.isCurrent() || this.deps.readOnly || !this.state.expanded || this.state.regeneratingCode) return;
    const generation = this.generation, check = () => this.guard(generation); this.publish({ regeneratingCode: true });
    try { check(); const detail = await this.deps.regenerate(check); check(); this.setRetry(detail.code_retry_after_sec); check(); this.installDetail(detail, { changed: true }); }
    catch (error) { if (generation === this.generation && this.isCurrent()) this.notice('detail.code_update_failed', { error }); }
    finally { if (generation === this.generation && this.isCurrent()) this.publish({ regeneratingCode: false }); }
  }
  async copy(code: string): Promise<void> {
    if (!this.isCurrent() || this.deps.readOnly || !this.state.expanded) return;
    const generation = this.generation, check = () => this.guard(generation); check(); const copied = await this.deps.copy(code); check();
    if (copied === false) throw new Error('Clipboard write failed');
    this.notice('detail.code_copied');
  }
  notice(key: string, values?: Record<string, unknown>): void { if (this.isCurrent()) this.publish({ notice: { serial: ++this.noticeSerial, key, values } }); }
  rawNotice(message: string): void { if (this.isCurrent()) this.publish({ notice: { serial: ++this.noticeSerial, message } }); }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  updateWarehouses(warehouses: readonly string[]): void { if (this.isCurrent()) this.publish({ warehouses, changed: true }); }
  updateResponsibilities(responsibilities: readonly AdminWorkerDetailResponsibility[]): void { if (this.isCurrent()) this.publish({ responsibilities, changed: true }); }
  private stopRetry(): void { if (this.retryTimer !== null) { (this.deps.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.retryTimer); this.retryTimer = null; } }
  private setRetry(seconds: number): void {
    this.stopRetry(); const remaining = Math.max(0, seconds); this.publish({ retryAfterSec: remaining }); if (!remaining || !this.isCurrent()) return;
    const generation = this.generation;
    const tick = () => { this.retryTimer = null; if (generation !== this.generation || !this.isCurrent()) return;
      const next = Math.max(0, this.state.retryAfterSec - 1); this.publish({ retryAfterSec: next });
      if (next && generation === this.generation && this.isCurrent()) this.retryTimer = (this.deps.schedule ?? setTimeout)(tick, 1000);
    };
    this.retryTimer = (this.deps.schedule ?? setTimeout)(tick, 1000);
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.phoneGeneration++; this.loadSerial++; this.profileSerial++; this.stopRetry(); for (const stop of [...this.timeouts]) stop(); this.publish({ ...initial(), phase: 'invalidated', loading: false }); }
  dispose(): void { this.active = false; this.generation++; this.phoneGeneration++; this.loadSerial++; this.profileSerial++; this.stopRetry(); for (const stop of [...this.timeouts]) stop(); this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'content' }; this.listeners.clear(); }
}
