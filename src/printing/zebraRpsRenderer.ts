import { UsbRpsPrintRequest } from './printModels';

function normalizeEpc(value: string): string {
  let epc = value.trim().toUpperCase();
  if (epc.startsWith('0X')) epc = epc.substring(2);
  epc = epc.replace(/[\s-]/g, '');
  if (!epc || !/^[0-9A-F]+$/.test(epc)) throw new Error('Zebra EPC faqat hex bo‘lishi kerak');
  if (epc.length < 8 || epc.length > 64 || epc.length % 4 !== 0) throw new Error('Zebra EPC uzunligi 8..64 va 4 ga bo‘linishi kerak');
  return epc;
}
const sanitize = (value: string): string => value.replace(/[\r\n^~]/g, ' ').trim() || '-';
function rounded(value: number): string {
  const round = Math.sign(value) * Math.round(Math.abs(value * 10));
  return round % 10 === 0 ? String(round / 10) : (round / 10).toFixed(1);
}

/** @v2 ZebraRpsRenderer */
export class ZebraRpsRenderer {
  static render(request: UsbRpsPrintRequest): Uint8Array {
    let zpl: string;
    if (request.isQolipCellLabel) {
      const payload = sanitize(request.epc);
      const cellName = sanitize(request.itemName.trim() ? request.itemName : request.itemCode);
      zpl = `~PS\n^XA\n^LH0,0\n^FO8,16^A0N,88,76^FB784,1,0,C,0\n^FD${cellName}^FS\n` +
        `^FO120,124^BQN,2,11^FDLA,${payload}^FS\n^PQ1\n^XZ\n`;
    } else if (request.isQolipCodeLabel || request.isPaddonCodeLabel || request.isMaterialProductLabel) {
      const payload = request.isMaterialProductLabel ? normalizeEpc(request.epc) : sanitize(request.epc);
      const name = sanitize(request.isMaterialProductLabel ? request.materialProductLabelTitle :
        request.itemName.trim() ? request.itemName : request.itemCode);
      const footer = sanitize(request.largeQrLabelFooter(payload));
      const footerFont = footer.length > 43 ? '^A0N,14,12' : '^A0N,18,16';
      const rfid = request.isMaterialProductLabel && request.printMode.trim().toLowerCase() === 'rfid'
        ? `^RS8,,,1,N\n^RFW,H,,,A^FD${payload}^FS\n` : '';
      zpl = `~PS\n^XA\n^LH0,0\n${rfid}^FO8,2^A0N,24,20^FB784,2,28,C,0\n^FD${name}^FS\n` +
        `^FO120,56^BQN,2,11^FDLA,${payload}^FS\n^FO8,352${footerFont}^FB784,1,0,C,0\n^FD${footer}^FS\n^PQ1\n^XZ\n`;
    } else {
      const epc = normalizeEpc(request.epc);
      const unit = request.unit.trim() || 'kg';
      const item = sanitize(request.itemName.trim() ? request.itemName : request.itemCode);
      const netOnly = request.netIncludesBobina;
      const hasTare = !netOnly && request.tareEnabled && request.tareKg > 0;
      const net = `${rounded(request.netQty)} ${unit}`;
      const gross = `${rounded(request.grossQty)} ${unit}`;
      const weight = hasTare ? `^FO8,112^A0N,36,32\n^FDNETTO: ${net}^FS\n^FO8,158^A0N,36,32\n^FDBRUTTO: ${gross}^FS\n`
        : `^FO8,118^A0N,44,38\n^FD${netOnly ? 'NETTO' : 'VAZNI'}: ${gross}^FS\n`;
      const rfid = request.printMode.trim().toLowerCase() === 'rfid' ? `^RS8,,,1,N\n^RFW,H,,,A^FD${epc}^FS\n` : '^MMT\n';
      zpl = `~PS\n^XA\n^LH0,0\n${rfid}^FO8,52^A0N,38,32^FB760,1,0,L,0\n^FDMAHSULOT: ${item}^FS\n${weight}` +
        `^FO8,${hasTare ? 220 : 184}^A0N,24,20^FB760,1,0,L,0\n^FDEPC: ${epc}^FS\n` +
        `^FO8,${hasTare ? 272 : 236}^BY3,2,44^BCN,44,N,N,N\n^FD${epc}^FS\n^PQ1\n^XZ\n`;
    }
    return new TextEncoder().encode(zpl);
  }
  static renderRepeated(request: UsbRpsPrintRequest): Uint8Array {
    const label = this.render(request);
    const count = request.printCount > 0 ? request.printCount : 1;
    const bytes = new Uint8Array(label.length * count);
    for (let i = 0; i < count; i++) bytes.set(label, i * label.length);
    return bytes;
  }
}
