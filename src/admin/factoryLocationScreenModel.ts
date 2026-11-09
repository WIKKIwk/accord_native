import type { AdminApparatus } from '../apparatusApi';
import { adminText, localizedGetter } from '../shared/localization';
import { dartTrim } from './dartJsonString';
import type { FactoryNotice } from './factoryLocationController';
import type { AdminFactoryLocation } from './factoryLocationModel';

export function factoryLocationScreenText(locale: string) {
  return { title: localizedGetter('adminFactoryStatesNavTitle', locale), retry: localizedGetter('retry', locale),
    loadError: adminText('factory.states_load_failed', locale), create: adminText('factory.state_create', locale),
    actions: adminText('factory.state_actions', locale), edit: adminText('factory.edit_equipment', locale),
    rename: adminText('factory.rename', locale), deactivate: adminText('factory.deactivate', locale),
    activate: adminText('action.activate', locale), empty: adminText('factory.no_states', locale),
    equipment: adminText('factory.apparatus_state', locale), ordinary: adminText('factory.ordinary_state', locale),
    inactive: adminText('factory.inactive', locale) };
}
export function factoryLocationNoticeText(notice: FactoryNotice, locale: string): string {
  return notice.source === 'server' ? notice.message : adminText(notice.key, locale);
}
export function factoryLocationApparatusLabels(location: AdminFactoryLocation, catalog: readonly AdminApparatus[]): string {
  const names = new Map<string, string>();
  for (const item of catalog) {
    const id = dartTrim(item.id), name = dartTrim(item.name);
    if (id && name) names.set(id, name);
  }
  return location.apparatus.map(item => { const id = dartTrim(item.id); return id ? names.get(id) ?? id : ''; }).join(', ');
}
