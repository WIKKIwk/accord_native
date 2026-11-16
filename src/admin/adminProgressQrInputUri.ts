import { dartTrim } from './dartJsonString';
import { adminProgressQrInputScan } from './adminProgressQrInputScanner';

/** Purpose-only subset derived from Dart SDK3.13.7 Uri.parse/_Uri helpers. BSD notice accompanies the scanner table. */
class ParseFormatError extends Error {}
const invalid: () => never = () => { throw new ParseFormatError(); };
const unreserved = /^[A-Za-z0-9._~-]$/;
const generalDelimiter = /[:/?#[\]@]/;
const pathChar = /^[A-Za-z0-9!$&'()*+,./:;=@_~-]$/;
const queryChar = /^[A-Za-z0-9!$&'()*+,./:;=?@_~-]$/;
const userInfoChar = /^[A-Za-z0-9!$&'()*+,.:;=_~-]$/;
const byte = (value: number) => `%${value.toString(16).toUpperCase().padStart(2, '0')}`;
function escapeCodePoint(value: number): string {
  // Uri._escapeChar encodes raw lone UTF16 surrogates as their three bytes;
  // unlike Uri.encodeQueryComponent, it does not substitute U+FFFD.
  if (value < 0x80) return byte(value);
  if (value < 0x800) return byte(0xc0 | value >> 6) + byte(0x80 | value & 63);
  if (value < 0x10000) return byte(0xe0 | value >> 12) + byte(0x80 | value >> 6 & 63) + byte(0x80 | value & 63);
  return byte(0xf0 | value >> 18) + byte(0x80 | value >> 12 & 63) + byte(0x80 | value >> 6 & 63) + byte(0x80 | value & 63);
}
function normalizedEscape(value: string, index: number): Readonly<{ text: string; length: number; invalid: boolean }> {
  const hex = value.slice(index + 1, index + 3);
  if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { text: '%25', length: 1, invalid: true };
  const char = String.fromCharCode(parseInt(hex, 16)); return { text: unreserved.test(char) ? char : `%${hex.toUpperCase()}`, length: 3, invalid: false };
}
function normalizeComponent(value: string, allowed: RegExp, path = false, rejectDelimiters = false): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    let char = value.charCodeAt(i);
    if (value[i] === '%') { const normalized = normalizedEscape(value, i); result += normalized.text; i += normalized.length - 1; }
    else if (allowed.test(value[i])) result += value[i];
    else if (path && char === 92) result += '/';
    else if (rejectDelimiters && generalDelimiter.test(value[i])) invalid();
    else {
      const next = value.charCodeAt(i + 1);
      if (char >= 0xd800 && char <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { char = 0x10000 + ((char & 0x3ff) << 10) + (next & 0x3ff); i++; }
      result += escapeCodePoint(char);
    }
  }
  return result;
}
function removeDotSegments(path: string): string {
  if (!path.startsWith('.') && !path.includes('/.')) return path;
  const output: string[] = []; let appendSlash = false;
  for (const segment of path.split('/')) {
    appendSlash = false;
    if (segment === '..') { if (output.length) { output.pop(); if (!output.length) output.push(''); } appendSlash = true; }
    else if (segment === '.') appendSlash = true;
    else output.push(segment);
  }
  if (appendSlash) output.push(''); return output.join('/');
}
function validIPv4(value: string): boolean {
  const parts = value.split('.'); return parts.length === 4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
}
function validateIPv6(value: string): void {
  if (value.length < 2) invalid();
  const wildcard = value.indexOf('::'); if (wildcard !== value.lastIndexOf('::')) invalid();
  const sides = wildcard < 0 ? [value] : [value.slice(0, wildcard), value.slice(wildcard + 2)];
  let count = 0;
  for (let side = 0; side < sides.length; side++) {
    if (!sides[side]) { if (wildcard < 0) invalid(); continue; }
    const parts = sides[side].split(':');
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      if (part.includes('.')) {
        if (side !== sides.length - 1 || index !== parts.length - 1 || !validIPv4(part)) invalid(); count += 2;
      } else { if (!/^[0-9a-fA-F]{1,4}$/.test(part)) invalid(); count++; }
    }
  }
  if (wildcard < 0 ? count !== 8 : count >= 8) invalid();
}
function validateZone(value: string): void {
  for (let i = 0; i < value.length; i++) if (value[i] === '%') { const normalized = normalizedEscape(value, i); if (normalized.invalid) invalid(); i += normalized.length - 1; }
}
function validateHost(host: string): void {
  if (!host) return;
  if (host.startsWith('[')) {
    if (!host.endsWith(']')) invalid(); const address = host.slice(1, -1);
    if (address.startsWith('v')) {
      const prefix = /^v[0-9a-fA-F]+\./.exec(address); if (!prefix || prefix[0].length === address.length) invalid();
      for (let i = prefix[0].length; i < address.length; i++) {
        // Dart SDK indexes its128-character table directly here. Its RangeError
        // propagates through Uri.tryParse even for non-HTTP URI schemes.
        if (address.charCodeAt(i) > 127) throw new RangeError('Invalid IPvFuture address character');
        if (!/^[A-Za-z0-9!$&'()*+,.:;=_~-]$/.test(address[i])) invalid();
      }
    } else {
      const percent = address.indexOf('%'), end = percent < 0 ? address.length : percent;
      if (percent >= 0) validateZone(address.slice(percent + (address.startsWith('25', percent + 1) ? 3 : 1)));
      validateIPv6(address.slice(0, end));
    }
  } else if (host.includes(':')) {
    const percent = host.indexOf('%'), end = percent < 0 ? host.length : percent;
    if (percent >= 0) validateZone(host.slice(percent + (host.startsWith('25', percent + 1) ? 3 : 1)));
    validateIPv6(host.slice(0, end));
  } else {
    // Reg-name accepts escaped whitespace/nonASCII and malformed percent
    // escapes. Only unescaped general delimiters invalidate it.
    for (const char of host) if (generalDelimiter.test(char)) invalid();
  }
}
const within = (digits: string, maximum: string): boolean => { const significant = digits.replace(/^0+/, '') || '0'; return significant.length < maximum.length || significant.length === maximum.length && significant <= maximum; };
function validatePort(raw: string): void {
  let value = dartTrim(raw), negative = false;
  if (value.startsWith('-') || value.startsWith('+')) { negative = value[0] === '-'; value = value.slice(1); }
  if (/^0x/i.test(value)) { value = value.slice(2).toLowerCase(); if (!/^[0-9a-f]+$/.test(value) || !within(value, negative ? '8000000000000000' : 'ffffffffffffffff')) invalid(); }
  else if (!/^[0-9]+$/.test(value) || !within(value, negative ? '9223372036854775808' : '9223372036854775807')) invalid();
}
type Parsed = Readonly<{ scheme: string; path: string; query: string | null }>;
/** Internal Uri.tryParse behavior catches only parse FormatExceptions, not RangeError or later lazy UTF8 decoding. */
export function adminProgressQrInputUri(value: string): Parsed | null {
  try { return parse(value); } catch (error) { if (error instanceof ParseFormatError) return null; throw error; }
}
function parse(value: string): Parsed {
  const end = value.length, indices = [0, -1, -1, 0, 0, end, end, -1];
  let state = adminProgressQrInputScan(value, 0, end, 0, indices);
  if (state >= 14) indices[7] = end;
  const schemeEnd = indices[1];
  if (schemeEnd >= 0) { state = adminProgressQrInputScan(value, 0, schemeEnd, 20, indices); if (state === 20) indices[7] = schemeEnd; }
  const hostStart = indices[2] + 1; let portStart = indices[3], pathStart = indices[4], queryStart = indices[5]; const fragmentStart = indices[6];
  if (fragmentStart < queryStart) queryStart = fragmentStart;
  if (pathStart < hostStart) pathStart = queryStart; else if (pathStart <= schemeEnd) pathStart = schemeEnd + 1;
  if (portStart < hostStart) portStart = pathStart;
  let simple = indices[7] < 0;
  if (simple && (hostStart > schemeEnd + 3 || portStart > 0 && portStart + 1 === pathStart || value.startsWith('\\', pathStart) ||
    hostStart > 0 && (value.startsWith('\\', hostStart - 1) || value.startsWith('\\', hostStart - 2)) ||
    queryStart < end && queryStart === pathStart + 2 && value.startsWith('..', pathStart) || queryStart > pathStart + 2 && value.startsWith('/..', queryStart - 3))) simple = false;
  const scheme = schemeEnd < 0 ? '' : value.slice(0, schemeEnd);
  if (schemeEnd >= 0 && !/^[A-Za-z][A-Za-z0-9+.-]*$/.test(scheme)) invalid();
  if (simple) return { scheme, path: value.slice(pathStart, queryStart), query: queryStart < fragmentStart ? value.slice(queryStart + 1, fragmentStart) : null };
  const normalizedScheme = scheme.toLowerCase();
  if (hostStart > 0) {
    const userInfoStart = schemeEnd + 3;
    if (userInfoStart < hostStart) normalizeComponent(value.slice(userInfoStart, hostStart - 1), userInfoChar, false, true);
    validateHost(value.slice(hostStart, portStart)); if (portStart + 1 < pathStart) validatePort(value.slice(portStart + 1, pathStart));
  }
  let path = normalizeComponent(value.slice(pathStart, queryStart), pathChar, true);
  if (hostStart > 0 && path && !path.startsWith('/')) path = '/' + path;
  if (normalizedScheme) path = removeDotSegments(path);
  const query = queryStart < fragmentStart ? normalizeComponent(value.slice(queryStart + 1, fragmentStart), queryChar) : null;
  return { scheme: normalizedScheme, path, query };
}
/** Uri.decodeComponent and decodeQueryComponent are strict UTF8. Normalization has already repaired malformed percent spelling. */
export function adminProgressQrInputDecode(value: string, query = false): string {
  try { return decodeURIComponent(query ? value.replace(/\+/g, ' ') : value); }
  catch (error) { if (error instanceof URIError) throw new SyntaxError('Invalid UTF-8 byte'); throw error; }
}
