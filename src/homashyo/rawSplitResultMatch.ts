import { rawSplitQuantity, type RawSplitResult } from './rawSplitModel';

type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid command');
  return value as Json;
};
const text = (value: unknown): string => { if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid command field'); return value; };
const equalQuantity = (expected: unknown, actual: string | null, allowZero = false): boolean =>
  actual !== null && rawSplitQuantity(text(expected), allowZero) === rawSplitQuantity(actual, allowZero);
// Server source lookup uses a case-insensitive match. Avoid assuming non-ASCII database collation rules.
const asciiFold = (value: string) => value.replace(/[A-Z]/g, char => String.fromCharCode(char.charCodeAt(0) + 32));

/** The response has no request_id. Match every source/output field that the request actually supplied. */
export function assertRawSplitResultMatchesPending(result: RawSplitResult, pending: Json): void {
  try {
    if (asciiFold(result.source.barcode) !== asciiFold(text(pending.source_barcode).trim()) ||
        result.source.revision !== text(pending.expected_revision) ||
        !equalQuantity(pending.expected_kg, result.source.kg) ||
        !equalQuantity(pending.expected_width_mm, result.source.widthMm) ||
        !equalQuantity(pending.expected_micron, result.source.micron) ||
        !equalQuantity(pending.waste_kg, result.wasteKg, true) ||
        !Array.isArray(pending.outputs) || pending.outputs.length !== result.outputs.length) throw new Error('Mismatch');
    for (let index = 0; index < result.outputs.length; index++) {
      const expected = object(pending.outputs[index]), actual = result.outputs[index];
      if (!equalQuantity(expected.kg, actual.kg) || !equalQuantity(expected.width_mm, actual.widthMm) ||
          (expected.gross_kg != null && !equalQuantity(expected.gross_kg, actual.grossKg)) ||
          (expected.bobina_kg != null && !equalQuantity(expected.bobina_kg, actual.bobinaKg, true)) ||
          (expected.length_m != null && !equalQuantity(expected.length_m, actual.lengthM))) throw new Error('Mismatch');
    }
  } catch { throw new Error('Boshqa bo‘lish natijasi olindi. Natijani qayta tekshiring.'); }
}
