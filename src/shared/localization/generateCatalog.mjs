// Generates directly from the checked-in V2 baseline; it never reads the V2 working tree.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const v2 = path.resolve(root, '../accord_mobile_v2');
const baseline = readFileSync(path.join(root, 'docs/port/V2_BASELINE'), 'utf8').trim();
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-C', v2, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const paths = git('ls-tree', '-r', '--name-only', baseline, 'lib/src/core/localization').trim().split('\n').filter(name => name.endsWith('.dart'));
const sources = new Map(paths.map(name => [name, git('show', `${baseline}:${name}`)]));
const whitespace = (source, position) => { while (/\s/.test(source[position] ?? '')) position++; return position; };

function literal(source, position) {
  let i = whitespace(source, position), value = '', interpolation = false, found = false;
  while (i < source.length) {
    let raw = false;
    if ((source[i] === 'r' || source[i] === 'R') && ['\'', '"'].includes(source[i + 1])) { raw = true; i++; }
    const quote = source[i];
    if (quote !== '\'' && quote !== '"') break;
    found = true; i++;
    const triple = source.slice(i, i + 2) === quote.repeat(2);
    if (triple) i += 2;
    let closed = false;
    while (i < source.length) {
      if (source[i] === quote && (!triple || source.slice(i, i + 3) === quote.repeat(3))) {
        i += triple ? 3 : 1; closed = true; break;
      }
      let char = source[i++];
      if (!raw && char === '$') interpolation = true;
      if (!raw && char === '\\') {
        char = source[i++];
        const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '\\': '\\', '\'': '\'', '"': '"', '$': '$' };
        if (Object.hasOwn(simple, char)) char = simple[char];
        else if (char === 'x') { char = String.fromCodePoint(parseInt(source.slice(i, i + 2), 16)); i += 2; }
        else if (char === 'u') {
          if (source[i] === '{') { const end = source.indexOf('}', ++i); if (end < 0) throw new Error('Invalid Unicode escape'); char = String.fromCodePoint(parseInt(source.slice(i, end), 16)); i = end + 1; }
          else { char = String.fromCodePoint(parseInt(source.slice(i, i + 4), 16)); i += 4; }
        } else throw new Error(`Unsupported Dart escape \\${char}`);
      }
      value += char;
    }
    if (!closed) throw new Error('Unterminated Dart string');
    i = whitespace(source, i);
  }
  if (!found) throw new Error('String literal required');
  return { value, interpolation, end: i };
}

// Exact English-keyed Urdu translations, as used by AppLocalizations._t.
const urduSource = sources.get('lib/src/core/localization/urdu_locale_translations.dart');
const urduSection = urduSource.slice(urduSource.indexOf('byEnglish ='), urduSource.indexOf('\n  };', urduSource.indexOf('byEnglish =')));
const urdu = new Map();
const pair = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*:/g;
for (const match of urduSection.matchAll(pair)) {
  try {
    const key = literal(urduSection, match.index).value;
    const translated = literal(urduSection, match.index + match[0].length);
    if (!translated.interpolation) urdu.set(key, translated.value);
  } catch { /* Non-literal entries are not emitted. */ }
}
const templates = [...urdu].filter(([key]) => key.includes('$')).map(([key, value]) => {
  const tokens = [...key.matchAll(/\$(?:\{[^{}]*\}|[A-Za-z_]\w*)/g)].map(match => match[0]);
  const specificity = key.replace(/\$(?:\{[^{}]*\}|[A-Za-z_]\w*)/g, '').match(/[A-Za-z\u00c0-\u024f\u0600-\u06ff]/g)?.length ?? 0;
  return { key, value, tokens, specificity };
}).filter(item => item.tokens.length && item.specificity).sort((a, b) => b.specificity - a.specificity);
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function urduFor(english) {
  if (urdu.has(english)) return urdu.get(english);
  for (const item of templates) {
    let offset = 0, expression = '^';
    for (const token of item.tokens) { const index = item.key.indexOf(token, offset); expression += escapeRegex(item.key.slice(offset, index)) + '(.*?)'; offset = index + token.length; }
    const match = new RegExp(expression + escapeRegex(item.key.slice(offset)) + '$', 's').exec(english);
    if (!match) continue;
    let result = '', translatedOffset = 0;
    for (let i = 0; i < item.tokens.length; i++) {
      const index = item.value.indexOf(item.tokens[i], translatedOffset);
      if (index < 0) break;
      result += item.value.slice(translatedOffset, index) + match[i + 1];
      translatedOffset = index + item.tokens[i].length;
    }
    return result + item.value.slice(translatedOffset);
  }
  return english;
}

const getters = {}, methods = {}, production = {}, admin = {}, extensions = {};
const rawProduction = {}, rawAdmin = {};
const productionParts = [
  'app_localizations_qr_history.dart', 'app_localizations_paddon_print.dart', 'app_localizations_paddon_management.dart',
  'app_localizations_paddon_scanning.dart', 'app_localizations_qolip_product_transfer.dart', 'app_localizations_re_pause.dart',
  'app_localizations_temporary_pause.dart', 'app_localizations_cancel_start.dart', 'app_localizations_scanned_wip.dart',
  'app_localizations_reactivation.dart', ...Array.from({ length: 14 }, (_, index) =>
    `app_localizations__productionTranslations_resplit_collection_${String(index + 1).padStart(2, '0')}.dart`),
  'app_localizations_worker_material_use.dart', 'app_localizations_worker_delivery.dart',
];
const adminParts = ['admin_push_config_translations.dart', 'admin_combo_translations.dart', ...Array.from({ length: 23 }, (_, index) =>
  `admin_localization_adminTranslations_resplit_collection_${String(index + 1).padStart(2, '0')}.dart`)];
const priority = name => {
  const file = path.basename(name), productionIndex = productionParts.indexOf(file), adminIndex = adminParts.indexOf(file);
  return productionIndex >= 0 ? 100 + productionIndex : adminIndex >= 0 ? 200 + adminIndex : 0;
};
const orderedSources = [...sources].sort(([left], [right]) => priority(left) - priority(right));
const unsupported = [];
for (const [name, source] of orderedSources) {
  const getter = /\bString\s+get\s+(\w+)\s*=>\s*_t\s*\(/g;
  for (const match of source.matchAll(getter)) {
    try {
      let position = match.index + match[0].length; const values = [];
      while (values.length < 4) {
        const item = literal(source, position);
        if (item.interpolation) throw new Error('Interpolated getter');
        values.push(item.value); position = whitespace(source, item.end);
        if (source[position] !== ',') break;
        position = whitespace(source, position + 1);
        if (source[position] === ')') break;
      }
      if (values.length < 3 || source[position] !== ')') throw new Error('Unsupported _t arguments');
      getters[match[1]] = { uz: values[0], en: values[1], ru: values[2], ur: values[3] ?? urduFor(values[1]) };
    } catch { unsupported.push(`${name}:${match[1]}`); }
  }
  const parameterized = /\bString\s+(\w+)\s*\(([^()]*)\)\s*=>\s*_t\s*\(/g;
  for (const match of source.matchAll(parameterized)) {
    try {
      let position = match.index + match[0].length; const values = [];
      while (values.length < 4) {
        const item = literal(source, position); values.push(item.value); position = whitespace(source, item.end);
        if (source[position] !== ',') break;
        position = whitespace(source, position + 1);
        if (source[position] === ')') break;
      }
      if (values.length < 3 || source[position] !== ')') throw new Error('Unsupported interpolation');
      const params = new Set([...match[2].matchAll(/\b(?:String|int|double|num|Object)\??\s+(\w+)/g)].map(item => item[1]));
      const ur = values[3] ?? urduFor(values[1]);
      const format = value => {
        let formatted = value.replace(/\$\{([A-Za-z_]\w*)\.toStringAsFixed\((\d+)\)\}/g, '{$1:fixed$2}')
          .replace(/\$\{([A-Za-z_]\w*)\.toStringAsFixed\(\1 == \1\.roundToDouble\(\) \? 0 : 2\)\}/g, '{$1:compact2}')
          .replace(/\$([A-Za-z_]\w*)/g, '{$1}');
        if (formatted.includes('${')) throw new Error('Unsupported interpolation');
        for (const variable of formatted.matchAll(/\{([A-Za-z_]\w*)(?::(?:fixed\d+|compact2))?\}/g)) {
          if (!params.has(variable[1])) throw new Error('Unknown interpolation');
        }
        return formatted;
      };
      methods[match[1]] = { uz: format(values[0]), en: format(values[1]), ru: format(values[2]), ur: format(ur) };
    } catch { unsupported.push(`${name}:${match[1]}`); }
  }
  const cases = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*=>\s*_t\s*\(/g;
  for (const match of source.matchAll(cases)) {
    try {
      const key = literal(source, match.index).value;
      let position = match.index + match[0].length; const values = [];
      while (values.length < 4) {
        const item = literal(source, position);
        if (item.interpolation) throw new Error('Interpolated switch value');
        values.push(item.value); position = whitespace(source, item.end);
        if (source[position] !== ',') break;
        position = whitespace(source, position + 1);
        if (source[position] === ')') break;
      }
      if (values.length < 3 || source[position] !== ')') throw new Error('Unsupported switch translation');
      const owners = [...source.slice(0, match.index).matchAll(/^\s*String\s+(?:get\s+)?(\w+)\s*(?:\(|=>)/gm)];
      const namespace = owners.at(-1)?.[1];
      if (!namespace) throw new Error('Unknown translation owner');
      (extensions[namespace] ??= {})[key] = { uz: values[0], en: values[1], ru: values[2], ur: values[3] ?? urduFor(values[1]) };
    } catch { unsupported.push(`${name}:${match[1]}`); }
  }
  const statementCases = /\bcase\s+('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*:\s*return\s+_t\s*\(/g;
  for (const match of source.matchAll(statementCases)) {
    try {
      const key = literal(source, match.index + match[0].indexOf(match[1])).value;
      let position = match.index + match[0].length; const values = [];
      while (values.length < 4) {
        const item = literal(source, position);
        if (item.interpolation) throw new Error('Interpolated switch value');
        values.push(item.value); position = whitespace(source, item.end);
        if (source[position] !== ',') break;
        position = whitespace(source, position + 1);
        if (source[position] === ')') break;
      }
      if (values.length < 3 || source[position] !== ')') throw new Error('Unsupported switch translation');
      const owners = [...source.slice(0, match.index).matchAll(/^\s*String\s+(?:get\s+)?(\w+)\s*(?:\(|=>)/gm)];
      const namespace = owners.at(-1)?.[1];
      if (!namespace) throw new Error('Unknown translation owner');
      (extensions[namespace] ??= {})[key] = { uz: values[0], en: values[1], ru: values[2], ur: values[3] ?? urduFor(values[1]) };
    } catch { unsupported.push(`${name}:${match[1]}`); }
  }
  if (!/\/(?:admin_|app_localizations_)/.test(name)) continue;
  const nested = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*:\s*\{/g;
  for (const match of source.matchAll(nested)) {
    try {
      const key = literal(source, match.index).value;
      let i = match.index + match[0].length, depth = 1, close = i;
      while (close < source.length && depth) {
        if (source[close] === '\'' || source[close] === '"') { close = literal(source, close).end; continue; }
        if (source[close] === '{') depth++;
        if (source[close] === '}') depth--;
        close++;
      }
      if (depth) throw new Error('Unclosed translation map');
      const body = source.slice(i, close - 1), values = {};
      const locale = /['"](uz|en|ru|ur)['"]\s*:/g;
      for (const field of body.matchAll(locale)) {
        const parsed = literal(body, field.index + field[0].length);
        if (parsed.interpolation) throw new Error('Interpolated translation');
        values[field[1]] = parsed.value;
      }
      if (!Object.keys(values).length) continue;
      const english = values.en ?? key;
      const entry = { uz: values.uz ?? english, en: english, ru: values.ru ?? english, ur: values.ur ?? urduFor(english) };
      const file = path.basename(name);
      if (productionParts.includes(file)) { production[key] = entry; rawProduction[key] = values; }
      else if (adminParts.includes(file)) { admin[key] = entry; rawAdmin[key] = values; }
      else if (file.startsWith('app_localizations_')) {
        const namespace = file.slice('app_localizations_'.length, -'.dart'.length);
        (extensions[namespace] ??= {})[key] = entry;
      }
    } catch { unsupported.push(`${name}:${match[1]}`); }
  }
}
const ordered = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const urduUi = new Map();
for (const table of [rawProduction, rawAdmin]) for (const values of Object.values(table)) {
  if (values.uz != null && values.en != null) urduUi.set(values.uz, values.ur ?? urduFor(values.en));
}
const uiSource = sources.get('lib/src/core/localization/urdu_ui_text_translations.dart');
const uiSection = uiSource.slice(uiSource.indexOf('byUzbek ='), uiSource.indexOf('\n  };', uiSource.indexOf('byUzbek =')));
for (const match of uiSection.matchAll(pair)) {
  try {
    const key = literal(uiSection, match.index).value, translated = literal(uiSection, match.index + match[0].length);
    if (!translated.interpolation) urduUi.set(key, translated.value);
  } catch { /* Non-literal entries are not emitted. */ }
}
const output = { baseline, getters: ordered(getters), methods: ordered(methods), production: ordered(production), admin: ordered(admin),
  extensions: Object.fromEntries(Object.entries(extensions).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, ordered(value)])),
  urduEnglish: [...urdu], urduUi: [...urduUi] };
writeFileSync(path.join(root, 'src/shared/localization/catalog.json'), JSON.stringify(output, null, 2) + '\n');
process.stdout.write(`Generated ${Object.keys(getters).length} getters, ${Object.keys(methods).length} parameterized methods, ${Object.keys(production).length} production keys, ${Object.keys(admin).length} admin keys; ${unsupported.length} non-literal entries skipped.\n`);
if (unsupported.length) process.stdout.write(`Skipped: ${unsupported.join(', ')}\n`);
