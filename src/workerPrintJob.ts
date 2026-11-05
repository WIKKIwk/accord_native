import { isCanonicalApparatusId } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value);
function numeric(value: unknown, fallback: number | null = null): number | null {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid print quantity');
  return value;
}
function integer(value: unknown, fallback: number): number {
  const parsed = numeric(value, fallback)!;
  if (!Number.isFinite(parsed)) throw new TypeError('Invalid print integer');
  return Math.trunc(parsed);
}

export type WorkerPrintJob = { epc: string; item_code: string; item_name: string; order_code: string; apparatus: string;
  apparatus_display_name: string; warehouse: string; printer: string; print_mode: string; gross_qty: number; unit: string;
  tare_enabled: boolean; tare_kg: number; include_bobina_in_net: boolean; print_count: number; label_kind: string;
  executor_name: string; customer_name: string; manufacturer_name: string; qolip_color: string; progress_qty: number | null;
  progress_unit: string; completed_at_unix: number; paddon_label_lines: string[] };

export function printJobFromJson(raw: unknown, completedAtUnix = 0, paddonLabelLines: string[] = []): WorkerPrintJob {
  const json = object(raw);
  if (!json) throw new TypeError('Invalid print job');
  const executor = text(json.executor_name).trim(), apparatus = text(json.apparatus).trim();
  if (apparatus && !isCanonicalApparatusId(apparatus)) throw new TypeError('Canonical apparatus ID is required');
  const labelKind = text(json.label_kind), normalizedKind = labelKind.trim().toLowerCase();
  const gross = numeric(json.gross_qty) ?? numeric(json.qty) ?? 0;
  const progress = numeric(json.progress_qty) ?? (['progress', 'opening_wip'].includes(normalizedKind) ? numeric(json.qty) : null);
  return { epc: text(json.epc ?? json.qr_payload), item_code: text(json.item_code), item_name: text(json.item_name),
    order_code: text(json.order_code), apparatus, apparatus_display_name: text(json.apparatus_display_name).trim(),
    warehouse: json.warehouse == null ? (executor ? `Ijrochi: ${executor}` : 'ACCORD') : text(json.warehouse),
    printer: json.printer == null ? 'godex' : text(json.printer), print_mode: text(json.print_mode ?? json.mode ?? 'label'),
    gross_qty: gross, unit: json.unit == null ? 'kg' : text(json.unit), tare_enabled: json.tare_enabled === true || json.tare === true,
    tare_kg: numeric(json.tare_kg, 0)!, include_bobina_in_net: json.include_bobina_in_net === true,
    print_count: integer(json.print_count, 1), label_kind: labelKind, executor_name: executor, customer_name: text(json.customer_name),
    manufacturer_name: text(json.manufacturer_name).trim(), qolip_color: text(json.qolip_color), progress_qty: progress,
    progress_unit: text(json.progress_unit), completed_at_unix: completedAtUnix > 0 ? completedAtUnix : integer(json.completed_at_unix, 0),
    paddon_label_lines: normalizedKind === 'paddon_code' ? [...paddonLabelLines] : [] };
}

export function printJobToJson(job: WorkerPrintJob): Obj {
  const clean = (value: string, fallback: string) => value.trim() || fallback;
  const kind = job.label_kind.trim().toLowerCase(), progress = ['progress', 'opening_wip'].includes(kind);
  return { epc: clean(job.epc, 'RPS-USB-TEST').toUpperCase(), item_code: clean(job.item_code, 'USB-TEST'),
    item_name: clean(job.item_name, 'USB printer test'),
    ...(progress && job.order_code.trim() ? { order_code: job.order_code.trim() } : {}),
    ...(job.apparatus.trim() ? { apparatus: job.apparatus.trim() } : {}),
    ...(job.apparatus_display_name.trim() ? { apparatus_display_name: job.apparatus_display_name.trim() } : {}),
    warehouse: clean(job.warehouse, 'RPS USB TEST'), printer: clean(job.printer, 'godex').toLowerCase(),
    print_mode: clean(job.print_mode, 'label').toLowerCase(), gross_qty: Number.isFinite(job.gross_qty) && job.gross_qty > 0 ? job.gross_qty : 1,
    unit: clean(job.unit, 'kg').toLowerCase(), tare_enabled: job.tare_enabled || job.tare_kg > 0,
    tare_kg: Number.isFinite(job.tare_kg) && job.tare_kg > 0 ? job.tare_kg : 0,
    ...(job.include_bobina_in_net && progress ? { include_bobina_in_net: true } : {}),
    print_count: job.print_count > 1 ? job.print_count : 1, ...(kind ? { label_kind: kind } : {}),
    ...(job.executor_name.trim() ? { executor_name: job.executor_name.trim() } : {}),
    ...(job.customer_name.trim() ? { customer_name: job.customer_name.trim() } : {}),
    ...(job.manufacturer_name.trim() ? { manufacturer_name: job.manufacturer_name.trim() } : {}),
    ...(job.qolip_color.trim() ? { qolip_color: job.qolip_color.trim() } : {}),
    ...(job.progress_qty != null ? { progress_qty: job.progress_qty } : {}),
    ...(job.progress_unit.trim() ? { progress_unit: job.progress_unit.trim() } : {}),
    ...(progress && job.completed_at_unix > 0 ? { completed_at_unix: job.completed_at_unix } : {}) };
}
