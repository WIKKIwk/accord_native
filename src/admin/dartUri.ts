// Dart Uri.encodeQueryComponent encodes RFC 3986 unreserved characters, using + for spaces.
// The Dart UTF-8 encoder replaces unpaired UTF-16 surrogates with U+FFFD.
function wellFormed(value: string): string {
  let valid = '';
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { valid += value[i] + value[++i]; continue; }
      valid += '\ufffd';
    } else valid += unit >= 0xdc00 && unit <= 0xdfff ? '\ufffd' : value[i];
  }
  return valid;
}
/** Dart Uri.encodeComponent uses RFC 2396 characters and UTF-8 replacement for lone surrogates. */
export function dartUriComponent(value: string): string { return encodeURIComponent(wellFormed(value)); }
/** Dart Uri.encodeQueryComponent applies RFC 3986 and replaces spaces with +. */
export function dartQueryComponent(value: string): string {
  return dartUriComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, '+');
}
