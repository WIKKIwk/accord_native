import { MobileApiException } from '../shared/mobileApiException';
import { WorkerControlException } from '../workerControlsApi';
import { parseWerkaArchiveBatchQr } from './werkaArchiveBatchQr';
import type { werkaQrPreview } from './werkaPaddonApi';

const isApiError = (error: unknown): error is MobileApiException | WorkerControlException =>
  error instanceof MobileApiException || error instanceof WorkerControlException;

/** @v2 _extractLookupBarcode */
export function extractWerkaLookupBarcode(rawValue: string): string | null {
  const raw = rawValue.trim();
  if (!raw) return null;
  try {
    const uri = new URL(raw);
    // Dart Uri.pathSegments is empty for both a missing path and a single root slash.
    if ((uri.protocol === 'http:' || uri.protocol === 'https:') && uri.pathname !== '/' && uri.pathname !== '') {
      const query = (uri.searchParams.get('barcode') ?? uri.searchParams.get('epc') ?? '').trim();
      if (query) return query;
      // Dart Uri normalizes a stray percent to %25 before exposing pathSegments.
      const segments = uri.pathname.split('/').filter(segment => segment.trim())
        .map(segment => decodeURIComponent(segment.replace(/%(?![0-9a-f]{2})/gi, '%25')));
      if (!segments.length || segments[0].trim().toUpperCase() === 'A') return null;
      return segments[segments.length - 1].trim();
    }
  } catch { /* V2 continues with its non-URI fallback. */ }
  return raw.includes('/A/') ? null : raw;
}

/** @v2 _firstBarcodeValue */
export function firstWerkaBarcodeValue(barcodes: readonly { rawValue?: string | null; displayValue?: string | null }[]): string {
  for (const barcode of barcodes) {
    const raw = barcode.rawValue?.trim() ?? '';
    if (raw) return raw;
    const display = barcode.displayValue?.trim() ?? '';
    if (display) return display;
  }
  return '';
}

/** Read-only routing extracted from the V2 _handleCode and _resolveProductionQr methods. */
export async function resolveWerkaScannedCode(rawValue: string, resolvePreview: (code: string) => ReturnType<typeof werkaQrPreview>) {
  const archive = parseWerkaArchiveBatchQr(rawValue);
  if (archive) return { kind: 'archive' as const, payload: archive };
  const scannedBarcode = extractWerkaLookupBarcode(rawValue);
  if (!scannedBarcode) return { kind: 'invalid' as const };
  try {
    const preview = await resolvePreview(rawValue);
    return { kind: 'preview' as const, preview };
  } catch (error) {
    // Only the server's explicit unknown-QR response permits the legacy lookup.
    if (isApiError(error) && error.code === 'qr_not_found') return { kind: 'stock' as const, scannedBarcode, rawValue };
    throw error;
  }
}

/** @v2 _messageForError */
export function werkaScanErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Barcode tekshirishda xatolik.';
  switch (error.code) {
    case 'forbidden': return 'QR ma’lumotini ko‘rishga ruxsat yo‘q. Sizga ombor biriktirilganini tekshiring.';
    case 'qr_ambiguous': return 'QR bir nechta yozuvga mos keldi. Mas’ul xodimga murojaat qiling.';
    case 'progress_input_invalid': return 'QR kodi bo‘sh yoki noto‘g‘ri.';
    case 'qr_preview_failed': case 'qr_preview_invalid': return 'QR ma’lumotini olib bo‘lmadi. Qayta urinib ko‘ring.';
    case 'progress_batch_not_found': case 'progress_qr_invalid': return 'WIP topilmadi yoki QR kodi noto‘g‘ri.';
    case 'stock_entry_not_found': return 'Bu barcode bo‘yicha stock entry topilmadi.';
    case 'direct_db_lookup_unavailable': return 'Barcode lookup vaqtincha ishlamayapti.';
    case 'stock_entry_lookup_bad_request': return 'Barcode bo‘sh yoki noto‘g‘ri.';
    default: return error.message || 'Barcode tekshirishda xatolik.';
  }
}
