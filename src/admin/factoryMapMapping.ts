import type { AdminApparatus } from '../apparatusApi';
/** @v2 canonicalFactoryMapObjectId */
export function canonicalFactoryMapObjectId(value: string): string {
  const trimmed = value.trim(); if (!trimmed) return '';
  const match = /^(.*):instance:(\d+)$/.exec(trimmed);
  if (match) { const base = match[1].trim(), instance = match[2].trim(); if (['node:7', 'node:20'].includes(base) && ['0','1','2','3','4','5','6','7'].includes(instance)) return base; return `${base === 'node:33' ? 'node:39' : base}:instance:${instance}`; }
  return trimmed === 'node:33' ? 'node:39' : trimmed;
}
export const factoryMapObjectOwners = (apparatus: readonly AdminApparatus[], objectId: string) => { const target = canonicalFactoryMapObjectId(objectId); return target ? apparatus.filter(item => canonicalFactoryMapObjectId(item.factory_map_object_id) === target) : []; };
export function resolveFactoryMapApparatus(apparatus: readonly AdminApparatus[], objectId: string) { const owners = factoryMapObjectOwners(apparatus, objectId); return owners.length === 1 ? owners[0] : null; }
export const unboundFactoryMapApparatus = (apparatus: readonly AdminApparatus[]) => apparatus.filter(item => item.lifecycle_state === 'active' && !item.factory_map_object_id.trim());
export function hasLegacyFactoryMapBinding(apparatus: readonly AdminApparatus[], objectId: string) { if (resolveFactoryMapApparatus(apparatus, objectId)) return false; const legacy = /^(.*):instance:\d+$/.exec(objectId.trim())?.[1]?.trim(); return !!legacy && apparatus.some(item => item.factory_map_object_id.trim() === legacy || canonicalFactoryMapObjectId(item.factory_map_object_id) === canonicalFactoryMapObjectId(legacy)); }
export function factoryMapReadableText(value: string, names: Record<string, string>, fallback: string) { return value.replace(/apparatus:[a-zA-Z0-9:_-]+/g, id => names[id]?.trim() || fallback); }
