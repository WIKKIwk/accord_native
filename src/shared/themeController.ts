import type { AccountStorage } from '../savedAccountStore';

export type AppThemeMode = 'light' | 'dark' | 'system';

/** @v2 ThemeController */
export class ThemeController {
  static readonly prefsKey = 'app_theme_mode';
  private mode: AppThemeMode = 'system';
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: AccountStorage) {}

  get themeMode(): AppThemeMode { return this.mode; }
  addListener(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }

  async load(): Promise<void> {
    const mode = await this.storage.getItem(ThemeController.prefsKey);
    this.mode = mode === 'light' || mode === 'dark' ? mode : 'system';
    this.notify();
  }

  async setThemeMode(mode: AppThemeMode): Promise<void> {
    if (this.mode === mode) return;
    this.mode = mode; this.notify();
    await this.storage.setItem(ThemeController.prefsKey, mode);
  }
}
