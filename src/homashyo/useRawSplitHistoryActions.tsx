import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';
import { RawSplitIssueDetails } from './RawSplitDetails';
import { RawSplitResultBinding } from './RawSplitResultBinding';
import type { RawSplitIssue, RawSplitResult, RawSplitRoll } from './rawSplitModel';

export function useRawSplitHistoryActions() {
  const { ticket, runtime } = useRawSplitContext(), sheet = useNativeSheet(), controller = runtime.history;
  const onError = (error: unknown) => { if (rawSplitSessionIsCurrent(ticket)) Alert.alert('Xatolik', String(error)); };
  const onResult = (result: RawSplitResult) => {
    if (!rawSplitSessionIsCurrent(ticket) || sheet.isOpen()) return;
    let afterDismiss: { action: () => void; lease: () => boolean } | null = null;
    const defer = (action: () => void, lease: () => boolean) => { if (afterDismiss || !lease()) return; afterDismiss = { action, lease }; sheet.close(); };
    const reprint = async (output?: RawSplitRoll) => {
      if (!rawSplitSessionIsCurrent(ticket)) return;
      const lease = controller.capturePrinterLease(); if (!lease) return;
      if (controller.getSnapshot().printer) { await controller.reprint(result, output); return; }
      // A native sheet route sits above the role overlay. Remove it before opening the picker.
      defer(() => { void controller.reprint(result, output).catch(onError); }, lease);
    };
    sheet.open(<RawSplitResultBinding controller={controller} pendingController={runtime.home} result={result} onError={onError} onReprintRequest={reprint}
      onSelectPrinterAfterDismiss={() => { const lease = controller.capturePrinterLease(); if (lease) defer(() => { void controller.selectPrinter().catch(onError); }, lease); }} />,
    { dismissible: true, onDismiss: () => {
      const action = afterDismiss; afterDismiss = null;
      if (action && rawSplitSessionIsCurrent(ticket) && action.lease()) action.action();
    } });
  };
  const onIssue = (issue: RawSplitIssue, hasResult: boolean) => {
    if (!rawSplitSessionIsCurrent(ticket) || sheet.isOpen()) return;
    sheet.open(<RawSplitIssueDetails issue={issue} hasResult={hasResult} />, { dismissible: true });
  };
  return { controller, pendingController: runtime.home, isCurrent: () => rawSplitSessionIsCurrent(ticket), onResult, onIssue };
}
