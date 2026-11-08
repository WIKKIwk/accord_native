import type { RawSplitIssue, RawSplitResult } from './rawSplitModel';
import type { RawSplitHistoryController } from './rawSplitHistoryController';
export type RawSplitHistoryViewProps = { controller: RawSplitHistoryController;
  onResult: (result: RawSplitResult) => void; onIssue: (issue: RawSplitIssue, hasResult: boolean) => void };
