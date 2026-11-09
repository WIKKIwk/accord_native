// Source model/detail fields call Dart Object.toString(), not JSON encoding.
// This supports decoded JSON containers. Numeric lexemes/precision and original
// integer-like map-key order are not reconstructed after response.json().
export function materialHistoryJsonText(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(materialHistoryJsonText).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).map(([key, item]) => `${key}: ${materialHistoryJsonText(item)}`).join(', ')}}`;
  }
  return String(value);
}

export function materialHistoryOptionalText(value: unknown): string {
  return value == null ? '' : materialHistoryJsonText(value);
}
