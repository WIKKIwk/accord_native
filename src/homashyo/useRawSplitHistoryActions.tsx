import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';
import { RawSplitIssueDetails } from './RawSplitDetails';
import { RawSplitResultBinding } from './RawSplitResultBinding';
import type { RawSplitIssue, RawSplitResult } from './rawSplitModel';

export function useRawSplitHistoryActions() {
  const { ticket, runtime } = useRawSplitContext(), sheet = useNativeSheet(), controller = runtime.history;
  const onError = (error: unknown) => { if (rawSplitSessionIsCurrent(ticket)) Alert.alert('Xatolik', String(error)); };
  const onResult = (result: RawSplitResult) => {
    if (!rawSplitSessionIsCurrent(ticket) || sheet.isOpen()) return;
    let chooseAfterDismiss = false;
    sheet.open(<RawSplitResultBinding controller={controller} result={result} onError={onError} onSelectPrinterAfterDismiss={() => {
      chooseAfterDismiss = true; sheet.close();
    }} />, { dismissible: true, onDismiss: () => {
      if (chooseAfterDismiss && rawSplitSessionIsCurrent(ticket)) void controller.selectPrinter().catch(onError);
    } });
  };
  const onIssue = (issue: RawSplitIssue, hasResult: boolean) => {
    if (!rawSplitSessionIsCurrent(ticket) || sheet.isOpen()) return;
    sheet.open(<RawSplitIssueDetails issue={issue} hasResult={hasResult} />, { dismissible: true });
  };
  return { controller, onResult, onIssue };
}
