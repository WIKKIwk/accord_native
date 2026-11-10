/** @v2 _ProgressQtyDialogState._submit */
export function workerCompletionMode(input: { action: string; orderId: string; closingOutputId: string;
  safeStopRequest: string | null; description: string; kg: string; meter: string; bobina: string; waste: string }) {
  const note = input.description.trim();
  const hasRawOutput = [input.kg, input.meter, input.bobina, input.waste].some(value => value.trim());
  const safeStop = input.action === 'pause' && !!input.safeStopRequest;
  const safeStopIssue = safeStop && !hasRawOutput && !!note;
  const completionIssue = input.action === 'complete' && !input.closingOutputId && !!note && !input.orderId.startsWith('training-');
  return { note, safeStopIssue, completionIssue, needsIssueOrOutput: safeStop && !hasRawOutput && !note,
    needsOutput: !safeStopIssue && !completionIssue && (input.action === 'pause' || input.action === 'roll_complete' || (input.action === 'complete' && !input.closingOutputId)) };
}
