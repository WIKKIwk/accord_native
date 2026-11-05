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

type TranslationTemplate = { key: string; value: string; tokens: string[]; specificity: number };
function interpolationTokens(template: string): string[] {
  const tokens: string[] = [];
  for (let index = 0; index < template.length;) {
    if (template[index] !== '$' || index + 1 >= template.length) { index++; continue; }
    const start = index++;
    if (template[index] === '{') {
      let depth = 1; index++;
      while (index < template.length && depth > 0) {
        if (template[index] === '{') depth++;
        if (template[index] === '}') depth--;
        index++;
      }
      if (depth === 0) tokens.push(template.slice(start, index));
      continue;
    }
    if (!/[A-Za-z_]/.test(template[index])) continue;
    index++;
    while (index < template.length && /[A-Za-z_0-9]/.test(template[index])) index++;
    tokens.push(template.slice(start, index));
  }
  return tokens;
}
function buildTemplates(map: Map<string, string>): TranslationTemplate[] {
  return [...map].filter(([key]) => key.includes('$')).map(([key, value]) => {
    const tokens = interpolationTokens(key);
    let literal = key;
    for (const token of tokens) literal = literal.replace(token, '');
    const specificity = literal.match(/[A-Za-z\u00c0-\u024f\u0600-\u06ff]/g)?.length ?? 0;
    return { key, value, tokens, specificity };
  }).filter(template => template.tokens.length && template.specificity > 0).sort((a, b) => b.specificity - a.specificity);
}
const urduEnglish = new Map(catalog.urduEnglish as [string, string][]);
const urduUi = new Map(catalog.urduUi as [string, string][]);
const englishTemplates = buildTemplates(urduEnglish);
const uiTemplates = buildTemplates(urduUi);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function translateFrom(source: string, translations: Map<string, string>, templates: TranslationTemplate[]): string | null {
  const exact = translations.get(source);
  if (exact !== undefined) return exact;
  for (const item of templates) {
    let offset = 0, expression = '^';
    for (const token of item.tokens) {
      const position = item.key.indexOf(token, offset);
      expression += `${escapeRegex(item.key.slice(offset, position))}(.*?)`;
      offset = position + token.length;
    }
    const match = new RegExp(`${expression}${escapeRegex(item.key.slice(offset))}$`, 's').exec(source);
    if (!match) continue;
    let result = '', translatedOffset = 0;
    for (let index = 0; index < item.tokens.length; index++) {
      const position = item.value.indexOf(item.tokens[index], translatedOffset);
      if (position < 0) break;
      result += item.value.slice(translatedOffset, position) + (match[index + 1] ?? '');
      translatedOffset = position + item.tokens[index].length;
    }
    return result + item.value.slice(translatedOffset);
  }
  return null;
}

/** @v2 uiText */
export function uiText(source: string, locale: string): string {
  if (language(locale) !== 'ur') return source;
  return translateFrom(source, urduUi, uiTemplates) ?? translateFrom(source, urduEnglish, englishTemplates) ?? source;
}
