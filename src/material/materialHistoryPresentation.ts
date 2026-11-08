import type { AdminApparatus } from '../apparatusApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartTrim } from '../shared/dartApparatus';
import { WorkerControlException } from '../workerControlsApi';
import type { AdminRawMaterialEvent } from './materialHistoryApi';
import { materialHistoryOptionalText } from './materialHistoryValueText';

const label = (value: string, values: Record<string, string>) => {
  const normalized = dartTrim(value).toLowerCase();
  // Dart's switch falls back even when the name is a JavaScript prototype key.
  return Object.hasOwn(values, normalized) ? values[normalized] : normalized;
};
const eventLabels: Record<string, string> = {
  receipt_posted: 'Omborga kirim qilindi', order_reserved: 'Zakaz uchun band qilindi', order_unreserved: 'Zakaz bandi yechildi',
  usage_started: 'Ishlatishga o‘tkazildi', usage_cancelled: 'Boshlash bekor qilindi',
  delivery_received: 'Apparat oldiga yetkazildi va qabul qilindi', consumption_posted: 'Material sarflandi',
  consumption_reversed: 'Material sarfi bekor qilindi', adjustment_increase: 'Miqdor oshirildi', adjustment_decrease: 'Miqdor kamaytirildi',
  transfer_in: 'Omborga transfer qilindi', transfer_out: 'Ombordan transfer qilindi',
};
const statusLabels: Record<string, string> = { available: 'Mavjud', reserved: 'Band qilingan', in_use: 'Ishlatilmoqda', consumed: 'Sarflangan' };
const roleLabels: Record<string, string> = { material_taminotchi: 'Material ta’minotchisi', admin: 'Administrator', werka: 'Werka', supplier: 'Ta’minotchi' };
const sourceLabels: Record<string, string> = { gscale_receipt: 'Tarozi kirimi', order_assignment: 'Zakaz biriktirishi',
  consumption: 'Sarflanish', manual_adjustment: 'Qo‘lda tuzatish', warehouse_transfer: 'Omborlararo transfer',
  material_delivery: 'Apparat oldiga yetkazish', system: 'Tizim' };
const two = (n: number) => String(n).padStart(2, '0');
const reference = (value: string) => { const name = dartTrim(value); return name && !name.includes(':') ? name : ''; };

/** @v2 _materialFriendlyApparatus */
export function materialFriendlyApparatus(id: string, catalog: Pick<AdminApparatus, 'id' | 'name'>[]): string {
  const value = dartTrim(id);
  if (!value) return '';
  // The source constructs a map, so the last duplicate ID wins.
  const names = new Map(catalog.filter(item => dartTrim(item.id) && dartTrim(item.name)).map(item => [dartTrim(item.id), dartTrim(item.name)]));
  return reference(names.get(value) ?? value);
}
/** @v2 _materialHistoryTitle */
export function materialHistoryTitle(event: AdminRawMaterialEvent): string {
  const item = dartTrim(event.item_name) || dartTrim(event.item_code);
  const qty = event.qty_delta === 0 ? '' : ` ${Math.abs(event.qty_delta).toFixed(3)} ${event.uom}`;
  const titles: Record<string, string> = { receipt_posted: `${item} kirim${qty}`, order_reserved: `${item} berildi`,
    order_unreserved: `${item} yechildi`, usage_started: `${item} ishlatishga o‘tdi`,
    usage_cancelled: `${item} ishlatishga o‘tkazish bekor qilindi`, delivery_received: `${item} apparat oldiga yetkazildi`,
    consumption_posted: `${item} sarflandi${qty}`, consumption_reversed: `${item} sarfi bekor qilindi${qty}`,
    adjustment_increase: `${item} tuzatildi${qty}`, adjustment_decrease: `${item} kamaytirildi${qty}`,
    transfer_in: `${item} transfer kirim${qty}`, transfer_out: `${item} transfer chiqim${qty}` };
  return Object.hasOwn(titles, event.event_type) ? titles[event.event_type] : item;
}
/** @v2 _materialHistorySubtitle */
export function materialHistorySubtitle(event: AdminRawMaterialEvent, catalog: Pick<AdminApparatus, 'id' | 'name'>[]): string {
  const machine = materialFriendlyApparatus(event.apparatus, catalog);
  return [dartTrim(event.warehouse), dartTrim(event.order_id) ? `Zakaz ${dartTrim(event.order_id)}` : '', machine, dartTrim(event.barcode)].filter(Boolean).join(' • ');
}
/** @v2 _materialHistoryTime */
export function materialHistoryTime(unix: number, now = new Date()): string {
  if (unix <= 0) return '';
  const date = new Date(unix * 1000), clock = `${two(date.getHours())}:${two(date.getMinutes())}`;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
    ? clock : `${two(date.getDate())}.${two(date.getMonth() + 1)} ${clock}`;
}
/** @v2 _materialHistoryDateTime */
export function materialHistoryDateTime(unix: number): string {
  if (unix <= 0) return '';
  const date = new Date(unix * 1000);
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
/** @v2 _materialHistoryDetails */
export function materialHistoryDetails(event: AdminRawMaterialEvent, catalog: Pick<AdminApparatus, 'id' | 'name'>[]) {
  const details: { label: string; value: string }[] = [];
  const add = (name: string, value: string) => { if (dartTrim(value)) details.push({ label: name, value: dartTrim(value) }); };
  add('Harakat turi', label(event.event_type, eventLabels));
  add('Mahsulot', dartTrim(event.item_name) || event.item_code);
  add('Mahsulot kodi', event.item_code); add('Ombor', event.warehouse);
  add('Miqdor', event.qty_delta === 0 ? '' : `${event.qty_delta > 0 ? '+' : ''}${event.qty_delta.toFixed(3)}${dartTrim(event.uom) ? ` ${dartTrim(event.uom)}` : ''}`);
  add('Shtrix-kod', event.barcode);
  const before = label(event.stock_status_before, statusLabels), after = label(event.stock_status_after, statusLabels);
  add('Holati', !before || !after || before === after ? after || before : `${before} → ${after}`);
  add('Zakaz', event.order_id); add('Apparat', materialFriendlyApparatus(event.apparatus, catalog));
  if (event.event_type === 'delivery_received') {
    const person = event.payload_json.delivered_by;
    if (person && typeof person === 'object' && !Array.isArray(person)) add('Olib kelgan', materialHistoryOptionalText((person as Record<string, unknown>).name));
  }
  const actor = dartTrim(event.actor_display_name), owner = dartTrim(event.owner_display_name);
  add(event.event_type === 'delivery_received' ? 'Qabul qilgan' : 'Bajargan', actor && !actor.includes(':') ? actor : reference(event.actor_ref));
  add('Rol', label(event.actor_role, roleLabels));
  add('Egasi', owner && !owner.includes(':') ? owner : reference(event.owner_ref));
  add('Egasi roli', label(event.owner_role, roleLabels)); add('Manba', label(event.source_type, sourceLabels));
  add('Receipt raqami', event.source_id); add('Vaqt', materialHistoryDateTime(event.occurred_at_unix));
  add('Yozilgan vaqt', materialHistoryDateTime(event.recorded_at_unix));
  return details;
}
/** @v2 _materialHistoryErrorMessage */
export function materialHistoryErrorMessage(error: unknown): string {
  if (error instanceof MobileApiException || error instanceof WorkerControlException) {
    const status = error.statusCode == null ? '' : ` (${error.statusCode})`;
    return error.code === 'raw_material_history_not_found' ? `Backend hali yangi history endpoint bilan ko‘tarilmagan${status}` : `${error.message}${status}`;
  }
  return 'Serverdan ma’lumot olinmadi';
}
