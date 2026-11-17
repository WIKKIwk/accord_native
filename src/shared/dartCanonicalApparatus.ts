import lowercaseData from '../werka/werkaDartLowercaseData.json';
import { dartTrim } from './dartApparatus';

/** Reuse the existing exhaustive Dart scalar lowercase table, independent of the host Unicode version. */
export function dartCanonicalApparatusId(value: string): boolean {
  const normalized = dartTrim(value), table = lowercaseData as Record<string, string>;
  const lower = [...normalized].map(char => table[String(char.codePointAt(0))] ?? char).join('');
  if (!normalized || normalized.length > 128 || normalized !== lower || /\s/.test(normalized)) return false;
  const parts = normalized.split(':');
  return parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
}
