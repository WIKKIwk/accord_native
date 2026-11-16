import { Platform } from 'react-native';
import { readAdminGestureNavigation, readAdminSystemInsets, type AdminSystemInsets } from '../../modules/accord-admin-layout/src/AccordAdminLayoutModule';

/** @v2 DockGestureOverlay
 * One future for the application lifetime; account resets must not reread Android navigation settings. */
export function createAdminNavigationModeReader(platform: string, read: (platform: string) => Promise<unknown>) {
  let future: Promise<boolean> | null = null;
  return () => future ??= Promise.resolve().then(() => platform === 'android' ? read(platform) : false).then(value => value === true, () => false);
}
const navigationMode = createAdminNavigationModeReader(Platform.OS, readAdminGestureNavigation);
export type AdminShellLayoutState = Readonly<{ metrics: AdminSystemInsets | null; thinGestureBottom: boolean; navigationResolved: boolean }>;
export class AdminShellLayoutController {
  private state: AdminShellLayoutState = { metrics: null, thinGestureBottom: false, navigationResolved: false };
  private active = false; private generation = 0; private serial = 0; private readonly listeners = new Set<() => void>();
  constructor(private readonly readInsets = readAdminSystemInsets, private readonly navigation = navigationMode) {}
  get interactionGeneration(): number { return this.generation; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminShellLayoutState>): void { if (this.active) { this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); } }
  start(): void {
    if (this.active) return; this.active = true; const generation = this.generation; this.publish({});
    if (!this.active || generation !== this.generation) return;
    void Promise.resolve().then(() => this.navigation()).then(thinGestureBottom => {
      if (this.active && generation === this.generation) this.publish({ thinGestureBottom: thinGestureBottom === true, navigationResolved: true });
    }, () => { if (this.active && generation === this.generation) this.publish({ thinGestureBottom: false, navigationResolved: true }); });
  }
  async refresh(): Promise<void> {
    if (!this.active) return;
    const generation = this.generation, serial = ++this.serial; let metrics: AdminSystemInsets | null;
    try { metrics = await this.readInsets(); } catch { metrics = null; }
    if (this.active && generation === this.generation && serial === this.serial) this.publish({ metrics });
  }
  refresher(): () => void { const generation = this.generation; return () => { if (this.active && generation === this.generation) void this.refresh(); }; }
  dispose(): void { this.active = false; this.generation++; this.serial++; this.state = { ...this.state, metrics: null }; this.listeners.clear(); }
}
