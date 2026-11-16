import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminSettings } from './adminSettings';
import { dartTrim } from './dartJsonString';

export type AdminWerkaFields = { name: string; phone: string };
export type AdminWerkaState = {
  phase: 'loading' | 'content' | 'error' | 'invalidated'; fields: AdminWerkaFields; fillVersion: number;
  avatarUrl: string; code: string; seconds: number; saving: boolean; regenerating: boolean; expanded: boolean;
  changed: boolean; copiedNotice: number | null;
};
export type AdminWerkaDependencies = {
  isCurrent: () => boolean;
  read: (guard: () => void, witness: () => boolean) => Promise<AdminSettings>;
  write: (settings: AdminSettings, guard: () => void) => Promise<AdminSettings>;
  regenerate: (guard: () => void) => Promise<AdminSettings>;
  copy: (code: string, guard: () => void) => Promise<void>;
  everySecond?: (callback: () => void) => unknown; cancelTimer?: (timer: unknown) => void;
};
const initial = (): AdminWerkaState => ({ phase: 'loading', fields: { name: '', phone: '' }, fillVersion: 0, avatarUrl: '',
  code: '', seconds: 0, saving: false, regenerating: false, expanded: false, changed: false, copiedNotice: null });

/** @v2 _AdminWerkaScreenState */
export class AdminWerkaController {
  private state = initial();
  private fields: AdminWerkaFields = { name: '', phone: '' };
  private settings: AdminSettings | null = null;
  private active = false; private retired = false; private checking = false; private generation = 0; private readSerial = 0; private noticeSerial = 0;
  private timer: unknown = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminWerkaDependencies) {}
  getSnapshot = () => this.state;
  // A locale rebuild reads Flutter's live TextEditingController, without publishing on each edit.
  get currentFields(): AdminWerkaFields { return { ...this.fields }; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get interactionGeneration() { return this.generation; }
  private publish(patch: Partial<AdminWerkaState>): void {
    if (!this.active) return;
    this.state = { ...this.state, fields: { ...this.fields }, ...patch };
    for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; }
    this.checking = true; const value = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!value || this.retired) { this.invalidate(); return false; }
    return this.active && !this.retired && generation === this.generation;
  };
  private guard(generation: number): () => void { return () => { if (!this.isCurrent(generation)) throw new Error('Admin Werka session changed'); }; }
  private cancelCountdown(): void {
    const timer = this.timer; this.timer = null;
    if (timer !== null) (this.deps.cancelTimer ?? (value => clearInterval(value as ReturnType<typeof setInterval>)))(timer);
  }
  private countdown(seconds: number, patch: Partial<AdminWerkaState> = {}): void {
    this.cancelCountdown(); const value = Math.max(0, seconds), generation = this.generation;
    this.publish({ ...patch, seconds: value });
    if (!this.isCurrent(generation) || !value) return;
    this.timer = (this.deps.everySecond ?? (callback => setInterval(callback, 1000)))(() => {
      if (!this.isCurrent(generation)) return;
      const remaining = Math.max(0, this.state.seconds - 1);
      if (!remaining) this.cancelCountdown();
      this.publish({ seconds: remaining });
    });
  }
  start(): void {
    if (this.active || this.retired) return;
    this.active = true; this.generation++;
    void this.reload();
  }
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.saving || this.state.regenerating) return;
    const generation = this.generation, serial = ++this.readSerial, base = this.guard(generation);
    const check = () => { base(); if (serial !== this.readSerial) throw new Error('Admin Werka read changed'); };
    this.cancelCountdown(); this.settings = null; this.fields = { name: '', phone: '' };
    this.publish({ phase: 'loading', avatarUrl: '', code: '', seconds: 0, copiedNotice: null });
    try {
      check(); const settings = await this.deps.read(check, () => { check(); return true; }); check();
      this.settings = settings; this.fields = { name: settings.werka_name, phone: settings.werka_phone };
      this.countdown(settings.werka_code_retry_after_sec, { phase: 'content', avatarUrl: settings.werka_avatar_url,
        code: settings.werka_code, fillVersion: this.state.fillVersion + 1 });
    } catch { if (this.isCurrent(generation) && serial === this.readSerial) this.publish({ phase: 'error' }); }
  }
  change(field: keyof AdminWerkaFields, value: string): void {
    // Flutter TextEditingController edits do not rebuild the parent header until its next state change.
    if (this.isCurrent() && this.state.phase === 'content') this.fields = { ...this.fields, [field]: value };
  }
  toggle(): void { if (this.isCurrent() && this.state.phase === 'content') this.publish({ expanded: !this.state.expanded }); }
  async save(): Promise<void> {
    if (!this.isCurrent() || this.state.phase !== 'content' || !this.settings || this.state.saving) return;
    const generation = this.generation, check = this.guard(generation), current = this.settings;
    // Source uses the loaded snapshot, not a second GET; both fields and countdown are captured before await.
    const payload = { ...current, werka_phone: dartTrim(this.fields.phone), werka_name: dartTrim(this.fields.name),
      werka_code: '', werka_code_retry_after_sec: this.state.seconds };
    this.publish({ saving: true });
    try {
      check(); const updated = await this.deps.write(payload, check); check();
      this.publish({ code: updated.werka_code, changed: true });
    } finally { if (this.isCurrent(generation)) this.publish({ saving: false }); }
  }
  async regenerate(): Promise<void> {
    if (!this.isCurrent() || this.state.phase !== 'content' || this.state.regenerating) return;
    const generation = this.generation, check = this.guard(generation);
    this.publish({ regenerating: true });
    try {
      check(); const updated = await this.deps.regenerate(check); check();
      this.countdown(updated.werka_code_retry_after_sec, { code: updated.werka_code, changed: true });
    } finally { if (this.isCurrent(generation)) this.publish({ regenerating: false }); }
  }
  async copy(): Promise<void> {
    if (!this.isCurrent() || this.state.phase !== 'content' || !dartTrim(this.state.code)) return;
    const generation = this.generation, check = this.guard(generation), code = this.state.code;
    check(); await this.deps.copy(code, check); check(); this.publish({ copiedNotice: ++this.noticeSerial, fields: this.state.fields });
    this.isCurrent(generation);
  }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.copiedNotice === serial) this.publish({ copiedNotice: null, fields: this.state.fields }); }
  invalidate(): void {
    if (this.retired) return;
    this.retired = true; this.generation++; this.readSerial++; this.cancelCountdown(); this.settings = null; this.fields = { name: '', phone: '' };
    this.publish({ ...initial(), phase: 'invalidated' });
  }
  dispose(): void {
    this.active = false; this.generation++; this.readSerial++; this.cancelCountdown(); this.settings = null; this.fields = { name: '', phone: '' };
    this.state = { ...initial(), phase: this.retired ? 'invalidated' : 'loading' }; this.listeners.clear();
  }
}
