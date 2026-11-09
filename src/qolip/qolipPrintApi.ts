import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { UsbRpsPrintRequest } from '../printing/printModels';
import { isLocalPrintTransport, printTransportClientApiValue, type PrintTransport } from '../printing/printTransport';
import { dartString, jsonObject, trimDart } from './qolipApiCommon';
import type { QolipBlock } from './qolipBlocksApi';
import { qolipCellQrFromJson, type QolipCellQr } from './qolipQrApi';
import { storageRequest } from './qolipStorageApi';

type JsonObject = Record<string, unknown>;
/** @v2 QolipCellQrPrintResult */
export type QolipCellQrPrintResult = { cellQr: QolipCellQr; printJob: UsbRpsPrintRequest };

function requiredObject(value: unknown): JsonObject {
  const data = jsonObject(value);
  if (!data) throw new TypeError('Expected JSON object');
  return data;
}

function cellLabel(cell: QolipCellQr): string {
  const row = trimDart(cell.row_letter).toUpperCase();
  return row && cell.column_number > 0 ? `${row}${cell.column_number}` : trimDart(cell.location_label);
}

function cellPrintJob(cell: QolipCellQr): UsbRpsPrintRequest {
  return new UsbRpsPrintRequest({ epc: cell.qr_payload, itemCode: cell.qr_payload, itemName: cellLabel(cell),
    warehouse: cell.warehouse, printer: 'godex', printMode: 'label', grossQty: 1, unit: 'dona',
    labelKind: 'qolip_cell', progressQty: 1, progressUnit: 'dona' });
}

/** @v2 qolipPrintCellQr */
export async function qolipPrintCellQr(session: Session, input: { block: QolipBlock; rowLetter: string;
  columnNumber: number; driverUrl: string; printer?: string; printMode?: string;
  printTransport?: PrintTransport }): Promise<QolipCellQrPrintResult> {
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  const printer = trimDart(input.printer ?? ''), mode = trimDart(input.printMode ?? '');
  const transport = input.printTransport ?? 'wifi';
  const response = await authorizedFetch(session, '/v1/mobile/qolip/cell-qr/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block: trimDart(input.block.name), warehouse: trimDart(input.block.warehouse),
      row_letter: trimDart(input.rowLetter).toUpperCase(), column_number: input.columnNumber,
      driver_url: trimDart(input.driverUrl).replace(/\/+$/, ''), ...(printer ? { printer } : {}),
      ...(mode ? { print_mode: mode } : {}),
      ...(isLocalPrintTransport(transport) ? { print_transport: printTransportClientApiValue(transport) } : {}) }),
  });
  if (response.status !== 200) throw new Error('Qolip cell QR print failed');
  const data = requiredObject(await response.json()), cellQr = qolipCellQrFromJson(data.cell_qr);
  const printJob = data.print == null ? cellPrintJob(cellQr)
    : UsbRpsPrintRequest.fromPrintJson(requiredObject(data.print)).forQolipCell(cellLabel(cellQr));
  return { cellQr, printJob };
}

function paddonBluetoothLines(code: string, rawPaddon: unknown): string[] {
  const paddon = jsonObject(rawPaddon), rawCode = paddon?.code;
  const responseCode = rawCode == null ? null : trimDart(dartString(rawCode)).toUpperCase();
  if (responseCode && responseCode !== code) throw new TypeError('Mold pallet summary identity changed');
  const count = responseCode === code ? paddon?.item_count : null;
  const countText = typeof count === 'number' && Number.isFinite(count) && count >= 0 && Number.isInteger(count)
    ? String(count) : '—';
  return [`Qolip paddoni: ${code}`, `Qoliplar soni: ${countText}`];
}

/** @v2 qolipPrintPaddonQr */
export async function qolipPrintPaddonQr(session: Session, input: { code: string; driverUrl: string;
  printer?: string; printMode?: string; transport?: PrintTransport }): Promise<UsbRpsPrintRequest> {
  const code = trimDart(input.code).toUpperCase(), transport = input.transport ?? 'wifi';
  const response = await storageRequest(session, 'paddons/qr/print', {}, {
    qolip_code: code, driver_url: trimDart(input.driverUrl).replace(/\/+$/, ''),
    printer: input.printer ?? '', print_mode: input.printMode ?? '', print_count: 1,
    ...(isLocalPrintTransport(transport) ? { print_transport: printTransportClientApiValue(transport) } : {}),
  });
  if (response.qr_payload !== `qolip-paddon:${code}` || !jsonObject(response.print)) {
    throw new TypeError('Invalid mold pallet print response');
  }
  const job = UsbRpsPrintRequest.fromPrintJson(requiredObject(response.print), {
    paddonLabelLines: transport === 'bluetooth' ? paddonBluetoothLines(code, response.paddon) : [],
  });
  if (job.epc !== `qolip-paddon:${code}` || !job.isPaddonCodeLabel) {
    throw new TypeError('Mold pallet print identity changed');
  }
  return job;
}
