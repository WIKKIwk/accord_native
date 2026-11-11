import type { AccountStorage } from '../savedAccountStore';

export type AppThemeMode = 'light' | 'dark' | 'system';
export type AppThemeVariant = 'classic' | 'kalmar' | 'moss' | 'lavender' | 'bliss' | 'white';
const variants: readonly AppThemeVariant[] = ['classic', 'kalmar', 'moss', 'lavender', 'bliss', 'white'];

/** @v2 ThemeController */
export class ThemeController {
  static readonly prefsKey = 'app_theme_mode';
  static readonly variantPrefsKey = 'app_theme_variant';
  private mode: AppThemeMode = 'light';
  private selectedVariant: AppThemeVariant = 'classic';
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: AccountStorage) {}

  get themeMode(): AppThemeMode { return this.mode; }
  get isDark(): boolean { return this.mode === 'dark'; }
  get variant(): AppThemeVariant { return this.selectedVariant; }
  addListener(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }

  async load(): Promise<void> {
    const [mode, variant] = await Promise.all([
      this.storage.getItem(ThemeController.prefsKey), this.storage.getItem(ThemeController.variantPrefsKey),
    ]);
    this.mode = mode === 'system' || mode === 'dark' ? mode : 'light';
    this.selectedVariant = variants.includes(variant as AppThemeVariant) ? variant as AppThemeVariant : 'classic';
    this.notify();
  }

  async setThemeMode(mode: AppThemeMode): Promise<void> {
    if (this.mode === mode) return;
    this.mode = mode; this.notify();
    await this.storage.setItem(ThemeController.prefsKey, mode);
  }

  async setVariant(variant: AppThemeVariant): Promise<void> {
    if (this.selectedVariant === variant) return;
    this.selectedVariant = variant; this.notify();
    await this.storage.setItem(ThemeController.variantPrefsKey, variant);
  }
}
