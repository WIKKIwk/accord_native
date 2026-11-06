// Finds the words a person reads in Dart and TypeScript source, so V2 and V4 can be compared word for word.
// Static reading cannot prove a string is shown, so a report still needs a human or agent verdict on each row.

const HTTP_WORDS = new Set(['Bearer', 'Authorization', 'Accept', 'Content-Type', 'Cookie', 'User-Agent', 'Host', 'Origin']);
const DART_NOT_SHOWN = /\b(debugPrint|print|log|assert|Key|ValueKey|PageStorageKey|ObjectKey|RegExp|DateFormat|NumberFormat|parse|tryParse|MethodChannel|EventChannel|AssetImage|asset|getString|setString|getBool|setBool|getInt|setInt|getDouble|setDouble|getStringList|setStringList|remove|containsKey|startsWith|endsWith|contains|replaceAll|replaceFirst|split|indexOf|join|padLeft|Uri|fromEnvironment)\(\s*$|(\[|==|!=|\bcase)\s*$/;
const TS_NOT_SHOWN = /(\bfrom|\bimport|\brequire\(|\bimport\(|console\.\w+\(|\bnew RegExp\(|\bnew TypeError\(|\[|===|!==|\bcase|\btypeof\s+\w+\s*(===|!==))\s*$|\b(testID|systemImage|name|key|nativeID|pathname|href|presentation|contentStyle|fontWeight)\s*[=:]\s*\{?\s*$/;

/** Splits on line breaks and drops fragments too short or too code-like to compare. */
function usableFragments(parts) {
  const fragments = [];
  for (const part of parts) {
    for (const line of part.split('\n')) {
      // Label separators are often added around a translated word, so they do not count as words.
      const value = line.trim().replace(/^[\s:;,—–•·\-]+|[\s:;,—–•·\-]+$/g, '');
      if (value.length < 3 || !/\p{L}{2}/u.test(value)) continue;
      if (!value.includes(' ') && /^[a-z0-9_.:/\-]+$/.test(value)) continue;
      fragments.push(value);
    }
  }
  return fragments;
}

/** True when a string reads like text for a person rather than a key, path, format or header. */
export function isUiText(parts) {
  const fragments = usableFragments(parts);
  if (!fragments.length) return false;
  const whole = fragments.join(' ');
  if (HTTP_WORDS.has(whole)) return false;
  if (/^(https?:|wss?:|package:|dart:|assets\/|\/)/.test(whole)) return false;
  if (/\.(dart|png|jpe?g|svg|json|ttf|otf|webp|gif|html|md|ts|tsx)$/i.test(whole)) return false;
  if (/^[yMdHhmsaEZ:\-/.,\s]+$/.test(whole)) return false;
  const oneWord = !whole.includes(' ');
  if (oneWord && /^[A-Z0-9_\-.]+$/.test(whole)) return false;
  if (oneWord && /\p{Ll}\p{Lu}/u.test(whole)) return false;
  if (oneWord && /^[a-z]/.test(whole) && !/[^\x00-\x7F]/.test(whole)) return false;
  if (oneWord && whole.length > 32) return false;
  if (/^(multipart\/|data:|application\/|content-)/i.test(whole)) return false;
  return true;
}

function decodeEscape(src, i) {
  const c = src[i + 1];
  if (c === 'n') return ['\n', i + 2];
  if (c === 't') return ['\t', i + 2];
  if (c === 'r') return ['', i + 2];
  if (c === 'u' && src[i + 2] === '{') {
    const end = src.indexOf('}', i);
    return [String.fromCodePoint(parseInt(src.slice(i + 3, end), 16)), end + 1];
  }
  if (c === 'u') return [String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)), i + 6];
  if (c === 'x') return [String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16)), i + 4];
  return [c ?? '', i + 2];
}

/** All string literals in Dart source, nested ones inside interpolation included. */
export function dartStrings(src) {
  const found = [];
  const skipTrivia = i => {
    if (src.startsWith('//', i)) { const end = src.indexOf('\n', i); return end < 0 ? src.length : end; }
    if (src.startsWith('/*', i)) { const end = src.indexOf('*/', i + 2); return end < 0 ? src.length : end + 2; }
    return i;
  };
  const isRaw = i => /[rR]/.test(src[i - 1] ?? '') && !/\w/.test(src[i - 2] ?? '');
  const readString = start => {
    const raw = isRaw(start);
    const quote = src[start];
    const triple = src.startsWith(quote.repeat(3), start);
    const delimiter = triple ? quote.repeat(3) : quote;
    let i = start + delimiter.length;
    const parts = [];
    let current = '';
    while (i < src.length) {
      if (src.startsWith(delimiter, i)) break;
      if (!triple && src[i] === '\n') break;
      if (!raw && src[i] === '\\') {
        const [value, next] = decodeEscape(src, i);
        current += value;
        i = next;
      } else if (!raw && src[i] === '$' && src[i + 1] === '{') {
        parts.push(current);
        current = '';
        i += 2;
        for (let depth = 1; i < src.length && depth > 0;) {
          const skipped = skipTrivia(i);
          if (skipped !== i) { i = skipped; continue; }
          if (src[i] === "'" || src[i] === '"') { i = readString(i); continue; }
          if (src[i] === '{') depth++;
          else if (src[i] === '}') depth--;
          i++;
        }
      } else if (!raw && src[i] === '$' && /[A-Za-z_]/.test(src[i + 1] ?? '')) {
        parts.push(current);
        current = '';
        i++;
        while (/\w/.test(src[i] ?? '')) i++;
      } else {
        current += src[i++];
      }
    }
    parts.push(current);
    found.push({ text: src.slice(start + delimiter.length, i), parts, offset: start, before: src.slice(Math.max(0, start - 48), start) });
    return src.startsWith(delimiter, i) ? i + delimiter.length : i;
  };
  for (let i = 0; i < src.length;) {
    const skipped = skipTrivia(i);
    if (skipped !== i) { i = skipped; continue; }
    if (src[i] === "'" || src[i] === '"') { i = readString(i); continue; }
    i++;
  }
  return found;
}

/** All string literals and JSX text in TypeScript source. */
export function tsStrings(src) {
  const found = [];
  const skipTrivia = i => {
    if (src.startsWith('//', i)) { const end = src.indexOf('\n', i); return end < 0 ? src.length : end; }
    if (src.startsWith('/*', i)) { const end = src.indexOf('*/', i + 2); return end < 0 ? src.length : end + 2; }
    return i;
  };
  const skipRegex = i => {
    const before = src.slice(Math.max(0, i - 40), i).trimEnd().at(-1);
    if (src[i] !== '/' || (before && !'(,=:[!&|?{};\n'.includes(before))) return i;
    for (let j = i + 1; j < src.length && src[j] !== '\n'; j++) {
      if (src[j] === '\\') j++;
      else if (src[j] === '/') return j + 1;
    }
    return i;
  };
  const readString = start => {
    const quote = src[start];
    let i = start + 1;
    const parts = [];
    let current = '';
    while (i < src.length) {
      if (src[i] === quote) break;
      if (quote !== '`' && src[i] === '\n') break;
      if (src[i] === '\\') {
        const [value, next] = decodeEscape(src, i);
        current += value;
        i = next;
      } else if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
        parts.push(current);
        current = '';
        i += 2;
        for (let depth = 1; i < src.length && depth > 0;) {
          const skipped = skipTrivia(i);
          if (skipped !== i) { i = skipped; continue; }
          if ("'\"`".includes(src[i])) { i = readString(i); continue; }
          if (src[i] === '{') depth++;
          else if (src[i] === '}') depth--;
          i++;
        }
      } else {
        current += src[i++];
      }
    }
    parts.push(current);
    found.push({ text: src.slice(start + 1, i), parts, offset: start, before: src.slice(Math.max(0, start - 48), start) });
    return src[i] === quote ? i + 1 : i;
  };
  for (let i = 0; i < src.length;) {
    const skipped = skipTrivia(i);
    if (skipped !== i) { i = skipped; continue; }
    const pastRegex = skipRegex(i);
    if (pastRegex !== i) { i = pastRegex; continue; }
    if ("'\"`".includes(src[i])) { i = readString(i); continue; }
    i++;
  }
  for (const m of src.matchAll(/>([^<>{}=;()]*\p{L}[^<>{}=;()]*)<\//gu)) {
    found.push({ text: m[1].trim(), parts: [m[1]], offset: m.index + 1, before: '>' });
  }
  return found;
}

export const shownInDart = item => !DART_NOT_SHOWN.test(item.before);
// V4's parsers throw plain English that V2's typed models never needed, and no screen shows it.
const V4_INTERNAL = /^(Invalid|Expected|Unknown|Too much|Snapshot|IndexedDB|Update connection|App info|WebSocket|Quantity must|USB printer)\b/;
export const shownInTs = item => !TS_NOT_SHOWN.test(item.before) && !V4_INTERNAL.test(item.text);
export const fragmentsOf = parts => usableFragments(parts);
export const lineAt = (src, offset) => src.slice(0, offset).split('\n').length;

/** Makes source text comparable: escaped quotes become quotes. */
export const comparable = text => text.replace(/\\(['"`$])/g, '$1');

/** Dice coefficient over letter pairs, used only to suggest which string a missing one was reworded into. */
export function similarity(a, b) {
  const pairs = text => {
    const lower = text.toLowerCase();
    const counts = new Map();
    for (let i = 0; i < lower.length - 1; i++) counts.set(lower.slice(i, i + 2), (counts.get(lower.slice(i, i + 2)) ?? 0) + 1);
    return counts;
  };
  const left = pairs(a), right = pairs(b);
  let shared = 0;
  for (const [pair, count] of left) shared += Math.min(count, right.get(pair) ?? 0);
  const total = Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0);
  return total ? (2 * shared) / total : 0;
}

export function nearest(text, candidates, cutoff = 0.62) {
  let best = null, score = cutoff;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - text.length) > Math.max(16, text.length / 2)) continue;
    const value = similarity(text, candidate);
    if (value > score) { best = candidate; score = value; }
  }
  return best;
}

const SURFACE = /\b(showDialog|showGeneralDialog|showModalBottomSheet|showSpringBottomSheet|showDatePicker|showTimePicker|showDateRangePicker|showAdminTopNotice|SnackBar|AlertDialog|SimpleDialog|PopScope|WillPopScope|HapticFeedback\.\w+|show[A-Z]\w*(?:Sheet|Dialog|Picker|Notice))\b/g;

/** Every sheet, dialog, snackbar, notice, back guard and haptic a piece of Dart source opens. */
export function surfacesIn(src) {
  return [...src.matchAll(SURFACE)].map(m => ({ kind: m[1], offset: m.index }));
}
