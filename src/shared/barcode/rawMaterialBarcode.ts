// Dart's String.trim includes NEL (U+0085), unlike JavaScript's trim.
function trimDartWhitespace(value: string): string {
  return value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
}

function decodeDartComponent(value: string, query = false): string {
  // A lone UTF-16 surrogate becomes invalid UTF-8 in Dart's URI normalization.
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (i + 1 >= value.length || next < 0xdc00 || next > 0xdfff) throw new URIError('URI malformed');
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new URIError('URI malformed');
  }
  // Dart Uri.tryParse escapes an invalid percent sign before component decoding.
  const encoded = (query ? value.replace(/\+/g, '%20') : value).replace(/%(?![a-f\d]{2})/gi, '%25');
  return decodeURIComponent(encoded);
}

function validIPv6(address: string): boolean {
  const compression = address.indexOf('::');
  if (compression !== address.lastIndexOf('::')) return false;
  const left = compression < 0 ? address : address.slice(0, compression);
  const right = compression < 0 ? '' : address.slice(compression + 2);
  if (compression >= 0 && (left.startsWith(':') || left.endsWith(':') || right.startsWith(':') || right.endsWith(':') || left.includes('.'))) return false;
  const groups = compression < 0 ? address.split(':') : [...(left ? left.split(':') : []), ...(right ? right.split(':') : [])];
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.includes('.')) {
      if (i !== groups.length - 1) return false;
      const octets = group.split('.');
      if (octets.length !== 4 || octets.some(octet => !/^\d{1,3}$/.test(octet) ||
        (octet.length > 1 && octet.startsWith('0')) || Number(octet) > 255)) return false;
      count += 2;
    } else {
      if (!/^[a-f\d]{1,4}$/i.test(group)) return false;
      count++;
    }
  }
  return compression < 0 ? count === 8 : count < 8;
}

function validBracketHost(inner: string): boolean {
  if (inner.startsWith('v')) return /^v[0-9a-fA-F]+\.[A-Za-z0-9._~!$&'()*+,;=:\-]+$/.test(inner);
  const percent = inner.indexOf('%'), address = percent < 0 ? inner : inner.slice(0, percent);
  if (!validIPv6(address)) return false;
  if (percent < 0) return true;
  const zone = inner.slice(percent + (inner.slice(percent + 1, percent + 3) === '25' ? 3 : 1));
  return !/%(?![a-f\d]{2})/i.test(zone);
}

type UriParts = { scheme: string; authority: string; remainder: string };
function splitAuthority(value: string): UriParts | null {
  const prefix = /^([a-z][a-z\d+.-]*):[\/\\]{2}/i.exec(value);
  if (!prefix) return null;
  let i = prefix[0].length, inBracket = false, closed = false;
  for (; i < value.length; i++) {
    const char = value[i];
    if (char === '[' && !inBracket) { inBracket = true; closed = false; continue; }
    if (char === ']' && inBracket) { closed = true; continue; }
    if ('/\\?#'.includes(char) && (!inBracket || closed)) break;
  }
  return { scheme: prefix[1], authority: value.slice(prefix[0].length, i), remainder: value.slice(i) };
}

function authorityAt(authority: string): number {
  let inBracket = false, closed = false, at = -1;
  for (let i = 0; i < authority.length; i++) {
    const char = authority[i];
    if (char === '[' && !inBracket) { inBracket = true; closed = false; continue; }
    if (char === ']' && inBracket) { closed = true; continue; }
    if (char === '@' && (!inBracket || closed)) { if (at >= 0) return -2; at = i; }
  }
  return at;
}

function isSimpleUri(scheme: string, host: string, hasPort: boolean, port: string, path: string,
  query: string, fragment: string, hasUser: boolean): boolean {
  return /^[a-z][a-z\d+.-]*$/.test(scheme) && /^[a-z\d._~!$&'()*+,;=-]+$/.test(host) && !hasUser &&
    (!hasPort || /^[1-9]\d*$/.test(port)) && /^[A-Za-z\d._~!$&'()*+,;=\/-]*$/.test(path) &&
    /^[A-Za-z\d._~!$&'()*+,;=?-]*$/.test(query) && /^[A-Za-z\d._~!$&'()*+,;=?-]*$/.test(fragment) &&
    !/(?:^|\/)\.\.(?:\/|$)|(?:^|\/)\.\//.test(path);
}

function validDartPort(port: string, simple: boolean): boolean {
  if (!port) return true;
  const value = trimDartWhitespace(port), decimal = /^[-+]?\d+$/.test(value), hex = /^[-+]?0[xX][a-f\d]+$/.test(value);
  if (!decimal && !hex) return false;
  const negative = value.startsWith('-'), unsigned = value.replace(/^[-+]/, '');
  const digits = (hex ? unsigned.slice(2) : unsigned).replace(/^0+/, '').toLowerCase();
  const maximum = hex ? 'ffffffffffffffff' : negative ? '9223372036854775808' : '9223372036854775807';
  const overflow = digits.length > maximum.length || (digits.length === maximum.length && digits > maximum);
  // Dart's simple URI representation defers integer parsing for a digit-only port.
  return !overflow || simple;
}

/** @v2 rawMaterialBarcodeFromQr */
// Pure, unconnected candidate; device/Hermes parity remains open.
export function rawMaterialBarcodeFromQr(raw: string): string {
  const value = trimDartWhitespace(raw);
  // Dart treats data: as UriData, never as a hierarchical authority.
  if (/^data:/i.test(value)) return value;
  const parts = splitAuthority(value);
  if (!parts) return value;
  const { scheme, authority, remainder } = parts, at = authorityAt(authority);
  if (at === -2 || (at >= 0 && /[\[\]]/.test(authority.slice(0, at)))) return value;
  const hostPort = authority.slice(at + 1);
  if (!hostPort) return value;
  let host: string, port: string, hasPort: boolean;
  if (hostPort.startsWith('[')) {
    const end = hostPort.lastIndexOf(']');
    if (end < 0) return value;
    host = hostPort.slice(0, end + 1);
    const tail = hostPort.slice(end + 1);
    if (tail && !tail.startsWith(':')) return value;
    hasPort = !!tail; port = tail ? tail.slice(1) : '';
    if (!validBracketHost(host.slice(1, -1))) return value;
  } else {
    const colon = hostPort.indexOf(':');
    host = colon < 0 ? hostPort : hostPort.slice(0, colon);
    hasPort = colon >= 0; port = colon < 0 ? '' : hostPort.slice(colon + 1);
    if (/[\[\]]/.test(host)) return value;
  }
  if (!host) return value;
  const hash = remainder.indexOf('#'), question = remainder.indexOf('?');
  const qpos = question >= 0 && (hash < 0 || question < hash) ? question : -1;
  const end = qpos >= 0 ? qpos : hash >= 0 ? hash : remainder.length;
  const path = remainder.slice(0, end).replace(/\\/g, '/');
  const query = qpos < 0 ? '' : remainder.slice(qpos + 1, hash >= 0 ? hash : remainder.length);
  const fragment = hash < 0 ? '' : remainder.slice(hash + 1);
  const simple = isSimpleUri(scheme, host, hasPort, port, path, query, fragment, at >= 0) &&
    !value.includes('\\') && (!path.endsWith('/.') || qpos >= 0 || hash >= 0);
  if (!validDartPort(port, simple)) return value;

  const parameters = new Map<string, string>();
  if (query) for (const pair of query.split('&')) {
    const equals = pair.indexOf('=');
    // Uri.splitQueryString ignores an empty key, including its undecoded value.
    if (equals === 0 || (equals === -1 && !pair)) continue;
    const key = decodeDartComponent(equals < 0 ? pair : pair.slice(0, equals), true);
    const decoded = decodeDartComponent(equals < 0 ? '' : pair.slice(equals + 1), true);
    parameters.set(key, decoded); // Dart queryParameters keeps the final occurrence.
  }
  for (const key of ['barcode', 'epc', 'qr']) {
    const candidate = parameters.get(key);
    if (candidate !== undefined) { const trimmed = trimDartWhitespace(candidate); if (trimmed) return trimmed; }
  }

  const segments = path.split('/'), output: string[] = [];
  let appendSlash = false;
  // The V2 Dart SDK retains a final literal dot in a simple URI followed by query/fragment.
  const simpleFinalDot = simple && (qpos >= 0 || hash >= 0) && path.endsWith('/.');
  for (let i = 0; i < segments.length; i++) {
    const original = segments[i], dot = original.replace(/%2e/gi, '.');
    appendSlash = false;
    if (dot === '..') {
      if (output.length) { output.pop(); if (!output.length) output.push(''); }
      appendSlash = true;
    } else if (dot === '.' && !(simpleFinalDot && i === segments.length - 1)) appendSlash = true;
    else output.push(original);
  }
  if (appendSlash) output.push('');
  let normalized = output.join('/');
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (!normalized) return value;
  const decoded = normalized.split('/').map(segment => decodeDartComponent(segment));
  const last = trimDartWhitespace(decoded[decoded.length - 1]);
  return last || value;
}
