import { isCanonicalApparatusId } from '../workerControlsApi';

// Dart's String.trim includes U+0085, which ECMAScript trim does not. This
// table is checked against all Unicode code points in the isolated f119 oracle.
const dartEdgeWhitespace = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$/g;
export const dartTrim = (value: string): string => value.replace(dartEdgeWhitespace, '');
export const isAscii = (value: string): boolean => /^[\x00-\x7f]*$/.test(value);

// Dart, Node and Hermes may use different Unicode lowercase tables. Until
// their canonical-ID behavior is verified, deny non-ASCII IDs rather than
// exposing an ID that V2 might reject. This intentionally has false negatives.
export function isAsciiCanonicalApparatusId(value: string): boolean {
  const normalized = dartTrim(value);
  return isAscii(normalized) && isCanonicalApparatusId(normalized);
}
