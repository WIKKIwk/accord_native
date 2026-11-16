import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminSupplierDetail } from './adminSupplierDetailModel';
import { dartTrim } from './dartJsonString';

export type AdminSupplierDetailNotice = Readonly<{ serial: number; key: 'detail.code_copied' | 'detail.phone_save_failed'; error?: unknown }>;
export type AdminSupplierDetailRemovePrompt = Readonly<{ serial: number }>;
export type AdminSupplierDetailState = {
  phase: 'loading' | 'content' | 'error' | 'removed' | 'invalidated'; detail: AdminSupplierDetail | null; seconds: number; expanded: boolean;
  savingStatus: boolean; savingPhone: boolean; regenerating: boolean; removing: boolean; changed: boolean;
  notice: AdminSupplierDetailNotice | null; removePrompt: AdminSupplierDetailRemovePrompt | null;
};
export type AdminSupplierDetailDependencies = {
  isCurrent: () => boolean; readOnly: boolean;
  read: (guard: () => void, witness: () => boolean) => Promise<AdminSupplierDetail>;
  status: (detail: AdminSupplierDetail, blocked: boolean, guard: () => void) => Promise<AdminSupplierDetail>;
  phone: (detail: AdminSupplierDetail, phone: string, guard: () => void) => Promise<AdminSupplierDetail>;
  regenerate: (guard: () => void) => Promise<AdminSupplierDetail>;
  remove: (guard: () => void) => Promise<void>;
  copy: (code: string, guard: () => void) => Promise<void>;
  everySecond?: (callback: () => void) => unknown; cancelTimer?: (timer: unknown) => void;
};
const initial = (): AdminSupplierDetailState => ({ phase: 'loading', detail: null, seconds: 0, expanded: false,
  savingStatus: false, savingPhone: false, regenerating: false, removing: false, changed: false, notice: null, removePrompt: null });

/** @v2 _AdminSupplierDetailScreenState */
export class AdminSupplierDetailController {
  private state = initial(); private active = false; private retired = false; private checking = false;
  private generation = 0; private readSerial = 0; private serial = 0; private timer: unknown = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminSupplierDetailDependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminSupplierDetailState>): void {
    if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; }
    return this.active && !this.retired && generation === this.generation;
  };
  private check(generation: number): void { if (!this.isCurrent(generation)) throw new Error('Admin supplier detail session changed'); }
  private editable(): boolean { return this.isCurrent() && !this.deps.readOnly && this.state.phase === 'content'; }
  private operation(generation: number): () => void { return () => { this.check(generation); if (this.state.phase !== 'content') throw new Error('Admin supplier detail closed'); }; }
  private stopCountdown(): void {
    const timer = this.timer; this.timer = null;
    if (timer !== null) (this.deps.cancelTimer ?? (value => clearInterval(value as ReturnType<typeof setInterval>)))(timer);
  }
  private countdown(seconds: number, patch: Partial<AdminSupplierDetailState>): void {
    this.stopCountdown(); const remaining = Math.max(0, seconds), generation = this.generation;
    this.publish({ ...patch, seconds: remaining });
    if (!this.isCurrent(generation) || !remaining) return;
    this.timer = (this.deps.everySecond ?? (callback => setInterval(callback, 1000)))(() => {
      if (!this.isCurrent(generation)) return;
      const seconds = Math.max(0, this.state.seconds - 1); if (!seconds) this.stopCountdown(); this.publish({ seconds });
    });
  }
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.reload(); }
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.phase === 'removed') return;
    const generation = this.generation, serial = ++this.readSerial;
    const guard = () => { this.check(generation); if (serial !== this.readSerial) throw new Error('Admin supplier detail read changed'); };
    this.publish({ phase: 'loading', detail: null, removePrompt: null });
    try {
      guard(); const detail = await this.deps.read(guard, () => { guard(); return true; }); guard();
      this.countdown(detail.code_retry_after_sec, { phase: 'content', detail });
    } catch { if (this.isCurrent(generation) && serial === this.readSerial) this.publish({ phase: 'error', detail: null }); }
  }
  toggle(): void { if (this.editable()) this.publish({ expanded: !this.state.expanded }); }
  async toggleBlocked(detail: AdminSupplierDetail): Promise<void> {
    if (!this.editable() || this.state.savingStatus) return;
    const generation = this.generation, guard = this.operation(generation); this.publish({ savingStatus: true });
    try { guard(); const updated = await this.deps.status(detail, !detail.blocked, guard); guard(); this.publish({ detail: updated, changed: true }); }
    finally { if (this.isCurrent(generation)) this.publish({ savingStatus: false }); }
  }
  /** Source catches phone failures: the child editor closes after both failure and empty input. */
  async savePhone(detail: AdminSupplierDetail, input: string): Promise<boolean> {
    if (!this.editable() || this.state.savingPhone) return false;
    const phone = dartTrim(input); if (!phone) return true;
    const generation = this.generation, guard = this.operation(generation); this.publish({ savingPhone: true });
    try { guard(); const updated = await this.deps.phone(detail, phone, guard); guard(); this.publish({ detail: updated, changed: true }); }
    catch (error) { if (this.isCurrent(generation) && this.state.phase === 'content') this.publish({ notice: { serial: ++this.serial, key: 'detail.phone_save_failed', error } }); }
    finally { if (this.isCurrent(generation)) this.publish({ savingPhone: false }); }
    return this.isCurrent(generation) && this.state.phase === 'content';
  }
  async regenerate(): Promise<void> {
    if (!this.editable() || this.state.regenerating) return;
    const generation = this.generation, guard = this.operation(generation); this.publish({ regenerating: true });
    try { guard(); const detail = await this.deps.regenerate(guard); guard(); this.countdown(detail.code_retry_after_sec, { detail, changed: true }); }
    finally { if (this.isCurrent(generation)) this.publish({ regenerating: false }); }
  }
  async copy(code: string): Promise<void> {
    if (!this.editable() || !dartTrim(code)) return;
    const generation = this.generation, guard = this.operation(generation); guard(); await this.deps.copy(code, guard); guard();
    this.publish({ notice: { serial: ++this.serial, key: 'detail.code_copied' } });
  }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice?.serial === serial) this.publish({ notice: null }); }
  requestRemove(): void {
    if (this.editable() && !this.state.removing) this.publish({ removePrompt: Object.freeze({ serial: ++this.serial }) });
  }
  dismissRemove(prompt: AdminSupplierDetailRemovePrompt): void { if (this.isCurrent() && this.state.removePrompt === prompt) this.publish({ removePrompt: null }); }
  async confirmRemove(prompt: AdminSupplierDetailRemovePrompt): Promise<boolean> {
    if (!this.editable() || this.state.removing || this.state.removePrompt !== prompt) return false;
    const generation = this.generation, guard = this.operation(generation);
    // The platform host removes its dialog before invoking this original prompt callback.
    this.publish({ removePrompt: null, removing: true });
    try {
      guard(); await this.deps.remove(guard); guard(); this.stopCountdown();
      this.publish({ phase: 'removed', changed: true }); return this.isCurrent(generation);
    } finally { if (this.isCurrent(generation)) this.publish({ removing: false }); }
  }
  invalidate(): void {
    if (this.retired) return; this.retired = true; this.generation++; this.readSerial++; this.stopCountdown(); this.publish({ ...initial(), phase: 'invalidated' });
  }
  dispose(): void {
    this.active = false; this.generation++; this.readSerial++; this.stopCountdown(); this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'loading' }; this.listeners.clear();
  }
}
