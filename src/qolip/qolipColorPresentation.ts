import { trimDart } from './qolipApiCommon';

/** @v2 qolipColorValue */
export function qolipColorValue(value: string): string {
  // V2 removes the first # anywhere, then int.tryParse(..., radix: 16) trims again.
  const source = trimDart(trimDart(value).replace('#', ''));
  const match = /^([+-]?)([0-9a-fA-F]+)$/.exec(source);
  if (!match) return '#757575';
  const digits = match[2].replace(/^0+/, '') || '0', negative = match[1] === '-';
  // Dart VM parses a signed 64-bit integer for an explicit radix. Work on digits so JS never loses low bits.
  const max = negative ? '8000000000000000' : '7fffffffffffffff', lower = digits.toLowerCase();
  if (lower.length > max.length || (lower.length === max.length && lower > max)) return '#757575';
  const low = Number.parseInt(lower.slice(-6), 16), rgb = (negative ? -low : low) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** QolipCodeRow only renders a swatch when the original value trims nonempty. */
export function qolipVisibleColor(value: string): string | null {
  return trimDart(value) ? qolipColorValue(value) : null;
}
