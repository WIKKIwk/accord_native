import type { AdminLaminationLabelSettings, PaddonManagementSettings } from './productionSettingsApi';
import type { AdminQolipStartSettings } from './qolipStartSettingsApi';

export type SettingsCard<T> = { value: T | null; busy: boolean; failed: boolean };
export type SettingsNotice = { source: 'getter' | 'production'; key: string; serial: number };
export type AdditionalSettingsSnapshot = {
  screen: 'forbidden' | 'loading' | 'error' | 'content'; operator: boolean; paddon: SettingsCard<PaddonManagementSettings>;
  appUpdate: SettingsCard<boolean>; lamination: SettingsCard<AdminLaminationLabelSettings>; qolip: SettingsCard<AdminQolipStartSettings>;
  confirmFreeMovement: boolean; confirmationSerial: number; notice: SettingsNotice | null;
};
export type AdditionalSettingsDependencies = {
  isCurrent: () => boolean; scope: () => string; canOpen: () => boolean; isOperator: () => boolean;
  readPaddon: () => Promise<PaddonManagementSettings>;
  writePaddon: (change: { freeMovementEnabled?: boolean; workerVisibilityEnabled?: boolean }) => Promise<PaddonManagementSettings>;
  readAppUpdate: () => Promise<boolean>; writeAppUpdate: (enabled: boolean) => Promise<boolean>;
  readLamination: () => Promise<AdminLaminationLabelSettings>;
  writeLamination: (change: { printWipRemainderLabels?: boolean; printFilmRemainderLabels?: boolean }) => Promise<AdminLaminationLabelSettings>;
  readQolip: () => Promise<AdminQolipStartSettings>; writeQolip: (enabled: boolean) => Promise<AdminQolipStartSettings>;
};
type CardName = 'appUpdate' | 'lamination' | 'qolip';
type CardValues = { appUpdate: boolean; lamination: AdminLaminationLabelSettings; qolip: AdminQolipStartSettings };
const emptyCard = <T>(): SettingsCard<T> => ({ value: null, busy: true, failed: false });
function initial(operator: boolean): AdditionalSettingsSnapshot {
  return { screen: 'loading', operator, paddon: emptyCard(), appUpdate: emptyCard(), lamination: emptyCard(), qolip: emptyCard(),
    confirmFreeMovement: false, confirmationSerial: 0, notice: null };
}

/** @v2 _AdminAdditionalSettingsScreenState */
export class AdditionalSettingsController {
  private state: AdditionalSettingsSnapshot;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private loadedScope: string | null = null;
  private noticeSerial = 0;
  private confirmationSerial = 0;
  private cardVersion: Record<CardName, number> = { appUpdate: 0, lamination: 0, qolip: 0 };
  private confirmation: { scope: string; epoch: number } | null = null;
  private alive = true;
  constructor(private readonly deps: AdditionalSettingsDependencies) { this.state = initial(deps.isOperator()); }
  getSnapshot = (): AdditionalSettingsSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private patch(patch: Partial<AdditionalSettingsSnapshot>): void {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private valid(scope: string, epoch = this.epoch): boolean {
    return this.alive && epoch === this.epoch && this.loadedScope === scope && this.deps.isCurrent() && this.deps.canOpen() && this.deps.scope() === scope;
  }
  // Never retain another session's values after listeners or an async attempt change the scope.
  private currentOrInvalidate(scope: string, epoch: number): boolean {
    if (this.valid(scope, epoch)) return true;
    if (this.alive && epoch === this.epoch) this.invalidate();
    return false;
  }
  private notify(source: SettingsNotice['source'], key: string): void {
    this.patch({ notice: { source, key, serial: ++this.noticeSerial } });
  }
  dismissNotice(serial: number): void { if (this.state.notice?.serial === serial) this.patch({ notice: null }); }
  start(): void {
    if (!this.alive) { this.alive = true; this.state = initial(this.deps.isOperator()); }
    if (!this.deps.isCurrent() || !this.deps.canOpen()) { this.patch({ screen: 'forbidden' }); return; }
    void this.refresh();
  }
  invalidate(): void {
    this.epoch++; this.loadedScope = null; this.confirmation = null;
    this.patch({ screen: 'forbidden', confirmFreeMovement: false, notice: null, paddon: emptyCard(), appUpdate: emptyCard(),
      lamination: emptyCard(), qolip: emptyCard() });
  }
  dispose(): void { this.epoch++; this.loadedScope = null; this.confirmation = null; this.alive = false; this.listeners.clear(); }
  async refresh(force = false): Promise<void> {
    if (!this.alive || !this.deps.isCurrent() || !this.deps.canOpen() || (!force && this.state.paddon.busy && this.state.screen === 'content')) return;
    const scope = this.deps.scope(), epoch = ++this.epoch;
    this.loadedScope = scope;
    for (const name of ['appUpdate', 'lamination', 'qolip'] as const) this.cardVersion[name]++;
    this.confirmation = null;
    this.patch({ screen: 'loading', operator: this.deps.isOperator(), confirmFreeMovement: false,
      paddon: emptyCard(), appUpdate: emptyCard(), lamination: emptyCard(), qolip: emptyCard() });
    if (!this.currentOrInvalidate(scope, epoch)) return;
    try {
      const value = await this.deps.readPaddon();
      if (!this.currentOrInvalidate(scope, epoch)) return;
      this.patch({ screen: 'content', paddon: { value, busy: false, failed: false } });
      if (!this.currentOrInvalidate(scope, epoch)) return;
      if (!this.deps.isOperator()) {
        void this.loadCard('appUpdate', scope, epoch);
        void this.loadCard('lamination', scope, epoch);
        void this.loadCard('qolip', scope, epoch);
      }
    } catch {
      if (this.currentOrInvalidate(scope, epoch)) this.patch({ screen: 'error', paddon: { value: null, busy: false, failed: true } });
    }
  }
  private async loadCard<K extends CardName>(name: K, scope: string, epoch: number): Promise<void> {
    if (!this.valid(scope, epoch) || this.deps.isOperator()) return;
    const read: { [P in CardName]: () => Promise<CardValues[P]> } = {
      appUpdate: this.deps.readAppUpdate, lamination: this.deps.readLamination, qolip: this.deps.readQolip,
    };
    const version = ++this.cardVersion[name];
    this.patch({ [name]: { ...this.state[name], busy: true, failed: false } });
    if (!this.currentOrInvalidate(scope, epoch) || this.deps.isOperator()) return;
    try {
      const value = await read[name]();
      if (this.currentOrInvalidate(scope, epoch) && version === this.cardVersion[name] && !this.deps.isOperator())
        this.patch({ [name]: { value, busy: false, failed: false } });
    } catch {
      if (this.currentOrInvalidate(scope, epoch) && version === this.cardVersion[name] && !this.deps.isOperator())
        this.patch({ [name]: { ...this.state[name], busy: false, failed: true } });
    }
  }
  retryCard(name: CardName): void {
    const scope = this.loadedScope;
    if (!scope || !this.currentOrInvalidate(scope, this.epoch) || this.state.screen !== 'content' || this.state[name].busy) return;
    void this.loadCard(name, scope, this.epoch);
  }
  requestFreeMovement(enabled: boolean): void {
    const scope = this.loadedScope;
    if (!scope || !this.currentOrInvalidate(scope, this.epoch) || this.state.screen !== 'content' || this.state.paddon.busy || !this.state.paddon.value) return;
    if (enabled) {
      this.confirmation = { scope, epoch: this.epoch };
      this.patch({ confirmFreeMovement: true, confirmationSerial: ++this.confirmationSerial });
    } else void this.savePaddon({ freeMovementEnabled: false });
  }
  resolveFreeMovement(confirmed: boolean): void {
    const pending = this.confirmation;
    this.confirmation = null;
    this.patch({ confirmFreeMovement: false });
    if (confirmed && pending && this.currentOrInvalidate(pending.scope, pending.epoch) && !this.state.paddon.busy) {
      void this.savePaddon({ freeMovementEnabled: true });
    }
  }
  setWorkerVisibility(enabled: boolean): void {
    const scope = this.loadedScope;
    if (!scope || !this.currentOrInvalidate(scope, this.epoch) || this.state.screen !== 'content' || this.state.paddon.busy || !this.state.paddon.value) return;
    void this.savePaddon({ workerVisibilityEnabled: enabled });
  }
  private async savePaddon(change: { freeMovementEnabled?: boolean; workerVisibilityEnabled?: boolean }): Promise<void> {
    const scope = this.loadedScope, epoch = this.epoch;
    if (!scope || !this.currentOrInvalidate(scope, epoch) || this.state.paddon.busy || this.state.screen !== 'content') return;
    this.patch({ paddon: { ...this.state.paddon, busy: true } });
    if (!this.currentOrInvalidate(scope, epoch)) return;
    try {
      const value = await this.deps.writePaddon(change);
      if (!this.currentOrInvalidate(scope, epoch)) return;
      this.patch({ paddon: { value, busy: false, failed: false } });
      if (!this.currentOrInvalidate(scope, epoch)) return;
      this.notify('getter', 'settingsSaved');
    } catch {
      if (!this.currentOrInvalidate(scope, epoch)) return;
      this.notify('production', 'paddon.management.settings.failed');
      await this.refresh(true);
    }
  }
  setAppUpdate(enabled: boolean): void { void this.saveCard('appUpdate', () => this.deps.writeAppUpdate(enabled), 'getter', 'appUpdateSettingsSaveFailed'); }
  setLaminationWip(enabled: boolean): void { void this.saveCard('lamination', () => this.deps.writeLamination({ printWipRemainderLabels: enabled }), 'production', 'lamination.settings.save_failed'); }
  setLaminationFilm(enabled: boolean): void { void this.saveCard('lamination', () => this.deps.writeLamination({ printFilmRemainderLabels: enabled }), 'production', 'lamination.settings.save_failed'); }
  setQolip(enabled: boolean): void { void this.saveCard('qolip', () => this.deps.writeQolip(enabled), 'production', 'qolip.start.settings.save_failed'); }
  private reconcileAfterStaleWrite(name: CardName, scope: string): void {
    if (this.valid(scope) && !this.deps.isOperator() && this.state.screen === 'content') void this.loadCard(name, scope, this.epoch);
  }
  private async saveCard<K extends CardName>(name: K, write: () => Promise<CardValues[K]>, source: SettingsNotice['source'], failure: string): Promise<void> {
    const scope = this.loadedScope, epoch = this.epoch, card = this.state[name];
    if (!scope || !this.currentOrInvalidate(scope, epoch) || this.deps.isOperator() || this.state.screen !== 'content' || card.busy || card.failed || card.value == null) return;
    const version = ++this.cardVersion[name];
    this.patch({ [name]: { ...card, busy: true } });
    if (!this.currentOrInvalidate(scope, epoch) || this.deps.isOperator()) return;
    try {
      const value = await write();
      if (!this.currentOrInvalidate(scope, epoch) || version !== this.cardVersion[name] || this.deps.isOperator()) { this.reconcileAfterStaleWrite(name, scope); return; }
      this.patch({ [name]: { value, busy: false, failed: false } });
      if (!this.currentOrInvalidate(scope, epoch)) return;
      this.notify('getter', 'settingsSaved');
    } catch {
      if (!this.currentOrInvalidate(scope, epoch) || version !== this.cardVersion[name] || this.deps.isOperator()) { this.reconcileAfterStaleWrite(name, scope); return; }
      this.notify(source, failure);
      await this.loadCard(name, scope, epoch);
    }
  }
}
