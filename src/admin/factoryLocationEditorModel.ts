import type { AdminApparatus } from '../apparatusApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
import type { AdminFactoryLocation } from './factoryLocationModel';

const defaultApparatus = (item: AdminApparatus) => item.id.startsWith('apparatus:default:');
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
/** @v2 _orderedApparatus */
export function orderedFactoryApparatus(apparatus: readonly AdminApparatus[]): AdminApparatus[] {
  const defaults = apparatus.filter(defaultApparatus).sort((left, right) => left.sort_order - right.sort_order);
  const custom = apparatus.filter(item => !defaultApparatus(item)).sort((left, right) => compareText(dartPartialLower(left.name), dartPartialLower(right.name)));
  return [...defaults, ...custom];
}
/** @v2 _ApparatusPickerBottomSheetState.build */
export function factoryApparatusPickerGroups(apparatus: readonly AdminApparatus[], query: string): { defaults: AdminApparatus[]; custom: AdminApparatus[] } {
  const normalized = dartPartialLower(dartTrim(query));
  const visible = apparatus.filter(item => !normalized || dartPartialLower(item.name).includes(normalized));
  return { defaults: visible.filter(defaultApparatus), custom: visible.filter(item => !defaultApparatus(item)) };
}
export function selectedFactoryApparatus(apparatus: readonly AdminApparatus[], selected: ReadonlySet<string>): AdminApparatus[] {
  return apparatus.filter(item => selected.has(item.id));
}
export type FactoryEditorPlan = { kind: 'nameRequired' } | { kind: 'create'; name: string; apparatusIds: string[] }
  | { kind: 'replace'; id: string; apparatusIds: string[] } | { kind: 'unchanged'; location: AdminFactoryLocation };
/** @v2 _AdminFactoryLocationsScreenState._openEditor */
export function factoryLocationEditorPlan(location: AdminFactoryLocation | null, name: string, selected: ReadonlySet<string>): FactoryEditorPlan {
  const trimmed = dartTrim(name);
  if (!trimmed) return { kind: 'nameRequired' };
  const apparatusIds = [...selected];
  if (!location) return { kind: 'create', name: trimmed, apparatusIds };
  const current = new Set(location.apparatus.map(item => item.id));
  if (current.size !== selected.size || [...selected].some(id => !current.has(id))) return { kind: 'replace', id: location.id, apparatusIds };
  return { kind: 'unchanged', location };
}
export function upsertFactoryLocation(locations: readonly AdminFactoryLocation[], saved: AdminFactoryLocation): AdminFactoryLocation[] {
  const updated = [...locations], index = updated.findIndex(item => item.id === saved.id);
  if (index < 0) updated.push(saved); else updated[index] = saved;
  return updated.sort((left, right) => compareText(dartPartialLower(left.name), dartPartialLower(right.name)));
}
export function replaceFactoryLocation(locations: readonly AdminFactoryLocation[], saved: AdminFactoryLocation,
  sortAfterRename: boolean): AdminFactoryLocation[] {
  const updated = locations.map(item => item.id === saved.id ? saved : item);
  return sortAfterRename ? updated.sort((left, right) => compareText(dartPartialLower(left.name), dartPartialLower(right.name))) : updated;
}
