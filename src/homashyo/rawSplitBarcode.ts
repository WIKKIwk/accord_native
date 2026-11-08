import { preparationInventoryBarcode } from '../preparation/preparationInventory';

// Dart String.trim includes NEL (U+0085), which JavaScript's trim omits.
const trimDartWhitespace = (value: string): string => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
function decodeDartComponent(value: string, query: boolean): string {
  // Dart Uri.tryParse preserves malformed percent triplets by escaping the percent first.
  return decodeURIComponent((query ? value.replace(/\+/g, '%20') : value).replace(/%(?![a-f\d]{2})/gi, '%25'));
}

/** @v2 rawMaterialBarcodeFromQr */
export function rawSplitBarcode(raw: string): string {
  const value = trimDartWhitespace(raw);
  const reuse = (expected: string): string => {
    const existing = preparationInventoryBarcode(raw);
    return existing === expected ? existing : expected;
  };
  const parts = /^([a-z][a-z\d+.-]*:\/\/)([^/?#]+)([\s\S]*)$/i.exec(value);
  if (!value || !parts) return reuse(value);
  const authority = parts[2], at = authority.indexOf('@');
  if (at !== authority.lastIndexOf('@')) return value;
  const hostAndPort = authority.slice(at + 1), host = hostAndPort.startsWith('[')
    ? hostAndPort.slice(0, hostAndPort.indexOf(']') + 1) : hostAndPort.replace(/:\d*$/, '');
  if (!host) return value;
  let url: URL;
  try { url = new URL(value); } catch {
    // Dart accepts numeric ports above 65535. Only the path/query is used here.
    const withoutPort = authority.replace(/:\d+$/, '');
    if (withoutPort === authority) return value;
    try { url = new URL(`${parts[1]}${withoutPort}${parts[3]}`); } catch { return value; }
  }
  if (!url.host && url.protocol !== 'file:') return value;
  const query = new Map<string, string>();
  if (url.search.length > 1) for (const pair of url.search.slice(1).split('&')) {
    const equals = pair.indexOf('=');
    // Uri.splitQueryString ignores empty keys, including their undecoded values.
    if (equals === 0 || (equals === -1 && pair === '')) continue;
    const key = decodeDartComponent(equals < 0 ? pair : pair.slice(0, equals), true);
    const decoded = decodeDartComponent(equals < 0 ? '' : pair.slice(equals + 1), true);
    query.set(key, decoded); // Dart queryParameters keeps the final occurrence.
  }
  for (const key of ['barcode', 'epc', 'qr']) {
    const rawSelected = query.get(key), selected = rawSelected === undefined ? '' : trimDartWhitespace(rawSelected);
    if (selected) return reuse(selected);
  }
  const segments = url.pathname.split('/').map(segment => decodeDartComponent(segment, false));
  const last = trimDartWhitespace(segments[segments.length - 1] ?? '');
  return last ? reuse(last) : value;
}
