import { trimDart } from './qolipApiCommon';
import { parseQolipBatchCode } from './qolipCode';
import type { QolipCatalogEditorState } from './qolipCatalogEditorTypes';
/** Dart int.tryParse accepts a signed decimal or 0x-prefixed hexadecimal integer. */
export function qolipCatalogIntegerDecimal(raw: string): string | null {
  const value = trimDart(raw), match = /^([+-]?)(0[xX][0-9a-fA-F]+|[0-9]+)$/.exec(value);
  if (!match) return null;
  try { const magnitude = BigInt(match[2]), result = match[1] === '-' ? -magnitude : magnitude;
    if (result < -9223372036854775808n || result > 9223372036854775807n) return null;
    return result.toString();
  } catch { return null; }
}
export function qolipCatalogInteger(raw: string): number | null {
  const exact = qolipCatalogIntegerDecimal(raw); return exact === null ? null : Number(exact);
}
/** Source _canSave / _validationError. Edit keeps its source no-op validation on pressing Save. */
export function qolipCatalogEditorCanSave(s: QolipCatalogEditorState): boolean {
  if (s.saving || s.saved.length > 0) return false;
  if (s.request.kind === 'edit') return true;
  if (!trimDart(s.code)) return false;
  if (s.request.kind === 'spec') return s.product !== null;
  if (s.request.kind === 'set') return parseQolipBatchCode(s.code) !== null;
  const size = qolipCatalogInteger(s.size) ?? 0;
  return s.suggestions.length > 0 || s.existing || (size > 0 && size <= 2147483647 && s.colors.length > 0);
}
