#!/usr/bin/env node
// Measures how much of Accord V2 (Flutter) exists in V4 (Expo).
// V2 is opened read-only: this script only reads files and runs read-only git
// commands there, with --no-optional-locks so even `git status` writes nothing.
// Everything it generates goes to V4's .port/ folder, which is git-ignored.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, featureOf, reachForRole } from './v2_graph.mjs';
import { comparable, dartStrings, fragmentsOf, isUiText, lineAt, nearest, shownInDart, shownInTs, surfacesIn, tsStrings } from './ui_text.mjs';

const USAGE = `Usage: node .agents/skills/accord-port/scripts/port_ledger.mjs <command>

  plan                Every role in port order, with what it adds and how many sessions it needs.
  role <id> [part]    A role's reading list, API, surfaces and tests, from V2's real references.
                      Writes .port/role-<id>.md, or .port/role-<id>-<part>.md for one part.
  page <query> [part] Same report for one V2 screen, sheet or dialog: a class name, an AppRoutes name, or a word shown
                      on it. Writes .port/role-page-<name>.md and prints the session name.
  text <id> [platform] Gate: compares what a person reads in V2 with V4, both ways, and lists every sheet, dialog and
                      snackbar. <id> is a role id or page:<query>. platform is ios, android or both (default).
                      Writes .port/text-<id>.md. Accepted differences go in docs/port/text/<id>.tsv.
  shared [a,b,c]      Open API methods that two or more roles need, for the base session to port first.
                      Default: every role not done, except admin and brigader. Writes .port/shared-api.md
  status              Coverage totals and per-domain table. Writes .port/STATUS.md
  worklist <regex>    Search by name instead of by role, matched on V2 paths, endpoints and names.
                      Writes .port/worklist-<slug>.md
  drift               What changed in V2 since the baseline, and which @v2 tags it affects.
  check               Gate: fails on @v2 or @v2-test tags that resolve to nothing in V2.
                      Also warns about V4 endpoints that V2 never mentions literally.
  baseline [commit]   Print the baseline, or set it. Only set it after drift has been handled.

Options: --v2 <path>   V2 checkout. Default: $ACCORD_V2, then ../accord_mobile_v2, then the path on this Mac.
Items listed in docs/port/EXCLUDED.txt are left out of every total.`;

const here = path.dirname(fileURLToPath(import.meta.url));
const V4 = path.resolve(here, '../../../..');
const args = process.argv.slice(2);
const v2Flag = args.indexOf('--v2');
const v2Candidates = [v2Flag >= 0 ? args[v2Flag + 1] : '', process.env.ACCORD_V2 ?? '', '../accord_mobile_v2', '/Users/wikki/Desktop/Accord_project/accord_mobile_v2'];
const V2 = path.resolve(V4, v2Candidates.find(item => item && fs.existsSync(path.resolve(V4, item, 'pubspec.yaml'))) ?? '../accord_mobile_v2');
if (v2Flag >= 0) args.splice(v2Flag, 2);
const [command, param] = args;

const OUT = path.join(V4, '.port');
const BASELINE_FILE = path.join(V4, 'docs/port/V2_BASELINE');
const EXCLUDED_FILE = path.join(V4, 'docs/port/EXCLUDED.txt');

function git(...gitArgs) {
  return execFileSync('git', ['--no-optional-locks', '-C', V2, ...gitArgs], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
}
function walk(dir, keep, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, keep, found);
    else if (keep(entry.name)) found.push(full);
  }
  return found;
}
const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');
const read = file => fs.readFileSync(file, 'utf8');

/** Reads a URL path out of source text, keeping `${...}` balanced so interpolation stays one token. */
function readPathToken(text, start) {
  let i = start;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '$' && text[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      out += '{}';
      continue;
    }
    if (c === '$') {
      const name = /^\$[A-Za-z_][\w.]*/.exec(text.slice(i, i + 80));
      if (!name) break;
      out += '{}';
      i += name[0].length;
      continue;
    }
    if (/['"`\s?\\,)]/.test(c)) break;
    out += c;
    i++;
  }
  return out.replace(/\/+$/, '');
}
function findEndpoints(text) {
  const found = [];
  let index = text.indexOf('/v1/mobile/');
  while (index >= 0) {
    const value = readPathToken(text, index);
    if (value.length > '/v1/mobile'.length) found.push({ value, index });
    index = text.indexOf('/v1/mobile/', index + 1);
  }
  return found;
}
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const VERB = /\b(_get|_post|_put|_patch|_delete|_directGet|_directPost)\(|(?:MultipartRequest|Request)\(\s*'(GET|POST|PUT|PATCH|DELETE)'/;
function verbHint(text, index) {
  const after = VERB.exec(text.slice(index, index + 260));
  const windowBefore = text.slice(Math.max(0, index - 200), index);
  const before = [...windowBefore.matchAll(new RegExp(VERB, 'g'))].pop();
  const hit = before ?? after;
  if (!hit) return '';
  return (hit[2] ?? hit[1].replace(/^_(direct)?/, '')).toUpperCase();
}
const domainOf = endpoint => {
  const parts = endpoint.replace('/v1/mobile/', '').split('/');
  return parts[0] === 'admin' ? `admin/${parts[1] ?? ''}` : parts[0];
};

function readExcluded() {
  if (!fs.existsSync(EXCLUDED_FILE)) return new Set();
  return new Set(read(EXCLUDED_FILE).split('\n').map(line => line.split('#')[0].trim()).filter(Boolean));
}

function scanV2() {
  const lib = path.join(V2, 'lib');
  const files = walk(lib, name => name.endsWith('.dart'));
  const endpoints = new Map();
  const methods = new Map();
  const surfaces = new Map();
  const channels = new Map();
  const storageKeys = new Map();
  const routes = new Map();
  const identifiers = new Set();
  let lines = 0;
  let splitFiles = 0;
  for (const file of files) {
    const text = read(file);
    const relative = rel(V2, file);
    lines += text.split('\n').length;
    if (text.includes('large_library_splitter')) splitFiles++;
    for (const m of text.matchAll(/\b[A-Za-z_]\w*\b/g)) identifiers.add(m[0]);
    for (const { value, index } of findEndpoints(text)) {
      const entry = endpoints.get(value) ?? { endpoint: value, domain: domainOf(value), verbs: new Set(), refs: [], live: /\/live$/.test(value) };
      const verb = verbHint(text, index);
      if (verb) entry.verbs.add(verb);
      entry.refs.push(`${relative}:${lineOf(text, index)}`);
      endpoints.set(value, entry);
    }
    if (relative.includes('/core/api/')) {
      let owner = '';
      const body = text.split('\n');
      body.forEach((line, i) => {
        const head = /^(?:extension\s+\w+\s+on\s+(\w+)|class\s+(\w+))/.exec(line);
        if (head) owner = head[1] ?? head[2];
        const method = /^ {2}(?:static\s+)?(?:Future|Stream)(?:<.*>)?\??\s+([a-zA-Z]\w*)\s*[<(]/.exec(line);
        if (method && !method[1].startsWith('_')) {
          methods.set(`${owner}.${method[1]}`, { symbol: method[1], owner, ref: `${relative}:${i + 1}` });
        }
      });
    }
    for (const m of text.matchAll(/^class\s+(\w+)\s+extends\s+(?:StatefulWidget|StatelessWidget)\b/gm)) {
      const name = m[1];
      const kind = /(Screen|Page)$/.test(name) ? 'screen' : /(Sheet|Dialog)$/.test(name) ? 'sheet' : '';
      if (kind) surfaces.set(name, { name, kind, ref: `${relative}:${lineOf(text, m.index)}` });
    }
    for (const m of text.matchAll(/(Method|Event)Channel\(\s*'([^']+)'/g)) {
      channels.set(m[2], { channel: m[2], type: m[1], ref: `${relative}:${lineOf(text, m.index)}` });
    }
    for (const m of text.matchAll(/\b\w*[kK]ey\w*\s*=\s*'([a-z][a-z0-9_:.-]{2,})'/g)) {
      storageKeys.set(m[1], { key: m[1], ref: `${relative}:${lineOf(text, m.index)}` });
    }
    if (relative.endsWith('app_router_declarations_part_01.dart')) {
      for (const m of text.matchAll(/static const String (\w+)\s*=\s*'([^']+)'/g)) {
        routes.set(`AppRoutes.${m[1]}`, { symbol: `AppRoutes.${m[1]}`, name: m[1], path: m[2], ref: `${relative}:${lineOf(text, m.index)}` });
      }
    }
  }
  const tests = new Map();
  for (const file of walk(path.join(V2, 'test'), name => name.endsWith('.dart'))) {
    const text = read(file);
    const relative = rel(V2, file);
    tests.set(relative, {
      file: relative,
      cases: (text.match(/^\s*(?:test|testWidgets)\(/gm) ?? []).length,
      httpMock: /MockClient|runWithClient/.test(text),
      endpoints: [...new Set(findEndpoints(text).map(item => item.value))],
    });
  }
  const excluded = readExcluded();
  for (const collection of [endpoints, methods, surfaces, channels, storageKeys, routes, tests]) {
    for (const key of [...collection.keys()]) if (excluded.has(key)) collection.delete(key);
  }
  return { fileCount: files.length, lines, splitFiles, endpoints, methods, surfaces, channels, storageKeys, routes, tests, identifiers, excluded: excluded.size };
}

function scanV4() {
  const sources = walk(path.join(V4, 'src'), name => /\.(ts|tsx)$/.test(name));
  const testFiles = walk(path.join(V4, 'tests'), name => /\.(cjs|mjs|js|ts)$/.test(name));
  const inSrc = new Set();
  const inTests = new Set();
  const tags = [];
  const testTags = new Map();
  const collect = (file, target) => {
    const text = read(file);
    const relative = rel(V4, file);
    for (const { value } of findEndpoints(text)) target.add(value);
    const platform = /\.ios\.tsx?$/.test(file) ? 'ios' : /\.android\.tsx?$/.test(file) ? 'android' : 'shared';
    for (const m of text.matchAll(/@v2\s+([A-Za-z_][\w.]*)/g)) tags.push({ symbol: m[1], file: relative, platform, line: lineOf(text, m.index) });
    for (const m of text.matchAll(/@v2-test\s+(test\/[\w./-]+\.dart)/g)) testTags.set(m[1], relative);
  };
  sources.forEach(file => collect(file, inSrc));
  testFiles.forEach(file => collect(file, inTests));
  // Endpoints a V4 test exercises through a recorded V2 contract.
  const contractPaths = new Set();
  for (const file of testFiles) {
    for (const m of read(file).matchAll(/(?:contractFetch|loadContract)\(\s*'([^']+)'/g)) {
      const contract = path.join(V4, 'tests/contracts', `${m[1]}.json`);
      if (!fs.existsSync(contract)) continue;
      for (const record of JSON.parse(read(contract)).records) contractPaths.add(new URL(record.url).pathname);
    }
  }
  return { contractPaths, files: sources.length, lines: sources.reduce((sum, file) => sum + read(file).split('\n').length, 0), inSrc, inTests, tags, testTags };
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const templateCache = new Map();
function matchesTemplate(template, concrete) {
  if (!templateCache.has(template)) {
    templateCache.set(template, new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\}/g, '[^/]+')}$`));
  }
  return templateCache.get(template).test(concrete);
}
function endpointState(endpoint, v4) {
  const test = v4.inTests.has(endpoint) || [...v4.contractPaths].some(value => matchesTemplate(endpoint, value));
  return { impl: v4.inSrc.has(endpoint), test };
}
function symbolState(symbol, tagIndex) {
  const hits = tagIndex.get(symbol) ?? [];
  return {
    ios: hits.some(hit => hit.platform === 'ios' || hit.platform === 'shared'),
    android: hits.some(hit => hit.platform === 'android' || hit.platform === 'shared'),
    any: hits.length > 0,
  };
}
function indexTags(v4) {
  const index = new Map();
  for (const tag of v4.tags) {
    const short = tag.symbol.split('.').pop();
    for (const key of new Set([tag.symbol, short])) {
      index.set(key, [...(index.get(key) ?? []), tag]);
    }
  }
  return index;
}
function writeOut(name, content) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, '.gitignore'), '*\n');
  const target = path.join(OUT, name);
  fs.writeFileSync(target, content);
  return rel(V4, target);
}
function readBaseline() {
  return fs.existsSync(BASELINE_FILE) ? read(BASELINE_FILE).trim() : '';
}

function status() {
  const v2 = scanV2();
  const v4 = scanV4();
  const tagIndex = indexTags(v4);
  const endpointList = [...v2.endpoints.values()];
  const liveCount = endpointList.filter(item => item.live).length;
  const impl = endpointList.filter(item => endpointState(item.endpoint, v4).impl);
  const tested = endpointList.filter(item => endpointState(item.endpoint, v4).test);
  const methodList = [...v2.methods.values()];
  const methodsDone = methodList.filter(item => (tagIndex.get(`${item.owner}.${item.symbol}`) ?? tagIndex.get(item.symbol))?.length);
  const surfaceList = [...v2.surfaces.values()];
  const screens = surfaceList.filter(item => item.kind === 'screen');
  const sheets = surfaceList.filter(item => item.kind === 'sheet');
  const doneOn = (list, platform) => list.filter(item => symbolState(item.name, tagIndex)[platform]).length;
  const routeList = [...v2.routes.values()];
  const routesDone = routeList.filter(item => tagIndex.get(item.symbol)?.length).length;
  const channelList = [...v2.channels.values()];
  const channelsDone = channelList.filter(item => tagIndex.get(item.channel.replace(/\W+/g, '_'))?.length).length;
  const testList = [...v2.tests.values()].filter(item => item.cases > 0);
  const casesTotal = testList.reduce((sum, item) => sum + item.cases, 0);
  const testsPorted = testList.filter(item => v4.testTags.has(item.file));
  const head = git('rev-parse', '--short', 'HEAD');
  const baseline = readBaseline();

  const domains = new Map();
  for (const item of endpointList) {
    const row = domains.get(item.domain) ?? { total: 0, impl: 0, test: 0 };
    const state = endpointState(item.endpoint, v4);
    row.total++;
    if (state.impl) row.impl++;
    if (state.test) row.test++;
    domains.set(item.domain, row);
  }
  const domainRows = [...domains.entries()].sort((a, b) => b[1].total - a[1].total)
    .map(([domain, row]) => `| ${domain} | ${row.total} | ${row.impl} | ${row.test} |`).join('\n');

  const report = `# V2 -> V4 port status

Generated by port_ledger.mjs. V2 HEAD ${head}, baseline ${baseline || '(not set)'}.
V2: ${v2.fileCount} Dart files, ${v2.lines} lines (${v2.splitFiles} generated by large_library_splitter). V4: ${v4.files} source files, ${v4.lines} lines.
${v2.excluded} items are excluded by docs/port/EXCLUDED.txt.

| What | V2 total | In V4 | Coverage |
|---|---:|---:|---:|
| Endpoints used by code (${liveCount} are WebSocket) | ${endpointList.length} | ${impl.length} | ${pct(impl.length, endpointList.length)} |
| Endpoints exercised by a V4 test | ${endpointList.length} | ${tested.length} | ${pct(tested.length, endpointList.length)} |
| Public API methods (@v2 tag) | ${methodList.length} | ${methodsDone.length} | ${pct(methodsDone.length, methodList.length)} |
| Routes (@v2 tag) | ${routeList.length} | ${routesDone} | ${pct(routesDone, routeList.length)} |
| Screens on iOS (@v2 tag) | ${screens.length} | ${doneOn(screens, 'ios')} | ${pct(doneOn(screens, 'ios'), screens.length)} |
| Screens on Android (@v2 tag) | ${screens.length} | ${doneOn(screens, 'android')} | ${pct(doneOn(screens, 'android'), screens.length)} |
| Sheets and dialogs on iOS (@v2 tag) | ${sheets.length} | ${doneOn(sheets, 'ios')} | ${pct(doneOn(sheets, 'ios'), sheets.length)} |
| Sheets and dialogs on Android (@v2 tag) | ${sheets.length} | ${doneOn(sheets, 'android')} | ${pct(doneOn(sheets, 'android'), sheets.length)} |
| Native channels (@v2 tag) | ${channelList.length} | ${channelsDone} | ${pct(channelsDone, channelList.length)} |
| V2 test files ported (@v2-test tag), of ${casesTotal} cases | ${testList.length} | ${testsPorted.length} | ${pct(testsPorted.length, testList.length)} |

## Endpoints by domain

| Domain | Total | Implemented | Tested |
|---|---:|---:|---:|
${domainRows}
`;
  console.log(report);
  console.log(`Saved: ${writeOut('STATUS.md', report)}`);
}

const ROLES_FILE = path.join(here, '../references/roles.json');
const readRoles = () => JSON.parse(read(ROLES_FILE));
const tokens = bytes => Math.round(bytes / 4);
const kTokens = bytes => `${Math.round(bytes / 4000)}k`;

/** Walks roles in order and gives each one only the code no earlier role has already covered. */
function layRoles(graph, config) {
  const covered = new Map();
  return config.roles.map(role => {
    const reach = reachForRole(graph, role);
    const fresh = reach.nodes.filter(node => !covered.has(node));
    const earlier = new Map();
    for (const node of reach.nodes) {
      const owner = covered.get(node);
      if (owner) earlier.set(owner, (earlier.get(owner) ?? 0) + node.bytes);
    }
    for (const node of fresh) covered.set(node, role.id);
    return { role, reach, fresh, earlier };
  });
}

/** Reading order: API first, then shared code, then the role's own code, keeping each file whole. */
function partsOf(fresh, budgetTokens) {
  const rank = node => (node.kind === 'api' ? 0 : node.file.includes('/core/api/') ? 1 : !featureOf(node.file) ? 2 : 3);
  const byFile = new Map();
  for (const node of fresh) {
    const key = `${rank(node)}|${node.file}`;
    byFile.set(key, [...(byFile.get(key) ?? []), node]);
  }
  const ordered = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
  const parts = [];
  let current = [];
  let size = 0;
  for (const [, nodes] of ordered) {
    const bytes = nodes.reduce((sum, node) => sum + node.bytes, 0);
    if (current.length && tokens(size + bytes) > budgetTokens) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(...nodes);
    size += bytes;
  }
  if (current.length) parts.push(current);
  return parts;
}

function plan() {
  const graph = buildGraph(V2);
  const config = readRoles();
  const laid = layRoles(graph, config);
  const rows = laid.map(({ role, reach, fresh }) => {
    const bytes = fresh.reduce((sum, node) => sum + node.bytes, 0);
    const alone = reach.nodes.reduce((sum, node) => sum + node.bytes, 0);
    const parts = partsOf(fresh, config.partBudgetTokens).length;
    return { id: role.id, title: role.title, alone, bytes, parts, api: fresh.filter(node => node.kind === 'api').length };
  });
  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  const reached = new Set(laid.flatMap(item => item.reach.nodes));
  const missedApi = graph.nodes.filter(node => node.kind === 'api' && !node.name.startsWith('_') && !reached.has(node)).map(node => node.name);
  const missedScreens = graph.nodes.filter(node => node.kind === 'class' && /(Screen|Page)$/.test(node.name) && !reached.has(node)).map(node => node.name);
  const report = `# Port plan

Reading cost only, as characters / 4. "New" assumes the roles are ported in this order. Pick any role first and
its own reading list (the role command) then includes the shared code it needs, so it costs more than shown here.
A static walk over-counts shared screens with runtime branches, so treat these as upper bounds.
One part is at most ${kTokens(config.partBudgetTokens * 4)} tokens of V2 code to read, so it fits one logic session.

| Role | What | Alone | New | Parts | New API methods |
|---|---|---:|---:|---:|---:|
${rows.map(row => `| ${row.id} | ${row.title} | ${kTokens(row.alone)} | ${kTokens(row.bytes)} | ${row.parts} | ${row.api} |`).join('\n')}
| **Total** | | | **${kTokens(total)}** | **${rows.reduce((sum, row) => sum + row.parts, 0)}** | **${rows.reduce((sum, row) => sum + row.api, 0)}** |

## Not reached from any role's routes

Each is dead code, or is reached in a way this walk cannot see, such as a dynamic route. Decide which in the final sweep.

- Public API methods (${missedApi.length}): ${missedApi.join(', ') || 'none'}
- Screens (${missedScreens.length}): ${missedScreens.join(', ') || 'none'}
`;
  console.log(report);
  console.log(`Saved: ${writeOut('PLAN.md', report)}`);
}

const DONE_FILE = path.join(V4, 'docs/port/DONE_ROLES.txt');
const readDone = () => new Set(fs.existsSync(DONE_FILE) ? read(DONE_FILE).split('\n').map(line => line.split('#')[0].trim()).filter(Boolean) : []);

/** One role's reach, minus only the roles whose logic is really ported (docs/port/DONE_ROLES.txt), in any order. */
function layOne(graph, config, id) {
  const role = config.roles.find(item => item.id === id);
  if (!role) return null;
  const done = readDone();
  const covered = new Map();
  for (const other of config.roles) {
    if (other.id === id || !done.has(other.id)) continue;
    for (const node of reachForRole(graph, other).nodes) if (!covered.has(node)) covered.set(node, other.id);
  }
  const reach = reachForRole(graph, role);
  const fresh = reach.nodes.filter(node => !covered.has(node));
  const earlier = new Map();
  for (const node of reach.nodes) {
    const owner = covered.get(node);
    if (owner) earlier.set(owner, (earlier.get(owner) ?? 0) + node.bytes);
  }
  return { role, reach, fresh, earlier };
}

/** Admin and brigader reach nearly everything, so counting them would call every method shared. */
const BROAD_ROLES = new Set(['admin', 'brigader']);

function sharedReport(list) {
  const graph = buildGraph(V2);
  const config = readRoles();
  const done = readDone();
  const wanted = list ? new Set(list.split(',').map(item => item.trim()).filter(Boolean)) : null;
  for (const id of wanted ?? []) if (!config.roles.some(role => role.id === id)) throw new Error(`Unknown role "${id}".`);
  const picked = config.roles.filter(role => (wanted ? wanted.has(role.id) : !done.has(role.id) && !BROAD_ROLES.has(role.id)));
  const tagIndex = indexTags(scanV4());
  const users = new Map();
  for (const role of picked) {
    for (const node of reachForRole(graph, role).nodes) {
      if (node.kind !== 'api' || node.name.startsWith('_') || tagIndex.get(node.name)?.length) continue;
      const item = users.get(node.name) ?? { node, roles: [] };
      item.roles.push(role.id);
      users.set(node.name, item);
    }
  }
  const shared = [...users.values()].filter(item => item.roles.length > 1).sort((a, b) => a.node.name.localeCompare(b.node.name));
  const report = `# Open API methods that two or more roles need (${shared.length})

The base session ports these, so sessions running in parallel do not write them twice.
Roles checked: ${picked.map(role => role.id).join(', ')}.

${shared.map(({ node, roles }) => `- [ ] ${node.name} <- ${node.file}:${node.line} (${tokens(node.bytes)} tok), needed by: ${roles.join(', ')}`).join('\n') || '- none'}
`;
  console.log(`${shared.length} open API methods are needed by two or more roles.`);
  console.log(`Saved: ${writeOut('shared-api.md', report)}`);
}

const toKebab = name => name.replace(/^_+/, '').replace(/(Screen|Page)$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Finds the one V2 surface a query means and describes it as a role, so reports and gates work the same. */
function pageRole(graph, query) {
  if (!query) throw new Error('page needs a query: a class name, an AppRoutes name, or a word shown on the page.');
  const surfaces = [...scanV2().surfaces.values()];
  const wanted = query.replace(/^AppRoutes\./, '').toLowerCase();
  const routeNames = [...graph.routeScreens.keys()];
  const route = routeNames.find(name => name.toLowerCase() === wanted);
  const routeScreens = route ? graph.routeScreens.get(route) ?? [] : [];
  let hits = surfaces.filter(item => item.name.toLowerCase() === wanted || routeScreens.includes(item.name));
  if (!hits.length) hits = surfaces.filter(item => item.name.toLowerCase().includes(wanted));
  if (!hits.length) {
    hits = surfaces.filter(item => graph.texts.get(item.ref.split(':')[0])?.includes(query));
  }
  if (!hits.length) throw new Error(`No V2 screen, sheet or dialog matches "${query}".`);
  if (hits.length > 1) {
    const list = hits.slice(0, 40).map(item => `- ${item.name} (${item.kind}) <- ${item.ref}`).join('\n');
    const error = new Error(`"${query}" matches ${hits.length} surfaces. Ask the user which one:\n${list}`);
    error.exitCode = 2;
    throw error;
  }
  const [hit] = hits;
  const file = hit.ref.split(':')[0];
  const ownRoutes = routeNames.filter(name => (graph.routeScreens.get(name) ?? []).includes(hit.name));
  const role = { id: `page-${toKebab(hit.name)}`, title: `Page ${hit.name}`, seeds: [hit.name], routes: ownRoutes, features: [featureOf(file)].filter(Boolean) };
  const opened = new Set();
  for (const node of reachForRole(graph, role).nodes) {
    for (const m of node.source.matchAll(/\bAppRoutes\s*\.\s*(\w+)/g)) if (!ownRoutes.includes(m[1])) opened.add(m[1]);
  }
  role.notes = `One page and what it opens directly. V2 source: ${hit.ref}.${opened.size ? ` It also opens these routes, which are other pages and not in this scope: ${[...opened].sort().map(name => `AppRoutes.${name}`).join(', ')}.` : ''}`;
  return role;
}

function roleReport(id, partNumber, extraRole = null) {
  if (!id) throw new Error('role needs an id. Run: plan');
  const graph = buildGraph(V2);
  const config = readRoles();
  if (extraRole) config.roles.push(extraRole);
  const entry = layOne(graph, config, id);
  if (!entry) throw new Error(`Unknown role "${id}". Known: ${config.roles.map(role => role.id).join(', ')}`);
  const { role, reach, fresh, earlier } = entry;
  const parts = partsOf(fresh, config.partBudgetTokens);
  const v2 = scanV2();
  const v4 = scanV4();
  const tagIndex = indexTags(v4);
  const mark = done => (done ? 'x' : ' ');
  const isTagged = node => Boolean(tagIndex.get(node.name)?.length);
  const part = partNumber ? parts[Number(partNumber) - 1] : null;
  if (partNumber && !part) throw new Error(`Role "${id}" has ${parts.length} part(s).`);
  const scope = part ?? fresh;

  const api = scope.filter(node => node.kind === 'api');
  const endpointsIn = node => [...new Set(findEndpoints(node.source).map(item => item.value))].filter(value => v2.endpoints.has(value));
  const endpoints = new Set();
  const privateCalls = new Map(api.map(node => [node.name, node]));
  for (const node of reach.nodes.filter(item => item.kind === 'api')) privateCalls.set(node.name, node);
  const PLUMBING = new Set(['_sendAuthorized', '_sendMultipartAuthorized', '_sendStreamedAuthorized', '_reauthenticateFromStorage', '_performStoredAccountReauthentication', '_loginAt', '_performLogin']);
  const walkEndpoints = (node, seen = new Set()) => {
    if (seen.has(node.name) || PLUMBING.has(node.name)) return [];
    seen.add(node.name);
    const found = endpointsIn(node);
    for (const token of node.tokens) {
      const callee = privateCalls.get(token);
      if (callee && token.startsWith('_') && callee !== node) found.push(...walkEndpoints(callee, seen));
    }
    return found;
  };
  const publicApi = api.filter(node => !node.name.startsWith('_'));
  const apiLines = publicApi.sort((a, b) => a.name.localeCompare(b.name)).map(node => {
    const list = [...new Set(walkEndpoints(node))];
    list.forEach(value => endpoints.add(value));
    const line = `- [${mark(isTagged(node))}] ${node.name} <- ${node.file}:${node.line} (${tokens(node.bytes)} tok)`;
    return list.length ? `${line}\n  ${list.join(', ')}` : line;
  });

  const scopeNames = new Set(scope.map(node => node.name));
  const surfaces = [...v2.surfaces.values()].filter(item => scopeNames.has(item.name));
  const routeNames = [...reach.routesReached].filter(name => (graph.routeScreens.get(name) ?? []).some(screen => scopeNames.has(screen)));
  const channels = new Set();
  for (const node of scope) for (const m of node.source.matchAll(/(?:Method|Event)Channel\(\s*'([^']+)'/g)) channels.add(m[1]);
  const keys = new Set();
  for (const node of scope) for (const m of node.source.matchAll(/\b\w*[kK]ey\w*\s*=\s*'([a-z][a-z0-9_:.-]{2,})'/g)) keys.add(m[1]);

  const readingByFile = new Map();
  for (const node of scope.filter(item => item.kind !== 'api')) readingByFile.set(node.file, [...(readingByFile.get(node.file) ?? []), node]);
  const reading = [...readingByFile.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, nodes]) => {
    const bytes = nodes.reduce((sum, node) => sum + node.bytes, 0);
    const list = nodes.sort((a, b) => a.line - b.line).map(node => `${mark(isTagged(node)) === 'x' ? '[x]' : ''}${node.name}:${node.line}`).join(', ');
    return `- ${file} (${tokens(bytes)} tok): ${list}`;
  });

  const publicNames = new Set(fresh.filter(node => node.kind === 'api' && !node.name.startsWith('_')).map(node => node.name));
  const surfaceNames = new Set([...v2.surfaces.values()].filter(item => fresh.some(node => node.name === item.name)).map(item => item.name));
  const testRows = [];
  for (const [file, info] of v2.tests) {
    if (!info.cases) continue;
    const text = read(path.join(V2, file));
    const logicCases = (text.match(/^\s*test\(/gm) ?? []).length;
    const calls = [...publicNames].filter(name => new RegExp(`\\.${name}\\(`).test(text));
    const uses = [...surfaceNames].filter(name => new RegExp(`\\b${name}\\b`).test(text));
    if (!calls.length && !uses.length) continue;
    testRows.push({ file, logicCases, widgetCases: info.cases - logicCases, httpMock: info.httpMock, calls: calls.length, tok: tokens(text.length) });
  }
  const contractTests = testRows.filter(row => row.httpMock && row.calls > 0 && row.file.endsWith('_test.dart')).sort((a, b) => b.calls - a.calls);
  const logicTests = testRows.filter(row => !contractTests.includes(row) && row.logicCases > 0).sort((a, b) => b.logicCases - a.logicCases);
  const widgetOnly = testRows.filter(row => !contractTests.includes(row) && !logicTests.includes(row));
  const testLine = row => `- [${mark(v4.testTags.has(row.file))}] ${row.file} (${row.logicCases} logic, ${row.widgetCases} widget, ${row.tok} tok)`;

  const borrowed = [...reach.borrowed.entries()].sort(([a], [b]) => b.bytes - a.bytes).slice(0, 40)
    .map(([node, from]) => `- ${node.name} (${tokens(node.bytes)} tok) <- ${from?.name ?? 'route'}: ${node.file}:${node.line}`);
  const bytes = scope.reduce((sum, node) => sum + node.bytes, 0);
  const openBytes = scope.filter(node => !isTagged(node)).reduce((sum, node) => sum + node.bytes, 0);
  const already = [...earlier.entries()].map(([owner, size]) => `${owner} ${kTokens(size)}`).join(', ');

  const report = `# Role: ${role.title} (${id})${part ? `, part ${partNumber} of ${parts.length}` : ''}

${role.notes ?? ''}

To read: ${kTokens(bytes)} tokens of V2 code${part ? '' : `, in ${parts.length} part(s). Run \`${extraRole ? 'page <query>' : `role ${id}`} <part>\` for one part`}.
Still open: about ${kTokens(openBytes)}. Entries marked [x] are already ported, possibly in another role's files: reuse them and do not read them again.
Already ported roles that cover part of this code${already ? `: ${already}` : ': none, so the shared core is included below'}. Do not re-read the covered code unless something here depends on its details.
JSON role values: ${(role.jsonRoles ?? []).join(', ') || 'none'}. Scanned from V2's working tree. Line numbers can shift, so search by symbol.

## Public API methods to port (${publicApi.length})

Private helpers they call are in the same files. Endpoints are listed under each method.

${apiLines.join('\n') || '- none'}

## Routes (${routeNames.length})

${routeNames.map(name => `- [${mark(tagIndex.get(`AppRoutes.${name}`)?.length)}] AppRoutes.${name} (guards: ${(graph.routeCapabilities.get(name) ?? ['none']).join(', ')})`).join('\n') || '- none'}

## Screens, sheets and dialogs: [iOS][Android] (${surfaces.length})

${surfaces.map(item => {
    const state = symbolState(item.name, tagIndex);
    return `- [${mark(state.ios)}][${mark(state.android)}] ${item.kind} ${item.name} <- ${item.ref}`;
  }).join('\n') || '- none'}

## Native channels (${channels.size})

${[...channels].map(name => `- ${name}`).join('\n') || '- none'}

## Likely storage keys (${keys.size}; heuristic)

${[...keys].map(name => `- ${name}`).join('\n') || '- none'}

## Reading list: file (size): symbol:line. [x] means already tagged in V4 (${reading.length} files)

Read these declarations by line range. There is no need to open whole files or explore outside this list unless the code sends you there.

${reading.join('\n') || '- none'}

Tests are listed in .port/role-${id}-tests.md. References into other features are in .port/role-${id}-borrowed.md.
`;
  writeOut(`role-${id}-tests.md`, `# V2 tests for role ${id}

## Record as wire contracts with v2_contracts.sh --role ${id} (${contractTests.length})

These need no reading to get fixtures. Read a test case only for what it asserts after the response.

${contractTests.map(testLine).join('\n') || '- none'}

## Logic tests: port the rule (${logicTests.length})

${logicTests.map(testLine).join('\n') || '- none'}

## Widget-only: read only when a UI detail is unclear (${widgetOnly.length})

${widgetOnly.map(testLine).join('\n') || '- none'}
`);
  writeOut(`role-${id}-borrowed.md`, `# Other features role ${id} references (${reach.borrowed.size}, largest 40 shown)

A static walk cannot tell whether this role reaches these at run time. Check the branch before porting one, and read only that declaration.

${borrowed.join('\n') || '- none'}
`);
  const saved = writeOut(part ? `role-${id}-${partNumber}.md` : `role-${id}.md`, report);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `role-${id}.contract-tests.txt`), contractTests.map(row => row.file).join('\n') + '\n');
  console.log(`${role.title}: ${kTokens(bytes)} tokens to read${part ? ` in part ${partNumber}/${parts.length}` : ` in ${parts.length} part(s)`}, ${publicApi.length} API methods, ${endpoints.size} endpoints, ${surfaces.length} screens/sheets, ${contractTests.length} contract tests, ${logicTests.length} logic tests, ${widgetOnly.length} widget tests.`);
  console.log(`Saved: ${saved}`);
}

function pageReport(query, partNumber) {
  const role = pageRole(buildGraph(V2), query);
  roleReport(role.id, partNumber, role);
  console.log(`Session name: ${role.id}`);
}

const TEXT_DIR = path.join(V4, 'docs/port/text');
const PLATFORMS = ['ios', 'android'];

function readTextExceptions(id) {
  const file = path.join(TEXT_DIR, `${id}.tsv`);
  const rows = new Map();
  if (!fs.existsSync(file)) return rows;
  for (const line of read(file).split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [platform, text, reason] = line.split('\t');
    if (!text || !reason?.trim()) throw new Error(`${rel(V4, file)}: every row needs platform, text and a reason: ${line}`);
    rows.set(`${platform}\t${text}`, reason.trim());
  }
  return rows;
}

/** V4 files for one platform: the folders holding this scope's @v2 tags, plus shared UI code and the platform's routes. */
function scopeFiles(scopeNames, platform, v4 = scanV4()) {
  const other = platform === 'ios' ? 'android' : 'ios';
  const visible = file => !file.includes(`.${other}.`) && !file.includes(`src/app/${other}-`);
  const tagged = new Set(v4.tags.filter(tag => scopeNames.has(tag.symbol.split('.').pop())).map(tag => tag.file));
  const folders = new Set([...tagged].map(file => path.posix.dirname(file)).filter(folder => !/^src(\/(shared|components|printing|app)(\/|$)|$)/.test(folder)));
  const all = walk(path.join(V4, 'src'), name => /\.(ts|tsx)$/.test(name)).map(file => rel(V4, file)).filter(visible);
  const own = all.filter(file => tagged.has(file) || [...folders].some(folder => file.startsWith(`${folder}/`)));
  const shown = all.filter(file => own.includes(file) || file.startsWith('src/shared/') || file.startsWith('src/components/') || file.startsWith(`src/app/${platform}-`));
  return { own, shown };
}

// scopeFiles currently selects by short name, not by Dart library or owner. Do
// not remove a candidate on that basis: a legitimate shared implementation
// could otherwise disappear. Instead, block the gate when multiple V2
// declarations can explain a selected tag, and report their locations.
function ambiguousScopeTags(graph, v4, scopeNames) {
  const result = [];
  for (const tag of v4.tags) {
    if (!tag.file.startsWith('src/')) continue;
    const name = tag.symbol.split('.').pop();
    if (!scopeNames.has(name)) continue;
    const candidates = new Map();
    for (const node of [...(graph.byName.get(name) ?? []), ...(graph.extensionMembers.get(name) ?? [])]) {
      candidates.set(`${node.file}:${node.line}`, node);
    }
    if (candidates.size > 1) result.push({ tag, candidates: [...candidates.values()] });
  }
  return result;
}

function textReport(scope, which = 'both') {
  if (!scope) throw new Error('text needs a role id or page:<query>.');
  if (which !== 'both' && !PLATFORMS.includes(which)) throw new Error(`Unknown platform "${which}". Use ios, android or both.`);
  const platforms = which === 'both' ? PLATFORMS : [which];
  const graph = buildGraph(V2);
  const config = readRoles();
  let id = scope;
  if (scope.startsWith('page:')) {
    const role = pageRole(graph, scope.slice(5));
    config.roles.push(role);
    id = role.id;
  }
  const entry = layOne(graph, config, id);
  if (!entry) throw new Error(`Unknown role "${id}". Known: ${config.roles.map(role => role.id).join(', ')}`);
  const nodes = entry.fresh.filter(node => !node.file.startsWith('lib/src/core/localization/'));
  const scopeNames = new Set(nodes.map(node => node.name));

  const v2Texts = new Map();
  const surfaces = new Map();
  for (const node of nodes) {
    for (const item of dartStrings(node.source)) {
      if (!shownInDart(item) || !isUiText(item.parts)) continue;
      const row = v2Texts.get(item.text) ?? { fragments: fragmentsOf(item.parts), refs: new Set() };
      row.refs.add(`${node.file}:${node.line + lineAt(node.source, item.offset) - 1}`);
      v2Texts.set(item.text, row);
    }
    if (node.kind === 'api') continue;
    for (const item of surfacesIn(node.source)) {
      surfaces.set(`${node.file}:${node.line + lineAt(node.source, item.offset) - 1}`, { kind: item.kind, owner: node.name });
    }
  }
  const v2All = comparable(walk(path.join(V2, 'lib'), name => name.endsWith('.dart')).map(read).join('\n'));
  // Full reached nodes retain shared code covered by a completed role. The
  // graph excludes localization and can miss runtime/borrowed edges, so a
  // global-only match below is an unresolved blocker, not a parity verdict.
  const scopedV2 = comparable(entry.reach.nodes.map(node => node.source).join('\n'));
  const v4 = scanV4();
  const ambiguous = ambiguousScopeTags(graph, v4, scopeNames);
  const exceptions = readTextExceptions(id);
  const accepted = (platform, text) => exceptions.has(`${platform}\t${text}`) || exceptions.has(`both\t${text}`);
  const v2Fragments = [...new Set([...v2Texts.values()].flatMap(row => row.fragments))];
  const result = {};
  for (const platform of platforms) {
    const { own, shown } = scopeFiles(scopeNames, platform, v4);
    const corpus = comparable(shown.map(file => read(path.join(V4, file))).join('\n'));
    // scopeFiles promotes whole folders before filtering the other platform.
    // An opposite-platform tag is relevant only if its folder promotion can
    // actually pull at least one file into this platform's scope.
    const platformAmbiguous = ambiguous.filter(({ tag }) => {
      if (own.includes(tag.file)) return true;
      const folder = path.posix.dirname(tag.file);
      return !/^src(\/(shared|components|printing|app)(\/|$)|$)/.test(folder)
        && own.some(file => file.startsWith(`${folder}/`));
    });
    const uncertainDirs = new Set(platformAmbiguous.map(({ tag }) => path.posix.dirname(tag.file))
      .filter(folder => !/^src(\/(shared|components|printing|app)(\/|$)|$)/.test(folder)));
    const uncertainFiles = new Set(shown.filter(file => platformAmbiguous.some(({ tag }) => tag.file === file)
      || [...uncertainDirs].some(folder => file.startsWith(`${folder}/`))));
    const otherCorpus = comparable(shown.filter(file => !uncertainFiles.has(file)).map(file => read(path.join(V4, file))).join('\n'));
    const uncertainCorpus = comparable([...uncertainFiles].map(file => read(path.join(V4, file))).join('\n'));
    const v4Strings = new Map();
    for (const file of own) {
      const source = read(path.join(V4, file));
      for (const item of tsStrings(source)) {
        if (!shownInTs(item) || !isUiText(item.parts)) continue;
        const row = v4Strings.get(item.text) ?? { fragments: fragmentsOf(item.parts), refs: new Set() };
        row.refs.add(`${file}:${lineAt(source, item.offset)}`);
        v4Strings.set(item.text, row);
      }
    }
    const v4Fragments = [...new Set([...v4Strings.values()].flatMap(row => row.fragments))];
    const missing = [...v2Texts].filter(([text, row]) => !accepted(platform, text) && row.fragments.some(part => !corpus.includes(part)))
      .map(([text, row]) => ({ text, ref: [...row.refs][0], near: nearest(row.fragments.find(part => !corpus.includes(part)), v4Fragments) }));
    const added = [...v4Strings].filter(([text, row]) => !accepted(platform, text) && row.fragments.some(part => !v2All.includes(part)))
      .map(([text, row]) => ({ text, ref: [...row.refs][0], near: nearest(row.fragments.find(part => !v2All.includes(part)), v2Fragments) }));
    const ambiguousMatches = [...v2Texts].filter(([text, row]) => !accepted(platform, text)
      && row.fragments.every(part => corpus.includes(part))
      && row.fragments.some(part => !otherCorpus.includes(part) && uncertainCorpus.includes(part)))
      .map(([text, row]) => ({ text, ref: [...row.refs][0] }));
    const globalOnly = [...v4Strings].filter(([text, row]) => !accepted(platform, text)
      && row.fragments.every(part => v2All.includes(part))
      && row.fragments.some(part => !scopedV2.includes(part)))
      .map(([text, row]) => ({ text, ref: [...row.refs][0] }));
    result[platform] = { missing, added, ambiguous: platformAmbiguous, ambiguousMatches, globalOnly, files: own.length };
  }
  const selectedAmbiguous = ambiguous.filter(item => platforms.some(platform => result[platform].ambiguous.includes(item)));

  const cell = text => text.replace(/\n/g, ' ').replace(/\|/g, '\\|');
  const section = (title, rows, closest) => `### ${title} (${rows.length})

${rows.length ? `| Text | Where | ${closest} |\n|---|---|---|\n${rows.map(row => `| ${cell(row.text)} | ${row.ref} | ${row.near ? cell(row.near) : ''} |`).join('\n')}` : 'None.'}
`;
  const grouped = new Map();
  for (const [ref, item] of surfaces) grouped.set(item.kind, [...(grouped.get(item.kind) ?? []), `${ref} (${item.owner})`]);
  const report = `# What a person reads: ${id}

V2 text in scope: ${v2Texts.size}. Scanned from V2's working tree. Port words exactly: same spelling, punctuation and capitals.

Every row needs one verdict: fix V4, or add a row to docs/port/text/${id}.tsv as \`platform<TAB>text<TAB>reason\`, where platform is ios, android or both. A reason names a fact, such as "V2 never shows this: <file:line>". A row in that file is the only way to accept a difference.

${platforms.map(platform => `## ${platform}, ${result[platform].files} V4 files

${section('V2 text not found in V4', result[platform].missing, 'Closest in V4, maybe reworded')}
${section('V4 text not found in V2', result[platform].added, 'Closest in V2, maybe reworded')}`).join('\n')}
## Scope diagnostics (blocking)

These are unresolved scope risks, not verdicts. Confirm each tag's V2 declaration and each text's actual reachable
screen, including borrowed screens and translations. The current graph does not resolve every class member, dynamic
route, or localization key. These diagnostics do not establish that the remaining text comparison is complete.

### Ambiguous selected @v2 tags (${selectedAmbiguous.length})

${selectedAmbiguous.length ? selectedAmbiguous.map(({ tag, candidates }) => `- ${tag.file}:${tag.line} @v2 ${tag.symbol}: ${candidates.map(node => `${node.file}:${node.line}`).join(', ')}`).join('\n') : 'None detected.'}

${platforms.map(platform => `### ${platform}: V2 text matched only through ambiguous native scope (${result[platform].ambiguousMatches.length})

${result[platform].ambiguousMatches.map(row => `- ${cell(row.text)} <- ${row.ref}`).join('\n') || 'None detected.'}

### ${platform}: V4 text matched globally but not in reached V2 declarations (${result[platform].globalOnly.length})

${result[platform].globalOnly.map(row => `- ${cell(row.text)} <- ${row.ref}`).join('\n') || 'None detected.'}`).join('\n\n')}

## Sheets, dialogs, snackbars and back guards in V2 (${surfaces.size})

Check each one against V4 on every platform you port: when it opens, its words, its buttons and their order, what each button does, whether it can be dismissed.

${[...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([kind, list]) => `### ${kind} (${list.length})\n\n${list.sort().map(item => `- [ ] ${item}`).join('\n')}`).join('\n\n')}
`;
  const saved = writeOut(`text-${id}.md`, report);
  let open = selectedAmbiguous.length;
  for (const platform of platforms) {
    const { missing, added, ambiguousMatches, globalOnly } = result[platform];
    open += missing.length + added.length + ambiguousMatches.length + globalOnly.length;
    console.log(`${platform}: ${missing.length} V2 texts not found in V4, ${added.length} V4 texts not found in V2.`);
    console.log(`${platform}: ${ambiguousMatches.length} texts matched only through ambiguous native scope, ${globalOnly.length} native texts matched only globally in V2.`);
  }
  console.log(`${selectedAmbiguous.length} ambiguous @v2 tag(s) block the text gate.`);
  console.log(`${surfaces.size} sheets, dialogs, snackbars and back guards listed. Saved: ${saved}`);
  if (open) process.exitCode = 1;
}

function worklist(pattern) {
  if (!pattern) throw new Error('worklist needs a regex, for example: worklist "rezka"');
  const match = new RegExp(pattern, 'i');
  const v2 = scanV2();
  const v4 = scanV4();
  const tagIndex = indexTags(v4);
  const mark = done => (done ? 'x' : ' ');
  const endpoints = [...v2.endpoints.values()].filter(item => match.test(item.endpoint) || item.refs.some(ref => match.test(ref)));
  const endpointSet = new Set(endpoints.map(item => item.endpoint));
  const methods = [...v2.methods.values()].filter(item => match.test(item.symbol) || match.test(item.ref));
  const surfaces = [...v2.surfaces.values()].filter(item => match.test(item.name) || match.test(item.ref));
  const routes = [...v2.routes.values()].filter(item => match.test(item.name) || match.test(item.path));
  const channels = [...v2.channels.values()].filter(item => match.test(item.channel) || match.test(item.ref));
  const keys = [...v2.storageKeys.values()].filter(item => match.test(item.key) || match.test(item.ref));
  const tests = [...v2.tests.values()].filter(item => item.cases > 0 && (match.test(item.file) || item.endpoints.some(value => endpointSet.has(value))));
  const dartFiles = walk(path.join(V2, 'lib'), name => name.endsWith('.dart')).filter(file => match.test(rel(V2, file)));
  const dartLines = dartFiles.reduce((sum, file) => sum + read(file).split('\n').length, 0);

  const report = `# Worklist: ${pattern}

V2 HEAD ${git('rev-parse', '--short', 'HEAD')}. ${dartFiles.length} Dart files with matching paths, ${dartLines} lines.
Name-based search. For a role's real scope use the role command.
Scanned from V2's working tree, which can be ahead of the baseline. Line numbers are approximate; search by symbol.

## Endpoints (${endpoints.length}): [impl][test]. HTTP verbs are a hint; confirm them in the code.
${endpoints.map(item => {
    const state = endpointState(item.endpoint, v4);
    return `- [${mark(state.impl)}][${mark(state.test)}] ${[...item.verbs].join('/') || '?'} ${item.endpoint}${item.live ? ' (WebSocket)' : ''} <- ${item.refs.slice(0, 3).join(', ')}`;
  }).join('\n') || '- none'}

## Public API methods (${methods.length})
${methods.map(item => `- [${mark((tagIndex.get(`${item.owner}.${item.symbol}`) ?? tagIndex.get(item.symbol))?.length)}] ${item.symbol} <- ${item.ref}`).join('\n') || '- none'}

## Routes (${routes.length})
${routes.map(item => `- [${mark(tagIndex.get(item.symbol)?.length)}] ${item.symbol} = ${item.path} <- ${item.ref}`).join('\n') || '- none'}

## Screens, sheets and dialogs (${surfaces.length}): [iOS][Android]
${surfaces.map(item => {
    const state = symbolState(item.name, tagIndex);
    return `- [${mark(state.ios)}][${mark(state.android)}] ${item.kind} ${item.name} <- ${item.ref}`;
  }).join('\n') || '- none'}

## Native channels (${channels.length})
${channels.map(item => `- ${item.type}Channel ${item.channel} <- ${item.ref}`).join('\n') || '- none'}

## Likely storage keys (${keys.length}; heuristic, also read the code)
${keys.map(item => `- ${item.key} <- ${item.ref}`).join('\n') || '- none'}

## V2 tests to port first (${tests.length}, ${tests.reduce((sum, item) => sum + item.cases, 0)} cases)
${tests.map(item => `- [${mark(v4.testTags.has(item.file))}] ${item.file} (${item.cases} cases${item.httpMock ? ', HTTP mock' : ''})`).join('\n') || '- none'}
`;
  const slug = pattern.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'all';
  const saved = writeOut(`worklist-${slug}.md`, report);
  console.log(`Worklist "${pattern}": ${endpoints.length} endpoints, ${methods.length} API methods, ${routes.length} routes, ${surfaces.length} screens/sheets, ${channels.length} channels, ${tests.length} test files, ${dartLines} Dart lines.`);
  console.log(`Saved: ${saved}`);
}

function drift() {
  const baseline = readBaseline();
  if (!baseline) throw new Error('No baseline. Set one with: baseline <commit>');
  const head = git('rev-parse', '--short', 'HEAD');
  const changed = git('diff', '--name-only', baseline, 'HEAD', '--', 'lib', 'test').split('\n').filter(Boolean);
  const dirty = git('status', '--porcelain', '--', 'lib', 'test').split('\n').filter(Boolean);
  const commits = git('rev-list', '--count', `${baseline}..HEAD`, '--', 'lib', 'test');
  console.log(`Baseline ${baseline.slice(0, 8)}, V2 HEAD ${head}: ${commits} commits and ${changed.length} files changed under lib/ and test/.`);
  if (dirty.length) console.log(`V2 also has ${dirty.length} uncommitted files. They are someone else's work in progress: do not port them.`);
  const v4 = scanV4();
  const symbols = [...new Set(v4.tags.map(tag => tag.symbol.split('.').pop()))];
  const affected = [];
  for (const file of changed) {
    const full = path.join(V2, file);
    const text = fs.existsSync(full) ? read(full) : '';
    const hits = symbols.filter(symbol => new RegExp(`\\b${symbol}\\b`).test(text));
    const testHit = v4.testTags.has(file);
    if (hits.length || testHit) affected.push({ file, hits, testHit });
  }
  if (!affected.length) {
    console.log('No changed V2 file touches a symbol or test already tagged in V4.');
    return;
  }
  console.log(`\nAlready-ported code to re-check (${affected.length}):`);
  for (const item of affected) console.log(`- ${item.file}${item.testHit ? ' [ported test]' : ''}${item.hits.length ? ` -> ${item.hits.join(', ')}` : ''}`);
  console.log('\nRead each with: git -C ../accord_mobile_v2 diff <baseline> HEAD -- <file>');
}

function check() {
  const v2 = scanV2();
  const v4 = scanV4();
  const problems = [];
  const channelTags = new Set([...v2.channels.keys()].map(name => name.replace(/\W+/g, '_')));
  for (const tag of v4.tags) {
    const short = tag.symbol.split('.').pop();
    if (!v2.identifiers.has(short) && !channelTags.has(tag.symbol)) problems.push(`${tag.file}:${tag.line} @v2 ${tag.symbol} names nothing in V2`);
  }
  for (const [testFile, file] of v4.testTags) {
    if (!v2.tests.has(testFile)) problems.push(`${file} @v2-test ${testFile} does not exist in V2`);
  }
  const known = new Set([...v2.endpoints.keys(), ...[...v2.tests.values()].flatMap(test => test.endpoints), ...readExcluded()]);
  // A recorded V2 request also proves a dynamically assembled endpoint exists.
  const unknown = [...v4.inSrc].filter(value => !known.has(value) &&
    ![...v4.contractPaths].some(recorded => matchesTemplate(value, recorded))).sort();
  if (unknown.length) {
    console.log(`Warning: ${unknown.length} V4 endpoint(s) never appear literally in V2. Each is either built dynamically in V2 or invented in V4, so confirm which:`);
    unknown.forEach(value => console.log(`- ${value}`));
  }
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n${problems.map(item => `- ${item}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${v4.tags.length} @v2 tags and ${v4.testTags.size} @v2-test tags all resolve against V2.`);
}

function baseline(value) {
  if (!value) {
    console.log(readBaseline() || '(not set)');
    return;
  }
  const full = git('rev-parse', '--verify', `${value}^{commit}`);
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${full}\n`);
  console.log(`Baseline set to ${full}`);
}

try {
  if (!fs.existsSync(path.join(V2, 'pubspec.yaml'))) throw new Error(`V2 not found at ${V2}. Pass --v2 <path>.`);
  if (command === 'plan') plan();
  else if (command === 'role') roleReport(param, args[2]);
  else if (command === 'page') pageReport(param, args[2]);
  else if (command === 'text') textReport(param, args[2]);
  else if (command === 'shared') sharedReport(param);
  else if (command === 'status') status();
  else if (command === 'worklist') worklist(param);
  else if (command === 'drift') drift();
  else if (command === 'check') check();
  else if (command === 'baseline') baseline(param);
  else console.log(USAGE);
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
