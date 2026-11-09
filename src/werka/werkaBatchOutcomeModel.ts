import { localizedGetter, localizedMethod } from '../shared/localization';
import { werkaDartTrim } from './werkaBatchTrim';
import { werkaStockIssueDispatch } from './werkaStockIssueLogic';

type Issue = Parameters<typeof werkaStockIssueDispatch>[0];
type BatchResult = {
  created: readonly { record: Issue | null }[];
  failed: readonly { lineIndex: number }[];
};

/** Pure V2 description, not authoritative reconciliation. It never applies any side effect. */
export function werkaBatchOutcome(lines: readonly unknown[], result: BatchResult) {
  const failed = new Set(result.failed.map(entry => entry.lineIndex)), failedIndices: number[] = [];
  for (let index = 0; index < lines.length; index++) if (failed.has(index)) failedIndices.push(index);
  const activityCodes: string[] = [], pendingRecords = [];
  for (const entry of result.created) {
    const record = entry.record;
    if (record === null) continue;
    if (werkaDartTrim(record.itemCode)) activityCodes.push(record.itemCode);
    pendingRecords.push(werkaStockIssueDispatch(record));
  }
  return { sourceCreatedCount: result.created.length, sourceFailedIndices: failedIndices,
    sourceActivityCodes: activityCodes, sourcePendingRecords: pendingRecords,
    sourceBranch: failedIndices.length === 0 ? 'success' as const : 'partial' as const };
}

/** Source shows this dialog only when at least one original line failed. */
export function werkaBatchPartialResultLabels(createdCount: number, failedCount: number, locale: string) {
  if (!Number.isSafeInteger(createdCount) || createdCount < 0 || !Number.isSafeInteger(failedCount) || failedCount < 1) {
    throw new RangeError('Invalid batch result counts');
  }
  return { title: localizedGetter('batchSubmitResultTitle', locale),
    created: localizedMethod('batchCreatedCountLabel', locale, { count: createdCount }),
    failed: localizedMethod('batchFailedCountLabel', locale, { count: failedCount }),
    close: localizedGetter('closeAction', locale) };
}
