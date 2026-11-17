/**
 * Dart distinguishes JSON integers from doubles (7 versus 7.0/7e0).
 * Keep that distinction for the compact task contract before JSON.parse loses it.
 * All JSON syntax and decoded strings still come from the platform JSON parser.
 */
export function parseSupplyTaskJson(text: string): unknown {
  const original: unknown = JSON.parse(text); // Validate once before scanning; the walker may assume valid JSON.
  // Server error bodies are outside the successful task projection.
  if (original && typeof original === 'object' && !Array.isArray(original) && (original as { ok?: unknown }).ok === false) return original;
  let offset = 0;
  const whitespace = () => { while (/[\x20\x09\x0a\x0d]/.test(text[offset] ?? '\0')) offset++; };
  const string = () => {
    const start = offset++;
    while (offset < text.length) { const char = text[offset++]; if (char === '\\') offset++; else if (char === '"') break; }
    return JSON.parse(text.slice(start, offset)) as string;
  };
  const numberKeys = new Set(['rev', 'base_rev', 'checked_count', 'missing_count', 'limit', 'position', 'apparatus_count', 'status']);
  const visit = (path: string[]): unknown => {
    whitespace(); const char = text[offset];
    if (char === '{') {
      const row: Record<string, unknown> = {};
      offset++; whitespace(); if (text[offset] === '}') { offset++; return row; }
      while (offset < text.length) {
        whitespace(); const key = string(); whitespace(); offset++;
        whitespace(); const start = offset;
        const value = visit([...path, key]);
        const lexeme = text.slice(start, offset);
        const contractField = path.length === 0 || (path.length === 1 && path[0] === 'window') ||
          (path.length === 2 && ['rows', 'upsert'].includes(path[0])) || (path.length === 3 && path[0] === 'window' && path[1] === 'rows');
        Object.defineProperty(row, key, { value: contractField && numberKeys.has(key) && typeof value === 'number' && /[.eE]/.test(lexeme) ? NaN : value,
          writable: true, configurable: true, enumerable: true });
        whitespace(); if (text[offset++] === '}') return row;
      }
    } else if (char === '[') {
      const list: unknown[] = [];
      offset++; whitespace(); if (text[offset] === ']') { offset++; return list; }
      while (offset < text.length) { list.push(visit([...path, String(list.length)])); whitespace(); if (text[offset++] === ']') return list; }
    } else if (char === '"') return string();
    else { const start = offset; while (offset < text.length && !/[\x20\x09\x0a\x0d,}\]]/.test(text[offset])) offset++; return JSON.parse(text.slice(start, offset)); }
  };
  const result = visit([]);
  // Qolip's existing helper rejects invalid success envelopes directly. Wait
  // until reconstruction so duplicate fields retain JSON's last-value rule.
  if (result && typeof result === 'object' && !Array.isArray(result) && (result as { ok?: unknown }).ok === true) {
    const check = (value: unknown, keys: readonly string[]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const row = value as Record<string, unknown>;
      if (keys.some(key => typeof row[key] === 'number' && Number.isNaN(row[key]))) {
        throw new TypeError('Task integer field must use an integer JSON token');
      }
    };
    const root = result as Record<string, unknown>;
    const cursorKeys = ['rev', 'base_rev', 'checked_count', 'missing_count', 'limit'];
    check(root, cursorKeys); check(root.window, cursorKeys);
    for (const list of [root.rows, root.upsert, (root.window as Record<string, unknown> | undefined)?.rows]) {
      if (Array.isArray(list)) list.forEach(row => check(row, ['position', 'apparatus_count']));
    }
  }
  return result;
}
