import { dartTrim } from './dartJsonString';
import { adminProgressQrInputDecode, adminProgressQrInputUri } from './adminProgressQrInputUri';

/** @v2 _extractQrPayload
 * Source function unchanged f119→052. Differential oracle is Dart SDK3.13.7;
 * this does not establish which SDK compiled an existing Flutter app binary. */
export function adminProgressQrPayload(rawValue: string): string {
  const trimmed = dartTrim(rawValue); if (!trimmed) return '';
  // Dart handles data: before its ordinary scanner. Its payload is never an
  // HTTP path, so both successful DataUri parse and parse FormatError return raw.
  if (trimmed.length >= 5 && trimmed.slice(0, 5).toLowerCase() === 'data:') return trimmed;
  const uri = adminProgressQrInputUri(trimmed);
  if (uri === null || uri.scheme !== 'http' && uri.scheme !== 'https') return trimmed;
  const path = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path; if (!path) return trimmed;
  // Materialize EVERY segment before reading queryParameters, including a bad
  // earlier segment that the selected query would otherwise hide.
  const segments = path.split('/').map(value => adminProgressQrInputDecode(value));
  const parameters = new Map<string, string>();
  for (const element of (uri.query ?? '').split('&')) {
    const equals = element.indexOf('=');
    if (equals < 0) { if (element) parameters.set(adminProgressQrInputDecode(element, true), ''); }
    else if (equals !== 0) parameters.set(adminProgressQrInputDecode(element.slice(0, equals), true), adminProgressQrInputDecode(element.slice(equals + 1), true));
  }
  const payload = dartTrim(parameters.get('qr_payload') ?? parameters.get('progress_qr') ?? parameters.get('epc') ?? '');
  return payload || dartTrim(segments[segments.length - 1]);
}
export type AdminProgressQrBarcode = Readonly<{ rawValue?: string | null; displayValue?: string | null }>;
/** @v2 _firstBarcodeValue
 * Original capture order, raw then display for EACH barcode; no cross-capture deduplication is invented. */
export function adminProgressQrFirstBarcodeValue(barcodes: readonly AdminProgressQrBarcode[]): string {
  for (const barcode of barcodes) { const raw = dartTrim(barcode.rawValue ?? ''); if (raw) return raw; const display = dartTrim(barcode.displayValue ?? ''); if (display) return display; }
  return '';
}
