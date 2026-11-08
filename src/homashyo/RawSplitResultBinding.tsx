import { useSyncExternalStore } from 'react';
import { RawSplitDetails } from './RawSplitDetails';
import type { RawSplitHistoryController } from './rawSplitHistoryController';
import type { RawSplitResult, RawSplitRoll } from './rawSplitModel';

/** Native sheet owner must dismiss the result sheet before opening the existing printer picker. */
export function RawSplitResultBinding({ controller, result, onSelectPrinterAfterDismiss, onError, onReprintRequest }: {
  controller: RawSplitHistoryController; result: RawSplitResult; onSelectPrinterAfterDismiss(): void; onError(error: unknown): void;
  onReprintRequest?: (output?: RawSplitRoll) => Promise<void>;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <RawSplitDetails result={result} printerLabel={state.printer?.transport ?? null} showWifiSelector={state.printer?.transport === 'wifi'}
    wifiPrinter={state.wifiPrinter} onSelectPrinter={onSelectPrinterAfterDismiss} onWifiChanged={value => controller.setWifiPrinter(value)}
    onReprint={output => onReprintRequest ? onReprintRequest(output) : controller.reprint(result, output)}
    onReprintAll={() => onReprintRequest ? onReprintRequest() : controller.reprint(result)} onError={onError} />;
}
