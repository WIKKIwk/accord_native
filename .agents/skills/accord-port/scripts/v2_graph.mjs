// Builds a declaration-level dependency graph of V2's Dart code, so a role's reading list comes from
// what its screens really reference instead of from file names. Reads V2 only; writes nothing.
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir, found = []) => {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.name.endsWith('.dart')) found.push(full);
  }
  return found;
};

/** Splits Dart source into statements at one nesting level, aware of strings, comments and interpolation. */
export function splitStatements(text, start = 0, end = text.length) {
  const statements = [];
  let i = start;
  let statementStart = -1;
  let depth = 0;
  let parens = 0;
  let sawAssign = false;
  const interpolation = [];
  const skipString = () => {
    const raw = text[i - 1] === 'r';
    const quote = text[i];
    const triple = text.startsWith(quote.repeat(3), i);
    const close = triple ? quote.repeat(3) : quote;
    i += close.length;
    while (i < end) {
      if (!raw && text[i] === '\\') { i += 2; continue; }
      if (text.startsWith(close, i)) { i += close.length; return; }
      if (!raw && text[i] === '$' && text[i + 1] === '{') {
        i += 2;
        let nested = 1;
        interpolation.push(1);
        while (i < end && nested > 0) {
          const c = text[i];
          if (c === "'" || c === '"') { skipString(); continue; }
          if (c === '{') nested++;
          if (c === '}') nested--;
          i++;
        }
        interpolation.pop();
        continue;
      }
      if (!triple && text[i] === '\n') return;
      i++;
    }
  };
  while (i < end) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const newline = text.indexOf('\n', i);
      i = newline < 0 ? end : newline + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close < 0 ? end : close + 2;
      continue;
    }
    if (statementStart < 0 && /\s/.test(c)) { i++; continue; }
    if (statementStart < 0) { statementStart = i; sawAssign = false; }
    if (c === "'" || c === '"') { skipString(); continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '(') parens++;
    else if (c === ')') parens--;
    else if (c === ']') depth--;
    else if (c === '=' && depth === 0 && parens === 0 && text[i + 1] !== '=' && text[i - 1] !== '=' && text[i - 1] !== '!' && text[i - 1] !== '<' && text[i - 1] !== '>') sawAssign = true;
    else if (c === '}') {
      depth--;
      if (depth === 0 && parens === 0 && !sawAssign) {
        statements.push({ start: statementStart, end: i + 1 });
        statementStart = -1;
        i++;
        continue;
      }
    } else if (c === ';' && depth === 0 && parens === 0) {
      statements.push({ start: statementStart, end: i + 1 });
      statementStart = -1;
    }
    i++;
  }
  return statements;
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'assert', 'super', 'this', 'new']);
/** Reads what a statement declares. */
export function declaredBy(source) {
  const clean = source.replace(/^(\s*@\w+(\([^)]*\))?\s*)+/, '');
  let m = /^(?:(?:abstract|sealed|final|base|interface|mixin)\s+)*class\s+(\w+)/.exec(clean);
  if (m) return { kind: 'class', name: m[1] };
  m = /^(?:base\s+)?mixin\s+(\w+)/.exec(clean);
  if (m) return { kind: 'class', name: m[1] };
  m = /^enum\s+(\w+)/.exec(clean);
  if (m) return { kind: 'class', name: m[1] };
  m = /^extension\s+(?:type\s+)?(\w+)?\s*(?:<[^>]*>)?\s*on\s+([\w.]+)/.exec(clean);
  if (m) return { kind: 'extension', name: m[1] ?? `ext_on_${m[2]}`, on: m[2] };
  m = /^typedef\s+(?:[\w<>,?\s]+\s+)?(\w+)\s*(?:<[^>]*>)?\s*(?:=|\()/.exec(clean);
  if (m) return { kind: 'typedef', name: m[1] };
  m = /\bget\s+(\w+)\s*(?:=>|\{|async)/.exec(clean.slice(0, 300));
  if (m) return { kind: 'member', name: m[1] };
  m = /\bset\s+(\w+)\s*\(/.exec(clean.slice(0, 300));
  if (m) return { kind: 'member', name: m[1] };
  const head = clean.slice(0, 600);
  const call = /^(?:[\w<>,?.\s\[\]()]*?\s)?([A-Za-z_]\w*)\s*(?:<[^>()]*>)?\s*\(/.exec(head);
  const assign = /^[^=(]*?([A-Za-z_]\w*)\s*(?:=|;)/.exec(head);
  const beforeParen = head.indexOf('(');
  const beforeAssign = head.search(/=[^=>]/);
  if (assign && (beforeParen < 0 || (beforeAssign >= 0 && beforeAssign < beforeParen))) {
    return KEYWORDS.has(assign[1]) ? null : { kind: 'member', name: assign[1] };
  }
  if (call && !KEYWORDS.has(call[1])) return { kind: 'member', name: call[1] };
  return null;
}

const tokensOf = text => new Set(text.match(/\b[A-Za-z_]\w*\b/g) ?? []);
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** Paths left out of the graph. Each is handled in its own way rather than as ordinary reading. */
const HUB = /^lib\/src\/(core\/localization\/|core\/test_mode\/|app\/|core\/native_iroh_transport|core\/network\/resilient_iroh_route|core\/app_preview)/;
const WEB_ONLY = /(_web|_stub)\.dart$/;

export function buildGraph(v2Root) {
  const nodes = [];
  const byName = new Map();
  const extensionsOn = new Map();
  const extensionMembers = new Map();
  const members = new Map();
  const files = walk(path.join(v2Root, 'lib')).map(file => path.relative(v2Root, file).split(path.sep).join('/'));
  const texts = new Map(files.map(file => [file, fs.readFileSync(path.join(v2Root, file), 'utf8')]));
  const libraryOf = new Map();
  for (const file of files) {
    const partOf = /^part of ['"]([^'"]+)['"]/m.exec(texts.get(file));
    libraryOf.set(file, partOf ? path.posix.normalize(path.posix.join(path.posix.dirname(file), partOf[1])) : file);
  }
  // Dart scoping: a public name is only visible through the library's imports and what those re-export.
  const directImports = new Map();
  const directExports = new Map();
  const resolveUri = (from, uri) => {
    if (uri.startsWith('package:accord_mobile_v2/')) return `lib/${uri.slice('package:accord_mobile_v2/'.length)}`;
    if (uri.startsWith('package:') || uri.startsWith('dart:')) return null;
    return path.posix.normalize(path.posix.join(path.posix.dirname(from), uri));
  };
  for (const file of files) {
    const library = libraryOf.get(file);
    for (const m of texts.get(file).matchAll(/^(import|export)\s+((?:['"][^'"]+['"]|\s|if\s*\([^)]*\))+)/gm)) {
      const target = m[1] === 'import' ? directImports : directExports;
      const list = target.get(library) ?? [];
      for (const uri of m[2].matchAll(/['"]([^'"]+)['"]/g)) {
        const resolved = resolveUri(file, uri[1]);
        if (resolved) list.push(resolved);
      }
      target.set(library, list);
    }
  }
  const exportsOf = new Map();
  const exportClosure = library => {
    if (exportsOf.has(library)) return exportsOf.get(library);
    const result = new Set([library]);
    exportsOf.set(library, result);
    for (const next of directExports.get(library) ?? []) for (const item of exportClosure(next)) result.add(item);
    return result;
  };
  const visibleCache = new Map();
  const visibleFrom = library => {
    if (visibleCache.has(library)) return visibleCache.get(library);
    const result = new Set([library]);
    for (const next of directImports.get(library) ?? []) for (const item of exportClosure(next)) result.add(item);
    visibleCache.set(library, result);
    return result;
  };
  const addNode = node => {
    nodes.push(node);
    const list = byName.get(node.name) ?? [];
    list.push(node);
    byName.set(node.name, list);
    return node;
  };
  for (const file of files) {
    if (HUB.test(file) || WEB_ONLY.test(file)) continue;
    const text = texts.get(file);
    const library = libraryOf.get(file);
    for (const statement of splitStatements(text)) {
      const source = text.slice(statement.start, statement.end);
      if (/^(import|export|part|library)\b/.test(source)) continue;
      const decl = declaredBy(source);
      if (!decl) continue;
      const onApi = decl.kind === 'extension' && decl.on === 'MobileApi';
      const isApiClass = decl.kind === 'class' && decl.name === 'MobileApi';
      if (onApi || isApiClass) {
        const open = text.indexOf('{', statement.start);
        for (const member of splitStatements(text, open + 1, statement.end - 1)) {
          const memberSource = text.slice(member.start, member.end);
          const memberDecl = declaredBy(memberSource);
          if (!memberDecl) continue;
          const node = addNode({ name: memberDecl.name, kind: 'api', file, library, line: lineAt(text, member.start), bytes: memberSource.length, source: memberSource });
          const list = members.get(memberDecl.name) ?? [];
          list.push(node);
          members.set(memberDecl.name, list);
        }
        continue;
      }
      const node = addNode({ name: decl.name, kind: decl.kind, file, library, line: lineAt(text, statement.start), bytes: source.length, source });
      if (decl.kind === 'extension') {
        const list = extensionsOn.get(decl.on) ?? [];
        list.push(node);
        extensionsOn.set(decl.on, list);
        const open = text.indexOf('{', statement.start);
        for (const member of splitStatements(text, open + 1, statement.end - 1)) {
          const memberDecl = declaredBy(text.slice(member.start, member.end));
          if (!memberDecl) continue;
          const known = extensionMembers.get(memberDecl.name) ?? [];
          known.push(node);
          extensionMembers.set(memberDecl.name, known);
        }
      }
    }
  }
  for (const node of nodes) node.tokens = tokensOf(node.source);

  const routerText = files.filter(file => /^lib\/src\/app\/.*methods_01\.dart$/.test(file)).map(file => texts.get(file)).join('\n');
  const routeScreens = new Map();
  const chunks = routerText.split(/\bcase AppRoutes\.(\w+):/);
  const pending = [];
  for (let i = 1; i < chunks.length; i += 2) {
    pending.push(chunks[i]);
    const body = chunks[i + 1];
    if (!body.trim()) continue;
    const screens = [...tokensOf(body)].filter(token => /^[A-Z]/.test(token) && byName.has(token) && byName.get(token).some(node => node.kind === 'class'));
    for (const route of pending) routeScreens.set(route, screens);
    pending.length = 0;
  }
  const capabilityText = files.filter(file => /_routeCapabilities\.dart$/.test(file)).map(file => texts.get(file)).join('\n');
  const routeCapabilities = new Map();
  for (const m of capabilityText.matchAll(/AppRoutes\.(\w+):\s*\{([^}]*)\}/g)) {
    routeCapabilities.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map(item => item[1]));
  }
  return { nodes, byName, members, extensionsOn, extensionMembers, routeScreens, routeCapabilities, texts, libraryOf, visibleFrom };
}

/** Routes a role can open: its explicit list, plus anything guarded by one of its capabilities. */
export function routesForRole(graph, role) {
  const routes = new Set(role.routes ?? []);
  for (const [route, capabilities] of graph.routeCapabilities) {
    if (capabilities.some(item => (role.capabilities ?? []).includes(item))) routes.add(route);
  }
  return routes;
}

/** The feature folder a file belongs to, or null for shared code (core, shared features). */
export function featureOf(file) {
  const m = /^lib\/src\/features\/([^/]+)\//.exec(file);
  return m && m[1] !== 'shared' ? m[1] : null;
}

/**
 * Everything a role reaches: follows referenced declarations and the navigation the role may use.
 * It stops at other features' code unless the role owns or includes it, and reports those crossings
 * as `borrowed`. A static walk cannot see runtime branches such as worker mode, so this cut is what
 * keeps one bridging call from pulling the whole of production map into every role.
 */
export function reachForRole(graph, role) {
  const allowed = routesForRole(graph, role);
  const owned = new Set(role.features ?? []);
  const includePath = role.includeIf ? new RegExp(role.includeIf.path) : null;
  const includeText = role.includeIf ? new RegExp(role.includeIf.contains) : null;
  const inScope = node => {
    const feature = featureOf(node.file);
    if (!feature || owned.has(feature)) return true;
    return Boolean(includePath?.test(node.file) && includeText.test(graph.texts.get(node.file)));
  };
  const seen = new Set();
  const borrowed = new Map();
  const routesReached = new Set();
  const via = new Map();
  const queue = [];
  let current = null;
  const visit = node => {
    if (seen.has(node)) return;
    if (!inScope(node)) {
      if (!borrowed.has(node)) borrowed.set(node, current);
      return;
    }
    seen.add(node);
    via.set(node, current);
    queue.push(node);
  };
  const visitName = (name, from, force = false) => {
    const isPrivate = name.startsWith('_');
    const visible = from ? graph.visibleFrom(from.library) : null;
    for (const node of [...(graph.byName.get(name) ?? []), ...(graph.extensionMembers.get(name) ?? [])]) {
      if (node.kind === 'api' && from?.kind !== 'api') continue;
      if (from && isPrivate && node.library !== from.library) continue;
      if (from && !isPrivate && !visible.has(node.library)) continue;
      if (force && !seen.has(node)) {
        seen.add(node);
        via.set(node, current);
        queue.push(node);
      } else visit(node);
    }
  };
  const openRoute = route => {
    if (routesReached.has(route)) return;
    routesReached.add(route);
    // A route the role is allowed to open is in scope even when its screen lives in another feature.
    for (const screen of graph.routeScreens.get(route) ?? []) visitName(screen, null, role.routeScreensInScope !== false);
  };
  for (const route of allowed) openRoute(route);
  for (const name of role.seeds ?? []) visitName(name, null, true);
  while (queue.length) {
    const node = queue.shift();
    current = node;
    for (const token of node.tokens) {
      if (token === 'MobileApi' || token === 'AppRoutes') continue;
      visitName(token, node);
    }
    for (const extension of graph.extensionsOn.get(node.name) ?? []) {
      if (seen.has(extension)) continue;
      seen.add(extension);
      via.set(extension, node);
      queue.push(extension);
    }
    for (const m of node.source.matchAll(/\bAppRoutes\s*\.\s*(\w+)/g)) {
      if (allowed.has(m[1])) openRoute(m[1]);
    }
    for (const m of node.source.matchAll(/\b(?:MobileApi\s*\.\s*instance|widget\s*\.\s*api|_api|api|mobileApi)\s*\.\s*(\w+)/g)) {
      for (const member of graph.members.get(m[1]) ?? []) visit(member);
    }
  }
  return { nodes: [...seen], borrowed, routes: allowed, routesReached, via };
}
