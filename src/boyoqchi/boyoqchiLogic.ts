import type { AdminApparatus } from '../apparatusApi';
import type { ReturnedPaintItem, ReturnedPaintRequest } from './returnedPaintModel';
import { returnedPaintDouble } from './returnedPaintModel';
import { returnedPaintDraftHasInvalidValues, returnedPaintFilledFieldCountForUsage, returnedPaintHasMinimumFieldsPerUsage,
  returnedPaintItemsFromDraft, type ReturnedPaintDraftData } from './returnedPaintRules';

const display = (value: string) => value.trim() || '—';
const two = (value: number) => String(value).padStart(2, '0');
/** @v2 formatLocalDateTime */
export function boyoqchiDate(value: Date): string {
  return `${two(value.getDate())}.${two(value.getMonth() + 1)}.${value.getFullYear()} ${two(value.getHours())}:${two(value.getMinutes())}`;
}
export function boyoqchiRequestKey(request: ReturnedPaintRequest): string {
  const id = request.id.trim();
  if (id) return id;
  const date = request.created_at;
  const iso = `${String(date.getFullYear()).padStart(4, '0')}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  return `${request.order_id.trim()}|${request.order_code.trim()}|${iso}`;
}
export function boyoqchiOrderLabel(request: ReturnedPaintRequest): string {
  const name = request.order_name.trim(), code = request.order_code.trim();
  return name && code ? `${name} — #${code}` : name || (code ? `#${code}` : display(request.order_id));
}
export function boyoqchiApparatusLabel(id: string, apparatus: readonly AdminApparatus[]): string {
  const normalized = id.trim();
  const found = apparatus.filter(item => item.id.trim() === normalized && item.name.trim()).at(-1)?.name.trim() ?? normalized;
  return !found || found.includes(':') ? '—' : found;
}
export function boyoqchiOperator(request: ReturnedPaintRequest): string {
  const name = request.sender_display_name.trim(), ref = request.sender_ref.trim();
  return name || (!ref || ref.includes(':') ? '—' : ref);
}
export function boyoqchiAmount(raw: string): string {
  let value = raw.trim();
  if (value.includes('.')) value = value.replace(/0+$/, '').replace(/\.$/, '');
  return value ? `${value} kg` : '—';
}
// Dart VM double.toInt() saturates at signed 64-bit limits and renders the exact integer.
function dartIntegerText(value: number): string {
  const limit = 2 ** 63;
  if (value >= limit) return '9223372036854775807';
  if (value <= -limit) return '-9223372036854775808';
  const magnitude = Math.abs(value);
  if (magnitude <= Number.MAX_SAFE_INTEGER) return String(value);
  // Split the exact binary integer into 32-bit words, then into base 10^6.
  // All intermediate products remain below 2^53, so no decimal digits are lost.
  const high = Math.floor(magnitude / 2 ** 32), low = magnitude - high * 2 ** 32;
  const tail = high * 967296 + low;
  const head = high * 4294 + Math.floor(tail / 1000000);
  return `${value < 0 ? '-' : ''}${head}${String(tail % 1000000).padStart(6, '0')}`;
}
export function boyoqchiNumber(raw: string): string {
  const value = returnedPaintDouble(raw);
  if (value === null) return raw;
  if (Number.isInteger(value)) return dartIntegerText(value);
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
export function boyoqchiCategoryLabel(raw: string): string {
  const category = raw.trim();
  switch (category.toLowerCase()) {
    case 'colors': case 'ranglar': return 'Ranglar';
    case 'lacquers': case 'laklar': return 'Laklar';
    case 'solvents': case 'spirtlar': return 'Spirtlar';
    default: return category;
  }
}
export function boyoqchiGroups(items: readonly ReturnedPaintItem[], usage: string): { category: string; items: ReturnedPaintItem[] }[] {
  const groups = new Map<string, ReturnedPaintItem[]>();
  for (const item of items) {
    if (item.usage.trim().toLowerCase() !== usage) continue;
    const category = item.category.trim();
    if (!category || !Object.entries(item.values).some(([key, value]) => key.trim() && value.trim())) continue;
    const current = groups.get(category) ?? [];
    current.push(item); groups.set(category, current);
  }
  return [...groups].map(([category, rows]) => ({ category, items: rows }));
}
export function boyoqchiItemText(item: ReturnedPaintItem): string {
  const fields = Object.entries(item.values).filter(([key, value]) => key.trim() && value.trim())
    .map(([key, value]) => `${key.trim()} — ${boyoqchiNumber(value)}`).join(', ');
  return `${display(item.name)}: ${fields}`;
}
export function boyoqchiInputAllowed(value: string): boolean { return /^(?:\d+(?:[.,]\d*)?)?$/.test(value); }
export function boyoqchiSaveInput(draft: ReturnedPaintDraftData): { items: ReturnedPaintItem[]; error: string } {
  if (returnedPaintDraftHasInvalidValues(draft)) return { items: [], error: 'Qaytarilgan bo‘yoq qiymatlarini to‘g‘ri raqamda kiriting.' };
  const items = returnedPaintItemsFromDraft(draft);
  if (!returnedPaintHasMinimumFieldsPerUsage(items)) {
    const rasxot = returnedPaintFilledFieldCountForUsage(items, 'rasxot'), astatka = returnedPaintFilledFieldCountForUsage(items, 'astatka');
    return { items, error: `Har bir tabda kamida 3 ta maydon to‘ldiring. Rasxot: ${rasxot}/3, Astatka: ${astatka}/3.` };
  }
  return { items, error: '' };
}
