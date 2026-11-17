import type { FirebaseClientConfig } from '../mobilePushConfigApi';
import { MobileApiException } from '../shared/mobileApiException';
import type { AdminPushConfigDevice } from './AdminPushConfigScreenTypes';
import { parseAdminPushConfigAccount, readAdminPushConfigAccountFile, type AdminPushConfig, type AdminPushConfigFile, type AdminPushConfigPlatform } from './adminPushConfigModel';
import { readAdminPushConfigClientFile } from './adminPushConfigFiles';

export type AdminPushConfigState = { config: AdminPushConfig | null; busy: boolean; error: string | null;
  notice: 'saved' | 'verified' | 'test_sent' | 'mobile_saved' | null; json: string; fillVersion: number; fileName: string | null; invalidated: boolean };
export type AdminPushConfigDependencies = {
  isCurrent: () => boolean; device: AdminPushConfigDevice; deviceTokenProvider?: (guard: () => void) => Promise<string>;
  read: (guard: () => void) => Promise<AdminPushConfig>;
  save: (account: Record<string, unknown>, guard: () => void) => Promise<AdminPushConfig>;
  check: (guard: () => void) => Promise<AdminPushConfig>;
  test: (token: string, guard: () => void) => Promise<void>;
  saveMobile: (platform: AdminPushConfigPlatform, client: FirebaseClientConfig, guard: () => void) => Promise<AdminPushConfig>;
  pick: (kind: 'account' | AdminPushConfigPlatform, guard: () => void) => Promise<AdminPushConfigFile | null>;
};
const initial = (): AdminPushConfigState => ({ config: null, busy: true, error: null, notice: null, json: '', fillVersion: 0, fileName: null, invalidated: false });

/** Source AdminPushConfigScreen operations keep server status separate from the current device status. */
export class AdminPushConfigController {
  private state = initial();
  private active = false;
  private retired = false;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  private stopDevice: (() => void) | null = null;
  constructor(private readonly deps: AdminPushConfigDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminPushConfigState>): void {
    if (!this.active || this.retired) return;
    this.state = { ...this.state, ...patch }; [...this.listeners].forEach(listener => listener());
  }
  current = (): boolean => {
    if (!this.active || this.retired) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; }
    return true;
  };
  private guard = () => { if (!this.current()) throw new Error('Push configuration owner changed'); };
  start(): void {
    if (this.active || this.retired) return;
    this.state = initial();
    this.active = true;
    this.stopDevice = this.deps.device.subscribe(() => {
      if (!this.current()) return;
      if (this.deps.device.getSnapshot().status === 'device_registered' && this.state.error?.startsWith('push_config_apns_')) this.publish({ error: null });
    });
    void this.run(async guard => {
      const config = await this.deps.read(guard); guard(); this.publish({ config, error: config.error || null });
      if (!this.deps.deviceTokenProvider) { guard(); await this.deps.device.initialize(guard); guard(); }
    }, true);
  }
  private async run(action: (guard: () => void) => Promise<void>, initial = false): Promise<void> {
    if (!this.current() || (!initial && this.state.busy)) return;
    const generation = ++this.generation, guard = () => { this.guard(); if (generation !== this.generation) throw new Error('Push configuration operation changed'); };
    this.publish({ busy: true, error: null, notice: null });
    try { guard(); await action(guard); guard(); }
    catch (error) {
      if (generation === this.generation && this.current()) this.publish({ error: error instanceof MobileApiException ? error.code : 'push_config_request_failed' });
    } finally { if (generation === this.generation && this.current()) this.publish({ busy: false }); }
  }
  changeJson(value: string): void { if (this.current() && !this.state.busy) this.publish({ json: value }); }
  reload = () => this.run(async guard => {
    const config = await this.deps.read(guard); guard(); this.publish({ config, error: config.error || null });
    if (!this.deps.deviceTokenProvider) { guard(); await this.deps.device.initialize(guard); guard(); }
  });
  pick = () => this.run(async guard => {
    const file = await this.deps.pick('account', guard); guard(); if (!file) return;
    const json = readAdminPushConfigAccountFile(file); guard(); this.publish({ json, fileName: file.name, fillVersion: this.state.fillVersion + 1 });
  });
  save = () => this.run(async guard => {
    const account = parseAdminPushConfigAccount(this.state.json), config = await this.deps.save(account, guard); guard();
    this.publish({ config, json: '', fileName: null, notice: 'saved', fillVersion: this.state.fillVersion + 1 });
  });
  check = () => { if (this.state.config?.configured !== true) return Promise.resolve(); return this.run(async guard => {
    const config = await this.deps.check(guard); guard(); this.publish({ config, notice: 'verified' });
  }); };
  test = () => { if (this.state.config?.configured !== true) return Promise.resolve(); return this.run(async guard => {
    const token = await (this.deps.deviceTokenProvider ? this.deps.deviceTokenProvider(guard) : this.deps.device.prepareConfigurationTest(guard)); guard();
    await this.deps.test(token, guard); guard(); this.publish({ notice: 'test_sent' });
  }); };
  pickMobile = (platform: AdminPushConfigPlatform) => { if (this.state.config?.configured !== true) return Promise.resolve(); return this.run(async guard => {
    const file = await this.deps.pick(platform, guard); guard(); if (!file) return;
    const client = readAdminPushConfigClientFile(file, platform), config = await this.deps.saveMobile(platform, client, guard); guard();
    this.publish({ config, notice: 'mobile_saved' });
    if (!this.deps.deviceTokenProvider) { guard(); await this.deps.device.initialize(guard); guard(); }
  }); };
  applyDevice = () => this.run(async guard => { await this.deps.device.initialize(guard); guard(); });
  invalidate(): void {
    if (this.retired) return;
    this.retired = true; this.generation++; this.stopDevice?.(); this.stopDevice = null;
    this.state = { ...initial(), busy: false, invalidated: true }; [...this.listeners].forEach(listener => listener());
  }
  dispose(): void {
    this.active = false; this.generation++; this.stopDevice?.(); this.stopDevice = null;
    this.state = { ...initial(), busy: false, invalidated: true }; this.listeners.clear();
  }
}
