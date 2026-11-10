import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { paddonFromJson } from './paddonModels';
import { printJobFromJson } from './workerPrintJob';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value);
const weight = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function paddonBluetoothLabelLines(paddon: Obj, rawItems: unknown): string[] {
  const rawCount = paddon.item_count;
  const count = typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 0 ? String(rawCount) : '—';
  const formatWeight = (value: unknown): string => {
    const n = weight(value); return n == null ? '—' : n.toFixed(6).replace(/\.?0+$/, '');
  };
  const items = Array.isArray(rawItems) && rawItems.every(item => object(item)) ? rawItems as Obj[] : null;
  let bobinaCount = count === '0' ? '0' : '—';
  let product: [string, string] | null = null;
  if (items && String(items.length) === count) {
    const weights = new Set<number>();
    let knownWeights = true, sameProduct = items.length > 0;
    const identity = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
    for (const item of items) {
      const kg = weight(item.bobina_kg ?? item.babina_kg), units = kg != null && kg > 0 ? Math.round(kg * 1_000_000) : 0;
      if (units > 0) weights.add(units); else knownWeights = false;
      const payload = object(item.payload_json), customer = text(payload?.customer_name).trim();
      let name = text(payload?.order_title).trim();
      if (!name) name = text(item.label_item_name).split(/\s+(?:yarim tayyor(?: mahsulot)?|tayyor mahsulot)|,\s*apparat:/i)[0].trim();
      if (!name || (product && (identity(product[0]) !== identity(customer) || identity(product[1]) !== identity(name)))) sameProduct = false;
      product ??= [customer, name];
    }
    if (knownWeights) bobinaCount = String(weights.size);
    if (!sameProduct) product = null;
  }
  return [...(product ? [`Mijoz: ${product[0] || '—'}`, `Mahsulot nomi: ${product[1]}`] : []),
    `Paddon ${text(paddon.code).trim()}`, `Mahsulot soni: ${count}`, `Turli babinalar soni: ${bobinaCount}`,
    `Brutto: ${formatWeight(paddon.total_gross_kg)} kg`, `Netto: ${formatWeight(paddon.total_net_kg)} kg`];
}

type PrintInput = { code: string; driver_url?: string; printer?: string; print_mode?: string; print_count?: number;
  print_transport?: 'wifi' | 'offline' | 'bluetooth'; beforeSend?: () => void };

/** @v2 adminPaddonPrintQr */
export async function adminPaddonPrintQr(session: Session, input: PrintInput) {
  const guard = input.beforeSend; guard?.();
  const code = input.code.trim();
  if (!code) throw new WorkerControlException('paddon_not_found', 'Paddon topilmadi');
  const driver = input.driver_url?.trim().replace(/\/+$/, '') ?? '';
  const body: Obj = { code };
  if (driver) body.driver_url = driver;
  if (input.print_transport === 'offline' || input.print_transport === 'bluetooth') body.print_transport = 'offline';
  if (input.printer?.trim()) body.printer = input.printer.trim();
  if (input.print_mode?.trim()) body.print_mode = input.print_mode.trim();
  body.print_count = Math.max(1, Math.min(100, Math.trunc(input.print_count ?? 1)));
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/qr/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, guard); guard?.();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_qr_print');
  }
  const payload = object(await response.json());
  guard?.();
  if (!payload) throw new TypeError('Invalid paddon print response');
  const paddon = object(payload.paddon);
  if (!paddon) throw new WorkerControlException('paddon_not_found', 'Paddon topilmadi');
  const print = object(payload.print) ?? {};
  const lines = input.print_transport === 'bluetooth' ? paddonBluetoothLabelLines(paddon, payload.items) : [];
  return { ok: payload.ok === true, paddon: paddonFromJson(paddon), qr_payload: payload.qr_payload == null ? code : String(payload.qr_payload),
    print_job: Object.keys(print).length ? printJobFromJson(print, 0, lines) : null,
    print_status: text(print.status), can_close_after_print: payload.can_close_after_print === true };
}
