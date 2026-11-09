/**
 * Parse the already Dart-trimmed field text used by the f119 unannounced flow.
 * The caller must supply Dart String.trim semantics, not JavaScript trim:
 * the shared dartTrim on main includes U+0085. No input filtering is applied.
 */
export function werkaTryParseTrimmedDouble(text: string): number | null {
  if (!/^[+-]?(?:(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|NaN|Infinity)$/.test(text)) return null;
  return Number(text);
}

/** Pure decision only; no dialog, account, write or success navigation. */
export function werkaUnannouncedAfterTrim(text: string, unit: string) {
  const quantity = werkaTryParseTrimmedDouble(text) ?? 0;
  if (quantity <= 0) return { kind: 'invalid' as const };
  return { kind: 'confirm' as const, quantity, quantityText: `${quantity.toFixed(0)} ${unit}` };
}
