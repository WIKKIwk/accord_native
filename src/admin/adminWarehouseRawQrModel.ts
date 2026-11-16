import qrFactory from 'qrcode-generator';
import { dartTrim } from './dartJsonString';

/** Source preview sanitizes and uppercases the encoded payload; the visible barcode stays untouched. */
export function adminWarehouseRawQrPayload(value: string): string {
  return dartTrim(value.replace(/[\r\n^~]/g, ' ')).split(/\s+/u).filter(Boolean).join(' ').toUpperCase();
}
export function adminWarehouseRawQrPreview(value: string) {
  const payload = adminWarehouseRawQrPayload(value); if (!payload) throw new Error('qr payload is empty');
  const mode = /^\d+$/.test(payload) ? 'Numeric' : /^[0-9A-Z $%*+\-./:]+$/.test(payload) ? 'Alphanumeric' : 'Byte';
  const make = (version: number, level: 'L' | 'M' | 'Q' | 'H') => {
    const code = qrFactory(version as Parameters<typeof qrFactory>[0], level);
    if (mode === 'Byte') {
      // addData captures bytes synchronously. Restore the shared encoder before make or any caller can run.
      const encoder: Pick<typeof qrFactory, 'stringToBytes'> = qrFactory, previous = encoder.stringToBytes;
      try { encoder.stringToBytes = text => Array.from(new TextEncoder().encode(text)); code.addData(payload, 'Byte'); }
      finally { encoder.stringToBytes = previous; }
    } else code.addData(payload, mode);
    code.make(); return code;
  };
  let code = make(0, 'L'); const version = (code.getModuleCount() - 17) / 4;
  for (const level of ['M', 'Q', 'H'] as const) { try { code = make(version, level); } catch { /* Source boosts ECC only while the selected version still fits. */ } }
  const modules = code.getModuleCount(), cell = Math.floor(208 / (modules + 8)); if (cell < 1) throw new Error('qr data too long');
  return { payload, modules, cell, drawnSize: cell * (modules + 8), uri: code.createDataURL(cell, cell * 4) };
}
