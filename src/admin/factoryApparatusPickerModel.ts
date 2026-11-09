import type { AdminApparatus } from '../apparatusApi';
import { adminText } from '../shared/localization';
import { factoryApparatusPickerGroups } from './factoryLocationEditorModel';

export function factoryPickerText(locale: string, selectedCount: number) {
  return { title: adminText('factory.attach_title', locale), search: adminText('factory.state_search', locale),
    empty: adminText('factory.no_equipment', locale), defaults: adminText('factory.default_equipment', locale),
    custom: adminText('factory.custom_equipment', locale),
    confirm: selectedCount === 0 ? adminText('factory.continue_without_selection', locale)
      : adminText('factory.selected_count', locale, { count: selectedCount }) };
}
export function toggleFactoryPickerSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
export type FactoryPickerRow = { kind: 'heading'; key: string; title: string }
  | { kind: 'item'; key: string; item: AdminApparatus };
export function factoryPickerRows(apparatus: readonly AdminApparatus[], query: string, locale: string): FactoryPickerRow[] {
  const groups = factoryApparatusPickerGroups(apparatus, query), t = factoryPickerText(locale, 0), rows: FactoryPickerRow[] = [];
  if (groups.defaults.length) rows.push({ kind: 'heading', key: 'defaults', title: t.defaults },
    ...groups.defaults.map((item, index) => ({ kind: 'item' as const, key: `default:${index}:${item.id}`, item })));
  if (groups.custom.length) rows.push({ kind: 'heading', key: 'custom', title: t.custom },
    ...groups.custom.map((item, index) => ({ kind: 'item' as const, key: `custom:${index}:${item.id}`, item })));
  return rows;
}
