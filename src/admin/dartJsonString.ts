// String conversion of JSON collections as produced by Dart's Object.toString().
// Standard JSON.parse loses whether an integral number was written with a decimal point.
export function dartJsonString(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartJsonString).join(', ')}]`;
  if (typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => `${key}: ${dartJsonString(child)}`).join(', ')}}`;
  return String(value);
}

// Dart String.trim includes NEXT LINE (U+0085), unlike JavaScript's trim.
export const dartTrim = (value: string): string => value.replace(/^[\s\u0085]+|[\s\u0085]+$/gu, '');
