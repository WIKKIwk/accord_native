import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import type { RawSplitSessionTicket } from './rawSplitApi';
import { RawSplitController } from './rawSplitController';
import { RawSplitHistoryController } from './rawSplitHistoryController';
import { printRawSplitResult, printRawSplitRoll, rawSplitPrinterSupported } from './rawSplitPrintRuntime';

type Device = PreparationDeviceSelection;
/** Compose existing native printing with the independent V2 home and history state machines. */
export function createRawSplitRuntime(options: { ticket: RawSplitSessionTicket; canMutate: () => boolean; selectPrinter: () => Promise<Device | null>;
  onMessage: (message: string) => void; onIssueVisible: () => void; onUnsupportedPrinter: (printer: Device, wifiPrinter: string) => void }) {
  const common = { ticket: options.ticket, canMutate: options.canMutate, selectPrinter: options.selectPrinter, onMessage: options.onMessage,
    printerSupported: rawSplitPrinterSupported, onUnsupportedPrinter: options.onUnsupportedPrinter };
  const home = new RawSplitController({ ...common, onIssueVisible: options.onIssueVisible,
    print: (result, printer, wifiPrinter, guard) => printRawSplitResult(options.ticket, result, printer, wifiPrinter, guard) });
  const history = new RawSplitHistoryController({ ...common,
    printOne: (result, output, printer, wifiPrinter, guard) => printRawSplitRoll(options.ticket, result, output, printer, wifiPrinter, guard) });
  return { home, history, dispose: () => { home.dispose(); history.dispose(); } };
}
