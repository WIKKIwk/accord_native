import type { ReturnedPaintCompleteSubmission, ReturnedPaintItem } from './returnedPaintModel';

export class ReturnedPaintReconciliationError extends Error {
  constructor() {
    super('Saqlash natijasi aniq emas. Ro‘yxatni yangilab, hisobotni tekshiring.');
    this.name = 'ReturnedPaintReconciliationError';
  }
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Json : null;

// The current server serializes normalized DecimalAmount values as strings. Do not
// use JS numbers: different large exact decimals can round to the same double.
function decimal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)(?:\.(\d*))?$/.exec(value.trim().replace(/,/g, '.'));
  if (!match) return null;
  const integer = match[1].replace(/^0+/, '') || '0', fraction = (match[2] ?? '').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}
function canonicalItems(raw: unknown): string | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const normalized: { usage: string; category: string; name: string; values: [string, string][] }[] = [];
  for (const entry of raw) {
    const item = object(entry), values = object(item?.values);
    if (!item || !values || typeof item.usage !== 'string' || typeof item.category !== 'string' || typeof item.name !== 'string') return null;
    const usage = item.usage.trim().toLowerCase(), category = item.category.trim().toLowerCase(), name = item.name.trim();
    if (!['rasxot', 'astatka'].includes(usage) || !['colors', 'lacquers', 'solvents'].includes(category) || !name) return null;
    const fields: [string, string][] = [], seen = new Set<string>();
    for (const [rawLabel, rawValue] of Object.entries(values)) {
      const label = rawLabel.trim(), value = decimal(rawValue);
      if (!label || value === null || seen.has(label)) return null;
      seen.add(label); fields.push([label, value]);
    }
    if (!fields.length) return null;
    fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    normalized.push({ usage, category, name, values: fields });
  }
  return JSON.stringify(normalized);
}

/** Compare the raw 200 response before V2 model defaults can turn an unknown status into completed. */
export function verifyReturnedPaintCompletion(body: Json, submission: ReturnedPaintCompleteSubmission): void {
  const expected = canonicalItems(submission.items as ReturnedPaintItem[]), actual = canonicalItems(body.items);
  if (typeof body.id !== 'string' || body.id.trim() !== submission.request_id.trim() || !submission.request_id.trim() ||
      body.status !== 'completed' || expected === null || actual === null || expected !== actual) {
    throw new ReturnedPaintReconciliationError();
  }
}
