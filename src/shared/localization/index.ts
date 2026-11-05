import catalog from './catalog.json';
import type { AccountStorage } from '../../savedAccountStore';

type Language = 'uz' | 'en' | 'ru' | 'ur';
type Entry = Record<Language, string>;
type Table = Record<string, Entry>;
const getters: Table = catalog.getters;
const methods: Table = catalog.methods;
const production: Table = catalog.production;
const admin: Table = catalog.admin;
const extensions: Record<string, Table> = catalog.extensions;

function language(locale: string): Language {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  return code === 'uz' || code === 'ru' || code === 'ur' ? code : 'en';
}
function interpolate(value: string, values: Record<string, unknown>): string {
  value = value.replace(/\{([A-Za-z_]\w*):(fixed(\d+)|compact2)\}/g, (match, key: string, mode: string, precision: string) => {
    const number = values[key];
    if (typeof number !== 'number') return match;
    return number.toFixed(mode === 'compact2' ? (Number.isInteger(number) ? 0 : 2) : Number(precision));
  });
  for (const [key, replacement] of Object.entries(values)) value = value.replaceAll(`{${key}}`, replacement == null ? '' : String(replacement));
  return value;
}

/** Static V2 AppLocalizations getters, extracted from the recorded baseline. */
export function localizedGetter(key: string, locale: string): string {
  const entry = getters[key];
  if (!entry) throw new Error(`Unknown localization getter: ${key}`);
  return entry[language(locale)];
}

/** Simple parameterized V2 AppLocalizations methods. */
export function localizedMethod(key: string, locale: string, values: Record<string, unknown>): string {
  const entry = methods[key];
  if (!entry) throw new Error(`Unknown localization method: ${key}`);
  return interpolate(entry[language(locale)], values);
}

/** @v2 productionText */
export function productionText(key: string, locale: string, values: Record<string, unknown> = {}): string {
  return interpolate(production[key]?.[language(locale)] ?? key, values);
}

/** @v2 adminText */
export function adminText(key: string, locale: string, values: Record<string, unknown> = {}): string {
  return interpolate(admin[`admin.${key}`]?.[language(locale)] ?? key, values);
}

export function extensionText(method: string, key: string, locale: string, values: Record<string, unknown> = {}): string {
  return interpolate(extensions[method]?.[key]?.[language(locale)] ?? key, values);
}

/** @v2 LocaleController */
export class LocaleController {
  private languageCode = 'uz';
  private explicit = false;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: AccountStorage) {}
  get locale(): string { return this.languageCode === 'ur' ? 'ur-PK' : this.languageCode; }
  get hasExplicitSelection(): boolean { return this.explicit; }
  get isUzbek(): boolean { return this.languageCode === 'uz'; }
  get isUrdu(): boolean { return this.languageCode === 'ur'; }
  addListener(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async load(): Promise<void> {
    const saved = await this.storage.getItem('app_locale_code');
    this.explicit = saved != null;
    this.languageCode = saved === 'en' || saved === 'ru' || saved === 'ur' ? saved : 'uz';
    for (const listener of this.listeners) listener();
  }
  async setLocale(locale: string): Promise<void> {
    const next = locale.split(/[-_]/, 1)[0];
    if (this.explicit && this.languageCode === next) return;
    this.explicit = true; this.languageCode = next;
    for (const listener of this.listeners) listener();
    await this.storage.setItem('app_locale_code', next);
  }
}
