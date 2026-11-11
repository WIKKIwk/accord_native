import { returnedPaintAstatkaTotal } from './boyoqchi/returnedPaintModel';
import { returnedPaintDraftHasInvalidValues, returnedPaintFilledFieldCountForUsage,
  returnedPaintReportCanClose, type ReturnedPaintDraftData } from './boyoqchi/returnedPaintRules';
import { paintOptions, returnedPaintItemsFromDraft, workerPaintValue } from './workerOrderLogic';
export { workerPaintValueKey, workerPaintValue } from './workerOrderLogic';

type PaintValues = Record<string, string>;
type PaintFields = Record<string, string[]>;
export type WorkerReturnedPaintError = {
  key: 'worker.progress.qty.returned_paint_invalid' | 'worker.progress.qty.returned_paint_min' | 'worker.progress.qty.returned_paint_image';
  values?: { rasxot: number; astatka: number };
};

/** Preserves the source's raw draft independently from its filtered wire items. */
function workerPaintDraft(values: PaintValues, dynamic: PaintFields): ReturnedPaintDraftData {
  const states: ReturnedPaintDraftData = { values: {}, dynamic_field_labels: dynamic };
  for (const usage of ['rasxot', 'astatka']) {
    for (const option of paintOptions) {
      const collect = (name: string, base: readonly string[]) => {
        const key = `${usage}:${name}`, labels = [...base, ...(dynamic[key] ?? [])];
        states.values[key] = labels.map((label, index) => workerPaintValue(values, key, index, label));
      };
      collect(option.name, option.fields);
      if (option.name === 'Pantone') collect('Pantone Mix', []);
    }
  }
  return states;
}

/** @v2 returnedPaintReportCanClose */
export function workerReturnedPaintReport(values: PaintValues, dynamic: PaintFields, imageId: string) {
  const draft = workerPaintDraft(values, dynamic), items = returnedPaintItemsFromDraft(values, dynamic);
  const rasxotCount = returnedPaintFilledFieldCountForUsage(items, 'rasxot');
  const astatkaCount = returnedPaintFilledFieldCountForUsage(items, 'astatka');
  const rawReturnInkKg = returnedPaintAstatkaTotal(items);
  const returnInkKg = rawReturnInkKg !== null && Number.isFinite(rawReturnInkKg) && rawReturnInkKg > 0 ? rawReturnInkKg : null;
  let error: WorkerReturnedPaintError | null = null;
  if (returnedPaintDraftHasInvalidValues(draft)) error = { key: 'worker.progress.qty.returned_paint_invalid' };
  else if (!returnedPaintReportCanClose(items, imageId)) {
    error = rasxotCount + astatkaCount > 0
      ? { key: 'worker.progress.qty.returned_paint_min', values: { rasxot: rasxotCount, astatka: astatkaCount } }
      : { key: 'worker.progress.qty.returned_paint_image' };
  }
  return { items, rasxotCount, astatkaCount, rawReturnInkKg, returnInkKg, error };
}
