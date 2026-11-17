/** Dart's task projection requires int tokens; JSON.parse otherwise collapses 1.0/1e0 into 1. */
const integerFields = new Set(['rev', 'base_rev', 'limit', 'checked_count', 'missing_count', 'position', 'apparatus_count']);
export function parseSupplyTaskJson(raw: string): unknown {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as { ok?: unknown }).ok !== true) return value;
  const strings = /"(?:\\.|[^"\\])*"/g;
  for (let token = strings.exec(raw); token; token = strings.exec(raw)) {
    const tail = raw.slice(strings.lastIndex), colon = /^\s*:/.exec(tail);
    if (!colon || !integerFields.has(JSON.parse(token[0]))) continue;
    const number = /^\s*(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(tail.slice(colon[0].length));
    if (number && /[.eE]/.test(number[1])) throw new TypeError('Task integer field must use an integer JSON token');
  }
  return value;
}
