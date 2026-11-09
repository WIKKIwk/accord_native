// Dart String.trim's whitespace set, including U+0085. On integration this
// role-local helper can be replaced with main's existing shared dartTrim.
const edgeWhitespace = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$/g;
export const werkaDartTrim = (value: string): string => value.replace(edgeWhitespace, '');
export const werkaBatchTrim = werkaDartTrim;
