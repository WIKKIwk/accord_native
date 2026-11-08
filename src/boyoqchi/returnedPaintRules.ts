import { paintOptions } from '../workerOrderLogic';
import { returnedPaintDouble, type ReturnedPaintItem } from './returnedPaintModel';

/** The pure draft shape corresponds to V2's in-memory maps. Persistence is a separate step. */
export type ReturnedPaintDraftData = { values: Record<string, string[]>; dynamic_field_labels: Record<string, string[]> };

function labels(draft: ReturnedPaintDraftData, key: string, base: readonly string[]): string[] {
  return [...base, ...(draft.dynamic_field_labels[key] ?? [])];
}
function values(draft: ReturnedPaintDraftData, key: string, length: number): string[] {
  return Array.from({ length }, (_, index) => draft.values[key]?.[index] ?? '');
}

/** @v2 returnedPaintItemsFromDraft */
export function returnedPaintItemsFromDraft(draft: ReturnedPaintDraftData): ReturnedPaintItem[] {
  const items: ReturnedPaintItem[] = [];
  for (const usage of ['rasxot', 'astatka']) {
    const collect = (key: string, category: string, name: string, base: readonly string[]) => {
      const fields = labels(draft, key, base), rawValues = values(draft, key, fields.length);
      const result: Record<string, string> = {};
      fields.forEach((field, index) => {
        const raw = rawValues[index].trim();
        if (!raw) return;
        const normalized = raw.replace(/,/g, '.'), number = returnedPaintDouble(normalized);
        if (number !== null && number >= 0) {
          // A named field may be "__proto__"; preserve it as data, not as a prototype setter.
          Object.defineProperty(result, field, { value: normalized, enumerable: true, configurable: true, writable: true });
        }
      });
      if (Object.keys(result).length) items.push({ usage, category, name, values: result });
    };
    for (const option of paintOptions) {
      collect(`${usage}:${option.name}`, option.category, option.name, option.fields);
      if (option.name === 'Pantone') collect(`${usage}:Pantone Mix`, option.category, 'Mix', []);
    }
  }
  return items;
}

/** @v2 returnedPaintFilledFieldCount */
export const returnedPaintFilledFieldCount = (items: readonly ReturnedPaintItem[]): number =>
  items.reduce((count, item) => count + Object.keys(item.values).length, 0);

/** @v2 returnedPaintFilledFieldCountForUsage */
export function returnedPaintFilledFieldCountForUsage(items: readonly ReturnedPaintItem[], usage: string): number {
  const normalized = usage.trim().toLowerCase();
  return returnedPaintFilledFieldCount(items.filter(item => item.usage.trim().toLowerCase() === normalized));
}

/** @v2 returnedPaintHasMinimumFieldsPerUsage */
export function returnedPaintHasMinimumFieldsPerUsage(items: readonly ReturnedPaintItem[]): boolean {
  return returnedPaintFilledFieldCountForUsage(items, 'rasxot') >= 3 && returnedPaintFilledFieldCountForUsage(items, 'astatka') >= 3;
}

/** @v2 returnedPaintReportCanClose */
export function returnedPaintReportCanClose(items: readonly ReturnedPaintItem[], imageId: string): boolean {
  return returnedPaintHasMinimumFieldsPerUsage(items) || (returnedPaintFilledFieldCount(items) === 0 && imageId.trim() !== '');
}

/** @v2 _isValidReturnedPaintNumber */
export function isValidReturnedPaintNumber(raw: string): boolean {
  const value = raw.trim().replace(/,/g, '.');
  if (!/^\d+(?:\.\d*)?$/.test(value)) return false;
  const [integerPart, fractionalPart = ''] = value.split('.');
  const integer = integerPart.replace(/^0+/, ''), fraction = fractionalPart.replace(/0+$/, '');
  return fraction.length <= 11 && integer.length <= 18 && (integer !== '999999999999999999' || fraction.length === 0);
}

/** @v2 returnedPaintDraftHasInvalidValues */
export function returnedPaintDraftHasInvalidValues(draft: ReturnedPaintDraftData): boolean {
  for (const usage of ['rasxot', 'astatka']) {
    for (const option of paintOptions) {
      const states = [{ key: `${usage}:${option.name}`, base: option.fields },
        ...(option.name === 'Pantone' ? [{ key: `${usage}:Pantone Mix`, base: [] }] : [])];
      for (const state of states) {
        const fields = labels(draft, state.key, state.base);
        if (values(draft, state.key, fields.length).some(raw => raw.trim() !== '' && !isValidReturnedPaintNumber(raw))) return true;
      }
    }
  }
  return false;
}

/** @v2 returnedPaintBoyoqchiDraftScope */
export function returnedPaintBoyoqchiDraftScope(actorRef: string, requestId: string): string {
  return `boyoqchi:${actorRef.trim()}:${requestId.trim()}`;
}
