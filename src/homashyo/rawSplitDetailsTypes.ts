import type { RawSplitIssue, RawSplitResult, RawSplitRoll } from './rawSplitModel';
export type RawSplitDetailsProps = {
  result: RawSplitResult; printerLabel: string | null; showWifiSelector: boolean; wifiPrinter: string;
  onSelectPrinter: () => void; onWifiChanged: (value: string) => void;
  onReprint: (output: RawSplitRoll) => Promise<void>; onReprintAll: () => Promise<void>; onError: (error: unknown) => void;
};
export type RawSplitIssueDetailsProps = { issue: RawSplitIssue; hasResult: boolean };
