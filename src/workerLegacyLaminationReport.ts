export type LegacyLaminationValues = { wip: string; film: string; waste: string };
const number = (value: string) => value.trim() ? Number(value.trim().replaceAll(',', '.')) : null;

/** @v2 _ProgressQtyDialogState._submit */
export function legacyLaminationReportMetrics(astatka: boolean, values: LegacyLaminationValues) {
  const wip = number(values.wip), film = number(values.film), waste = number(values.waste);
  if ([wip, film, waste].some(value => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error('worker.progress.qty.invalid_number');
  if (astatka ? wip === null || film === null || waste === null : !((wip ?? 0) > 0 || (film ?? 0) > 0) || !(waste !== null && waste > 0))
    throw new Error(astatka ? 'worker.daily.invalid_number' : 'worker.progress.qty.completion_reason');
  return { ...(wip !== null ? { lamination_print_leftover_rolls: wip } : {}), ...(film !== null ? { lamination_film_leftover_rolls: film } : {}), total_waste: waste };
}
