import catalog from './shared/localization/catalog.json';
import { productionText, uiText } from './shared/localization';

// Use the same recorded translations for literal V2 labels and keyed labels.
type Entry = { uz: string; en: string; ru: string; ur: string };
const literals = new Map<string, Entry>();
for (const group of [catalog.getters, catalog.methods, catalog.production, catalog.admin, ...Object.values(catalog.extensions)]) {
  for (const entry of Object.values(group)) if (!literals.has(entry.uz)) literals.set(entry.uz, entry);
}
export function workerOrderText(source: string, locale: string): string {
  const code = locale.split(/[-_]/)[0];
  const language = code === 'uz' || code === 'ru' || code === 'ur' ? code : 'en';
  return literals.get(source)?.[language] ?? uiText(source, locale);
}
export const workerOrderProductionText = productionText;
