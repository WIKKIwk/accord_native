type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value);

/** @v2 AdminRecordedRezkaFrame */
export type AdminRecordedRezkaFrame = { index: number; batch_id: string; qr_payload: string; input: Obj };

/** @v2 AdminRezkaOutputReport */
export type AdminRezkaOutputReport = { cycle_id: string; frames: AdminRecordedRezkaFrame[]; layout_outputs: Obj[];
  reference_frame_index: number | null; include_bobina_in_net: boolean | null; atomic_save_epoch: string; peremotka_supported: boolean };

export function rezkaReportFromJson(raw: unknown, atomicSaveEpoch = '', peremotkaSupported = false): AdminRezkaOutputReport | null {
  const value = object(raw);
  if (!value || typeof value.cycle_id !== 'string' || !value.cycle_id.trim() || !Array.isArray(value.frames)) return null;
  const frames: AdminRecordedRezkaFrame[] = [], indices = new Set<number>(), batches = new Set<string>();
  for (const item of value.frames) {
    const row = object(item), input = object(row?.input), index = row?.frame_index;
    if (!row || !input || !Number.isInteger(index)) return null;
    const batch = text(row.batch_id), qr = text(row.qr_payload), note = input.issue_note, reason = input.peremotka_reason;
    if ((note != null && typeof note !== 'string') || (reason != null && typeof reason !== 'string')) return null;
    const issue = typeof note === 'string' && !!note.trim(), peremotka = typeof reason === 'string' && !!reason.trim();
    if ((issue && peremotka) || index <= 0 || indices.has(index) ||
        (issue ? !!batch || !!qr : !batch || !qr || batches.has(batch))) return null;
    indices.add(index); if (!issue) batches.add(batch);
    frames.push({ index, batch_id: batch, qr_payload: qr, input: { ...input } });
  }
  const reference = value.reference_frame_index;
  if (reference != null && (!Number.isInteger(reference) || !frames.some(frame => frame.index === reference &&
      !text(frame.input.issue_note).trim() && !text(frame.input.peremotka_reason).trim()))) return null;
  return { cycle_id: value.cycle_id.trim(), frames, layout_outputs: Array.isArray(value.layout_outputs)
    ? value.layout_outputs.filter(object).map((item: Obj) => ({ ...item })) : [],
    reference_frame_index: reference ?? null, include_bobina_in_net: typeof value.include_bobina_in_net === 'boolean'
      ? value.include_bobina_in_net : null, atomic_save_epoch: atomicSaveEpoch,
    peremotka_supported: peremotkaSupported || value.peremotka_supported === true };
}

export function rezkaReportFromSession(raw: unknown): AdminRezkaOutputReport | null {
  const session = object(raw), payload = object(session?.payload_json);
  if (!session || !payload) return null;
  return rezkaReportFromJson({ cycle_id: payload.rezka_output_cycle ?? session.session_id, frames: payload.rezka_output_report ?? [],
    layout_outputs: payload.rezka_layout_outputs, reference_frame_index: payload.rezka_reference_frame_index });
}

export function rezkaFrameAt(report: AdminRezkaOutputReport, zeroBasedIndex: number): AdminRecordedRezkaFrame | null {
  return report.frames.find(frame => frame.index === zeroBasedIndex + 1) ?? null;
}

export function rezkaFrameIssueNote(frame: AdminRecordedRezkaFrame): string { return text(frame.input.issue_note).trim(); }
export function rezkaFramePeremotkaReason(frame: AdminRecordedRezkaFrame): string { return text(frame.input.peremotka_reason).trim(); }
