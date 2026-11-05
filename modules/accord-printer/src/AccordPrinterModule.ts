import { NativeModule, requireOptionalNativeModule } from 'expo';

export type PrinterMap = Record<string, unknown>;
type PrinterEvents = { onDiscovery: (event: PrinterMap) => void };

declare class NativeAccordPrinter extends NativeModule<PrinterEvents> {
  pairedPrinters(): Promise<unknown>;
  printLabel(arguments_: PrinterMap): Promise<unknown>;
  startDiscovery?(session: number): Promise<void>;
  stopDiscovery?(session: number): Promise<void>;
  printTest?(arguments_: PrinterMap): Promise<unknown>;
  detectPrinter?(): Promise<unknown>;
  printRaw?(arguments_: PrinterMap): Promise<unknown>;
}

export class PrinterChannelError extends Error {
  constructor(readonly code: string, message: string, readonly details: unknown) {
    super(message);
    this.name = 'PrinterChannelError';
  }
}

function nativeModule(): NativeAccordPrinter {
  const module = requireOptionalNativeModule<NativeAccordPrinter>('AccordPrinter');
  if (!module) throw new PrinterChannelError('printer_module_unavailable', 'Accord printer requires a development build', null);
  return module;
}

function result(value: unknown): unknown {
  if (value && typeof value === 'object' && (value as PrinterMap).__accord_error__ === true) {
    const error = value as PrinterMap;
    throw new PrinterChannelError(String(error.code ?? ''), String(error.message ?? ''), error.details ?? null);
  }
  return value;
}

async function call(method: 'pairedPrinters' | 'detectPrinter', args?: undefined): Promise<unknown>;
async function call(method: 'printLabel' | 'printTest' | 'printRaw', args: PrinterMap): Promise<unknown>;
async function call(method: string, args?: PrinterMap): Promise<unknown> {
  const module = nativeModule();
  const func = (module as unknown as Record<string, unknown>)[method];
  if (typeof func !== 'function') throw new PrinterChannelError('not_implemented', 'Printer method is not implemented', null);
  return result(await (args === undefined ? func.call(module) : func.call(module, args)));
}

export const AccordPrinter = {
  pairedPrinters: () => call('pairedPrinters'),
  printLabel: (args: PrinterMap) => call('printLabel', args),
  detectPrinter: () => call('detectPrinter'),
  printTest: (args: PrinterMap) => call('printTest', args),
  printRaw: (args: PrinterMap) => call('printRaw', args),
  async startDiscovery(session: number, listener: (event: PrinterMap) => void): Promise<() => void> {
    const module = nativeModule();
    if (!module.startDiscovery || !module.stopDiscovery) {
      throw new PrinterChannelError('not_implemented', 'Printer discovery is not implemented on this platform', null);
    }
    const subscription = module.addListener('onDiscovery', event => {
      if (event._session !== session) return;
      const { _session, ...payload } = event;
      listener(payload);
    });
    try { await module.startDiscovery(session); }
    catch (error) { subscription.remove(); throw error; }
    return () => { subscription.remove(); void module.stopDiscovery?.(session); };
  },
};
