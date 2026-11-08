import { werkaBatchTrim } from './werkaBatchTrim';

export type CustomerDirectoryEntry = { ref: string; name: string; phone: string };
export type CustomerItemOption = { customerRef: string; customerName: string; customerPhone: string;
  itemCode: string; itemName: string; uom: string; warehouse: string };

export type WerkaArchiveBatchQrPayload = {
  sessionID: string; itemName: string; qtyText: string; qty: number; bruttoText: string;
  bruttoQty: number; nettoText: string; nettoQty: number; batchTime: string; rawValue: string;
};

function archiveEncodedPayload(raw: string): string | null {
  try {
    const uri = new URL(raw);
    if (uri.protocol === 'http:' || uri.protocol === 'https:') {
      const segments = uri.pathname.split('/').map(decodeURIComponent).filter(segment => werkaBatchTrim(segment));
      if (segments.length >= 2 && segments[0].toUpperCase() === 'A') return werkaBatchTrim(segments[1]);
    }
  } catch { /* The V2 fallback also accepts a non-URL containing /A/. */ }
  const marker = raw.indexOf('/A/');
  return marker < 0 ? null : werkaBatchTrim(raw.slice(marker + 3).split('/')[0]);
}

function decodeBase64Url(encoded: string): string | null {
  try {
    // Dart's base64Url.normalize accepts percent escapes, either alphabet and omitted padding.
    const value = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
    const unpadded = value.replace(/=+$/, '');
    if (unpadded.length % 4 === 1 || (value.includes('=') && value.length % 4 !== 0)) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    let bits = 0, bitCount = 0;
    for (const char of unpadded) {
      bits = (bits << 6) | alphabet.indexOf(char);
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        bytes.push((bits >> bitCount) & 255);
        bits &= (1 << bitCount) - 1;
      }
    }
    // Dart rejects a nonzero unused tail even when it decodes to the same bytes.
    if (bits !== 0) return null;
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch { return null; }
}

function parseQty(value: string): number {
  const normalized = werkaBatchTrim(value).replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  // Dart double.tryParse requires the entire value to be numeric.
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  return Number(normalized);
}

/** @v2 WerkaArchiveBatchQrPayload */
export function parseWerkaArchiveBatchQr(rawValue: string): WerkaArchiveBatchQrPayload | null {
  const raw = werkaBatchTrim(rawValue);
  if (!raw) return null;
  const encoded = archiveEncodedPayload(raw);
  if (!encoded) return null;
  const decoded = decodeBase64Url(encoded);
  if (decoded == null) return null;
  const lines = decoded.split('\n').map(werkaBatchTrim);
  if (lines.length < 5 || lines[0].toUpperCase() !== 'ARCHIVE') return null;
  const separated = lines.length >= 6, bruttoText = lines[3], nettoText = separated ? lines[4] : lines[3];
  const qty = parseQty(nettoText), brutto = parseQty(bruttoText), netto = parseQty(nettoText);
  if (qty <= 0) return null;
  return { sessionID: lines[1], itemName: lines[2], qtyText: nettoText, qty, bruttoText,
    bruttoQty: brutto > 0 ? brutto : qty, nettoText, nettoQty: netto > 0 ? netto : qty,
    batchTime: separated ? lines[5] : lines[4], rawValue: raw };
}

/** @v2 resolveExactArchiveBatchItemOption */
export function resolveExactArchiveBatchItemOption(itemName: string, options: readonly CustomerItemOption[]): CustomerItemOption | null {
  const normalized = werkaBatchTrim(itemName).toLowerCase();
  if (!normalized) return null;
  return options.find(option => werkaBatchTrim(option.itemName).toLowerCase() === normalized ||
    werkaBatchTrim(option.itemCode).toLowerCase() === normalized) ?? null;
}

/** @v2 archiveBatchCustomerFromOption */
export function archiveBatchCustomerFromOption(option: CustomerItemOption): CustomerDirectoryEntry {
  return { ref: option.customerRef, name: option.customerName, phone: option.customerPhone };
}

/** @v2 resolveArchiveBatchDefaultCustomer */
export function resolveArchiveBatchDefaultCustomer(option: CustomerItemOption, customers: readonly CustomerDirectoryEntry[]): CustomerDirectoryEntry {
  const eligible = customers.filter(customer => werkaBatchTrim(customer.ref));
  return preferWerkaPrimaryCustomer(eligible) ?? archiveBatchCustomerFromOption(option);
}

/** @v2 preferPrimaryCustomer */
export function preferWerkaPrimaryCustomer(customers: readonly CustomerDirectoryEntry[]): CustomerDirectoryEntry | null {
  return customers.find(customer => werkaBatchTrim(customer.name).toLowerCase() !== 'saidamin') ?? customers[0] ?? null;
}
