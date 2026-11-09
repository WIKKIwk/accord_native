import { useSyncExternalStore } from 'react';
import { RawSplitDetails } from './RawSplitDetails';
import type { RawSplitController } from './rawSplitController';
import type { RawSplitHistoryController } from './rawSplitHistoryController';
import type { RawSplitResult, RawSplitRoll } from './rawSplitModel';

/** Native sheet owner must dismiss the result sheet before opening the existing printer picker. */
export function RawSplitResultBinding({ controller, pendingController, result, onSelectPrinterAfterDismiss, onError, onReprintRequest }: {
  controller: RawSplitHistoryController; pendingController: RawSplitController; result: RawSplitResult; onSelectPrinterAfterDismiss(): void; onError(error: unknown): void;
  onReprintRequest?: (output?: RawSplitRoll) => Promise<void>;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useSyncExternalStore(pendingController.subscribe, pendingController.getSnapshot, pendingController.getSnapshot);
  const printBlocked = !controller.capturePrinterLease();
  return <RawSplitDetails result={result} printerLabel={state.printer?.transport ?? null} showWifiSelector={state.printer?.transport === 'wifi'}
    printBlocked={printBlocked} wifiPrinter={state.wifiPrinter} onSelectPrinter={onSelectPrinterAfterDismiss} onWifiChanged={value => controller.setWifiPrinter(value)}
    onReprint={output => onReprintRequest ? onReprintRequest(output) : controller.reprint(result, output)}
    onReprintAll={() => onReprintRequest ? onReprintRequest() : controller.reprint(result)} onError={onError} />;
}
