// Dart's native String.trim also removes U+0085, unlike JavaScript's trim.
function trimDartWhitespace(value: string): string {
  return value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
}

/** @v2 qolipBatchMaxCount */
export const qolipBatchMaxCount = 9;

/** @v2 QolipBatchCodeDraft */
export type QolipBatchCodeDraft = {
  input: string;
  prefix: string;
  count: number;
  codes: string[];
};

/** @v2 parseQolipBatchCode */
export function parseQolipBatchCode(raw: string): QolipBatchCodeDraft | null {
  const input = trimDartWhitespace(raw);
  if (!input || input.endsWith('0')) return null;

  const match = /^(.*)-([0-9]+)$/.exec(input);
  if (!match) return { input, prefix: '', count: 1, codes: [input] };

  const prefix = trimDartWhitespace(match[1]);
  const suffix = match[2];
  const count = Number(suffix[suffix.length - 1]);
  if (!prefix || count <= 0 || count > qolipBatchMaxCount) return null;

  // Only the last digit is the count; retain the rest of the mold code.
  const codePrefix = `${prefix}-${suffix.substring(0, suffix.length - 1)}`;
  return {
    input,
    prefix: codePrefix,
    count,
    codes: Array.from({ length: count }, (_, index) => `${codePrefix}${index + 1}`),
  };
}

/** @v2 qolipCodePrefixSuggestion */
export function qolipCodePrefixSuggestion(firstQolipCode: string): string {
  const code = trimDartWhitespace(firstQolipCode);
  if (!code || !/[0-9]$/.test(code)) return '';
  return code.substring(0, code.length - 1);
}
