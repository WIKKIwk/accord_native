import type { Session } from './auth';
import type { DailyWorkBatch } from './dailyWork';
import type { ProgressBatchCorrectionInput } from './productionProgressCorrectionApi';

const metrics = ['return_ink_kg', 'lamination_print_leftover_rolls', 'lamination_film_leftover_rolls', 'rezka_bosma_waste',
  'rezka_lamination_waste', 'rezka_edge_waste', 'total_waste', 'finished_goods_kg', 'bobina_kg', 'diameter'] as const;
type Metric = typeof metrics[number];
export type CorrectionValues = Record<Metric | 'meter' | 'description', string>;
export type CorrectionField = { key: Metric | 'meter'; label: string; unit: string; required: boolean };
type Message = { key: string; values?: Record<string, unknown> };
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const parse = (value: string) => value.trim() ? amount(Number(value.trim().replaceAll(',', '.'))) : null;
const weightUnits = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e12 ? Math.round(value * 1e6) : null;

/** @v2 _canCorrectWip */
export function canCorrectDailyWip(session: Session, batch: DailyWorkBatch): boolean {
  return String(batch.source.wip_status ?? '').trim().toLowerCase() === 'waiting' &&
    (session.profile.role !== 'rezka_master' || String(batch.source.worker_ref ?? '').trim() === String(session.profile.ref ?? '').trim());
}

/** @v2 _DailyWorkWipEditDialogState */
export function dailyWipCorrectionFields(batch: DailyWorkBatch, operation: string): CorrectionField[] {
  const op = operation.trim().toLowerCase(), row = batch.source;
  const standard = ['print', 'laminate', 'glue', 'cut'].includes(op);
  const fields: CorrectionField[] = [{ key: 'meter', label: standard ? 'length' : 'quantity', unit: batch.unit.trim() || 'm', required: true }];
  const add = (key: Metric, label: string, unit: string, required = true) => fields.push({ key, label, unit, required });
  if (standard) {
    add('finished_goods_kg', 'weight', 'kg');
    if (op !== 'cut' || (row.payload_json as Record<string, unknown> | undefined)?.include_bobina_in_net !== true) add('bobina_kg', 'roll', 'kg');
  }
  if (op === 'cut') add('diameter', 'diameter', 'mm');
  if (op === 'print' && row.return_ink_kg != null) add('return_ink_kg', 'returned_ink', 'kg');
  if (op === 'laminate' || op === 'glue') {
    if (row.lamination_print_leftover_rolls != null) add('lamination_print_leftover_rolls', 'print_leftover', 'ta');
    if (row.lamination_film_leftover_rolls != null) add('lamination_film_leftover_rolls', 'film_leftover', 'ta');
  }
  if (row.total_waste != null) add('total_waste', 'total_waste', 'kg');
  if (op === 'cut' && ['total_waste', 'rezka_bosma_waste', 'rezka_lamination_waste', 'rezka_edge_waste'].some(key => row[key] != null)) {
    add('rezka_bosma_waste', 'print_waste', 'kg', false); add('rezka_lamination_waste', 'lamination_waste', 'kg', false); add('rezka_edge_waste', 'edge_waste', 'kg', false);
  }
  return fields;
}

export function dailyWipCorrectionValues(batch: DailyWorkBatch): CorrectionValues {
  const numberText = (value: unknown) => amount(value)?.toString() ?? '';
  return { ...Object.fromEntries(metrics.map(key => [key, numberText(batch.source[key])])),
    meter: numberText(batch.source.finished_goods_meter ?? batch.source.produced_qty), description: String(batch.source.description ?? '') } as CorrectionValues;
}

/** @v2 correctedRollGrossKg */
export function correctedDailyGross(previousKg: unknown, nextKg: number | null, previousGross: unknown): number | null {
  if (weightUnits(previousKg) !== weightUnits(nextKg) || previousGross == null) return nextKg;
  return amount(previousGross);
}

export function dailyWipCorrectionError(batch: DailyWorkBatch, fields: readonly CorrectionField[], values: CorrectionValues): { field: string; message: Message } | null {
  for (const field of fields) {
    const input = values[field.key].trim(), value = parse(input);
    if (!input && field.required) return { field: field.key, message: { key: 'worker.daily.required_field', values: { label: `worker.daily.field.${field.label}` } } };
    if (input && (value === null || value <= 0)) return { field: field.key, message: { key: 'worker.daily.positive_number' } };
    if (field.key === 'bobina_kg') {
      const payload = batch.source.payload_json as Record<string, unknown> | undefined;
      const gross = weightUnits(correctedDailyGross(batch.source.finished_goods_kg, parse(values.finished_goods_kg), payload?.gross_qty));
      const core = weightUnits(value);
      if (gross != null && gross > 0 && core != null && core > gross) return { field: field.key, message: { key: 'worker.progress.qty.bobina_exceeds_gross' } };
    }
  }
  return null;
}

export function dailyWipCorrectionInput(batch: DailyWorkBatch, values: CorrectionValues, reason: string): ProgressBatchCorrectionInput {
  return { ...Object.fromEntries(metrics.map(key => [key, parse(values[key])])), batch_id: batch.id,
    expected_revision: Number(batch.source.revision ?? 1), produced_qty: parse(values.meter)!, uom: batch.unit.trim() || 'm',
    finished_goods_meter: parse(values.meter), description: values.description.trim(), reason: reason.trim() };
}

type Edit = { batch: DailyWorkBatch; fields: CorrectionField[]; values: CorrectionValues; step: 'edit' | 'reason' | 'saving'; reason: string; error: Message | null };
type State = { edit: Edit | null; notice: string };
type Dependencies = { current(): boolean; canEdit(batch: DailyWorkBatch): boolean; latest(id: string): DailyWorkBatch | undefined;
  operation(batch: DailyWorkBatch): string; save(input: ProgressBatchCorrectionInput, current: () => boolean): Promise<Record<string, unknown>>;
  replace(batch: Record<string, unknown>): void; reconcile(): void };

/** @v2 _AparatchiDailyWorkScreenState._editWip */
export class DailyWorkCorrectionController {
  private state: State = { edit: null, notice: '' };
  private listeners = new Set<() => void>();
  private retired = false;
  private generation = 0;
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private set(state: State) { this.state = state; for (const listener of this.listeners) listener(); }
  current = () => !this.retired && this.deps.current();
  invalidate() { this.retired = true; this.generation++; this.set({ edit: null, notice: '' }); }
  dismissNotice = () => this.set({ ...this.state, notice: '' });
  open = (batch: DailyWorkBatch) => {
    if (!this.current() || this.state.edit?.step === 'saving') return;
    const latest = this.deps.latest(batch.id);
    if (!latest || !this.deps.canEdit(latest)) return;
    this.set({ notice: '', edit: { batch: latest, fields: dailyWipCorrectionFields(latest, this.deps.operation(latest)),
      values: dailyWipCorrectionValues(latest), step: 'edit', reason: '', error: null } });
  };
  change = (key: keyof CorrectionValues, value: string) => {
    const edit = this.state.edit;
    if (edit?.step !== 'edit' || !this.current()) return;
    this.set({ ...this.state, edit: { ...edit, error: null, values: { ...edit.values, [key]: key === 'description' ? value : value.replace(/[^0-9.,]/g, '') } } });
  };
  reason = (reason: string) => { const edit = this.state.edit; if (edit?.step === 'reason' && this.current()) this.set({ ...this.state, edit: { ...edit, reason, error: null } }); };
  cancel = () => { if (this.state.edit?.step !== 'saving') this.set({ ...this.state, edit: null }); };
  next = () => {
    const edit = this.state.edit;
    if (edit?.step !== 'edit' || !this.current()) return;
    const error = dailyWipCorrectionError(edit.batch, edit.fields, edit.values);
    this.set({ ...this.state, edit: { ...edit, step: error ? 'edit' : 'reason', error: error?.message ?? null } });
  };
  confirm = async () => {
    const edit = this.state.edit;
    if (edit?.step !== 'reason' || !this.current()) return;
    if (!edit.reason.trim()) { this.set({ ...this.state, edit: { ...edit, error: { key: 'worker.daily.correction.required' } } }); return; }
    const generation = ++this.generation;
    const current = () => this.current() && generation === this.generation && this.deps.canEdit(edit.batch) && (() => {
      const latest = this.deps.latest(edit.batch.id);
      return !!latest && this.deps.canEdit(latest) && Number(latest.source.revision ?? 1) === Number(edit.batch.source.revision ?? 1);
    })();
    if (!current()) { this.set({ edit: null, notice: 'worker.daily.correction_failed' }); return; }
    this.set({ notice: '', edit: { ...edit, step: 'saving' } });
    try {
      const corrected = await this.deps.save(dailyWipCorrectionInput(edit.batch, edit.values, edit.reason), current);
      if (!this.current() || generation !== this.generation) return;
      this.deps.replace(corrected);
      this.set({ edit: null, notice: 'worker.daily.wip_updated' });
    } catch {
      if (!this.current() || generation !== this.generation) return;
      this.set({ edit: null, notice: 'worker.daily.correction_failed' }); this.deps.reconcile();
    }
  };
}
