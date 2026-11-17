import qrFactory from 'qrcode-generator';
Object.assign(qrFactory, { stringToBytes: (text: string) => Array.from(new TextEncoder().encode(text)) });
export function qolipStorageQr(payload: string): string {
  const qr = qrFactory(0, 'M'); qr.addData(payload); qr.make(); return qr.createDataURL(5, 20);
}
export type QolipStorageQrDialogProps = { code: string; paddon?: boolean; close(): void };
