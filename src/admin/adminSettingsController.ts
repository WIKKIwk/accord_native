import type { AdminSettings } from './adminSettings';
import { dartTrim } from './dartJsonString';

export const adminSettingsFieldNames = ['erp_url', 'erp_api_key', 'erp_api_secret', 'default_target_warehouse', 'default_uom', 'werka_phone', 'werka_name'] as const;
export const adminSettingsFieldLabels = { erp_url: 'erp_url', erp_api_key: 'api_key', erp_api_secret: 'api_secret',
  default_target_warehouse: 'default_warehouse', default_uom: 'default_uom', werka_phone: 'werka_phone', werka_name: 'werka_name' } as const;
export type AdminSettingsField = typeof adminSettingsFieldNames[number];
export type AdminSettingsFields = Pick<AdminSettings, AdminSettingsField>;
export type AdminSettingsState = {
  phase: 'loading' | 'error' | 'content' | 'invalidated'; fields: AdminSettingsFields; fillVersion: number;
  saving: boolean; changed: boolean; notice: number | null;
};
export type AdminSettingsDependencies = {
  isCurrent: () => boolean;
  read: (guard: () => void, readWitness: () => boolean) => Promise<AdminSettings>;
  write: (settings: AdminSettings, guard: () => void) => Promise<AdminSettings>;
};
const fields = (settings?: AdminSettings): AdminSettingsFields => Object.fromEntries(adminSettingsFieldNames.map(key => [key, settings?.[key] ?? ''])) as AdminSettingsFields;
const initial = (): AdminSettingsState => ({ phase: 'loading', fields: fields(), fillVersion: 0, saving: false, changed: false, notice: null });

/** Source _AdminSettingsScreenState: reread hidden fields before saving, then fill the acknowledged result. */
export class AdminSettingsController {
  private state = initial();
  private readonly listeners = new Set<() => void>();
  private active = false;
  private retired = false;
  private generation = 0;
  private noticeSerial = 0;
  constructor(private readonly deps: AdminSettingsDependencies) {}
  getSnapshot = (): AdminSettingsState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminSettingsState>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (): boolean => {
    if (!this.active || this.retired) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; }
    return true;
  };
  private check(generation: number): void {
    if (generation !== this.generation || !this.isCurrent()) throw new Error('Admin settings session changed');
  }
  start(): void {
    if (this.active || this.retired) return;
    this.active = true; void this.reload();
  }
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.saving) return;
    const generation = ++this.generation, guard = () => this.check(generation);
    this.publish({ phase: 'loading', fields: fields(), notice: null });
    try {
      guard(); const value = await this.deps.read(guard, () => { guard(); return true; }); guard();
      this.publish({ phase: 'content', fields: fields(value), fillVersion: this.state.fillVersion + 1 });
    } catch {
      if (generation === this.generation && this.isCurrent()) this.publish({ phase: 'error' });
    }
  }
  change(key: AdminSettingsField, value: string): void {
    if (this.isCurrent() && this.state.phase === 'content') this.publish({ fields: { ...this.state.fields, [key]: value } });
  }
  async save(): Promise<void> {
    if (!this.isCurrent() || this.state.phase !== 'content' || this.state.saving) return;
    const generation = ++this.generation, guard = () => this.check(generation);
    this.publish({ saving: true, notice: null });
    try {
      guard(); const current = await this.deps.read(guard, () => { guard(); return true; }); guard();
      // V2 reads controllers after this GET. Editing remains enabled while saving.
      const edited = Object.fromEntries(adminSettingsFieldNames.map(key => [key, dartTrim(this.state.fields[key])])) as AdminSettingsFields;
      const payload: AdminSettings = { ...edited, werka_avatar_url: current.werka_avatar_url, werka_code: '',
        werka_code_locked: current.werka_code_locked, werka_code_retry_after_sec: current.werka_code_retry_after_sec,
        admin_phone: current.admin_phone, admin_name: current.admin_name };
      guard(); const result = await this.deps.write(payload, guard); guard();
      this.publish({ fields: fields(result), fillVersion: this.state.fillVersion + 1, changed: true, notice: ++this.noticeSerial });
    } finally {
      if (generation === this.generation && this.isCurrent()) this.publish({ saving: false });
    }
  }
  dismissNotice(serial: number): void { if (this.isCurrent() && this.state.notice === serial) this.publish({ notice: null }); }
  runCurrent(action: () => void): void { if (this.isCurrent()) action(); }
  invalidate(): void {
    if (this.retired) return;
    this.retired = true; this.generation++;
    this.publish({ ...initial(), phase: 'invalidated' });
  }
  dispose(): void { this.active = false; this.generation++; this.listeners.clear(); }
}
