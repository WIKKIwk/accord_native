import { QolipPrinterPicker } from './QolipPrinterPicker';
import { useEffect, useRef } from 'react';
import { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import { pickPreparationPrinter, type PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { PrintService } from '../printing/printService';
import { UsbRpsPrintRequest } from '../printing/printModels';
import { qolipPrintCodeQr } from '../shared/printApi';
import type { QolipBlock } from './qolipBlocksApi';
import { qolipPrintCellQr, qolipPrintPaddonQr } from './qolipPrintApi';
import { useQolipRole } from './QolipRoleContext';
import { useQolipPresentation } from './useQolipPresentation';

/** Uses the existing one-shot native device picker and V2 printer probe; cancellation never sends a print. */
export function useQolipPrinting() {
  const role = useQolipRole(), sheet = useQolipPresentation();
  const mounted = useRef(true), requests = useRef(new Set<ReturnType<typeof createNativeTransientDevicePicker>>());
  useEffect(() => {
    mounted.current = true; const pending = requests.current;
    return () => { mounted.current = false; for (const request of pending) request.dispose(); pending.clear(); sheet.close(); };
  }, [role.boundary, sheet]);
  const current = () => mounted.current && role.isCurrent();
  const guard = () => { if (!current()) throw new Error('qolip_read_expired'); };
  const selectDevice = async (): Promise<PreparationDeviceSelection | null> => {
    if (!current()) return null;
    const request = createNativeTransientDevicePicker(current); requests.current.add(request);
    sheet.open(<QolipPrinterPicker operator={request.adapter} close={() => { request.onLeaving(); sheet.close(); }} />,
    { dismissible: true, fitContent: true, onDismiss: request.onDismiss });
    const selection = await request.result; requests.current.delete(request);
    if (!selection || !current()) return null;
    if (selection.transport === 'bluetooth') return { transport: 'bluetooth', printer: selection.bluetoothPrinter };
    if (selection.transport === 'offline') return { transport: 'offline', printer: selection.offlinePrinter };
    return { transport: 'wifi', serverBaseUrl: selection.server.endpoint.baseUrl,
      driverBaseUrl: selection.server.endpoint.baseUrl };
  };
  const pick = () => pickPreparationPrinter({ isCurrent: current, selectDevice });
  const local = async (job: UsbRpsPrintRequest, printer: NonNullable<Awaited<ReturnType<typeof pick>>>) => {
    if (!current()) return false;
    if (printer.transport === 'wifi') return true; // V2's API has already dispatched Wi-Fi printing.
    const result = await PrintService.printRps(job, printer.transport === 'bluetooth'
      ? { transport: 'bluetooth', bluetoothPrinter: printer.printer }
      : { transport: 'offline', printerProfile: printer.printer });
    if (!result.ok) throw new Error('Printer rejected label');
    return current();
  };
  const values = (printer: NonNullable<Awaited<ReturnType<typeof pick>>>) => {
    if (printer.transport === 'wifi') {
      if (!('printer' in printer)) throw new Error('Printer serveri tanlanmadi');
      if (printer.printer.toLowerCase() === 'godex') throw new Error('GoDEX is excluded');
      return { driverUrl: printer.driverBaseUrl ?? printer.serverBaseUrl, printer: printer.printer, printMode: printer.printMode };
    }
    if (printer.transport === 'offline' && printer.printer.kind !== 'zebra') throw new Error('GoDEX is excluded');
    return { driverUrl: '', printer: printer.printer.printer, printMode: printer.printer.printMode };
  };
  return {
    async printMolds(products: readonly { qolip_code: string; qolip_color?: string; customer_name?: string }[], options: { stopOnFailure?: boolean } = {}) {
      const printer = await pick(); if (!printer || !current()) return null;
      let success = 0, failed = 0;
      for (const product of products) {
        if (!current()) break;
        try {
          const result = await qolipPrintCodeQr(role.session, { qolipCode: product.qolip_code, ...values(printer),
            printTransport: printer.transport, customerName: product.customer_name, qolipColor: product.qolip_color }, guard);
          if (await local(UsbRpsPrintRequest.fromPrintJson(result.print_job), printer)) success++; else break;
        } catch (error) { if (!current()) break; if (options.stopOnFailure) throw error; failed++; }
      }
      return current() ? { success, failed } : null;
    },
    async printPaddon(code: string): Promise<boolean> {
      const printer = await pick(); if (!printer || !current()) return false;
      const job = await qolipPrintPaddonQr(role.session, { code, ...values(printer), transport: printer.transport }, current);
      return local(job, printer);
    },
    async printCell(block: QolipBlock, rowLetter: string, columnNumber: number): Promise<boolean> {
      const printer = await pick(); if (!printer || !current()) return false;
      const result = await qolipPrintCellQr(role.session, { block, rowLetter, columnNumber, ...values(printer), printTransport: printer.transport }, current);
      return local(result.printJob, printer);
    },
    async printMold(product: { qolip_code: string; qolip_color?: string; customer_name?: string }): Promise<boolean> {
      const printer = await pick(); if (!printer || !current()) return false;
      const result = await qolipPrintCodeQr(role.session, { qolipCode: product.qolip_code, ...values(printer),
        printTransport: printer.transport, customerName: product.customer_name, qolipColor: product.qolip_color }, guard);
      return local(UsbRpsPrintRequest.fromPrintJson(result.print_job), printer);
    },
  };
}
