import { dartPartialLower, dartTrim } from './dartJsonString';

/** @v2 _ItemGroupPickerSheetState.initState; current group wins the case-insensitive duplicate. */
export function adminItemDetailGroupChoices(currentGroup: string, groups: readonly string[]): readonly string[] {
  const values = new Map<string, string>();
  for (const value of [currentGroup, ...groups]) { const group = dartTrim(value), key = dartPartialLower(group); if (group && !values.has(key)) values.set(key, group); }
  return Object.freeze([...values.values()].sort((left, right) => {
    const a = dartPartialLower(left), b = dartPartialLower(right); return a < b ? -1 : a > b ? 1 : 0;
  }));
}
export function adminItemDetailVisibleGroups(groups: readonly string[], query: string): readonly string[] {
  const search = dartPartialLower(dartTrim(query)); return Object.freeze(groups.filter(group => !search || dartPartialLower(group).includes(search)));
}
export const adminItemDetailSameGroup = (left: string, right: string): boolean => dartPartialLower(dartTrim(left)) === dartPartialLower(dartTrim(right));
