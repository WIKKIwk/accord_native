import { dailyWorkDate } from '../dailyWork';
import type { AdminItemDetailDecisionState } from './adminItemDetailDecisionController';
import { adminItemDetailKind, type AdminItemDetail } from './adminItemDetailModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

type Text = (key: string, values?: Record<string, unknown>) => string;
export type AdminItemDetailInformationRow = Readonly<{ label: string; value: string }>;
export const adminItemDetailGeometry = Object.freeze({ list: { left: 8, top: 8, right: 8, bottom: 120 }, gap: 10,
  headerRadius: 20, headerPadding: 18, iconSize: 48, iconRadius: 14, imageSize: 56, imageRadius: 14, headerGap: 14,
  sectionRadius: 20, sectionPadding: { left: 16, top: 16, right: 16, bottom: 6 }, sectionTitleGap: 8,
  rowVerticalPadding: 10, rowGap: 14, labelWeight: 4, valueWeight: 6, actionHeight: 56, actionRadius: 20 });
export function adminItemDetailValue(value: string, a: Text, empty = ''): string {
  return dartTrim(value) || (dartTrim(empty) ? empty : a('profile.entered'));
}
export function adminItemDetailReadPresentation(detail: AdminItemDetail, state: Pick<AdminItemDetailDecisionState, 'saving' | 'changingGroup' | 'deleting'>, a: Text) {
  const kind = adminItemDetailKind(detail), busy = state.saving || state.changingGroup || state.deleting;
  const row = (label: string, value: string, empty = '') => Object.freeze({ label: a(label), value: adminItemDetailValue(value, a, empty ? a(empty) : '') });
  const dates = Object.freeze([row('detail.created_at', dailyWorkDate(detail.created_at_unix), 'detail.date_missing'), row('detail.updated_at', dailyWorkDate(detail.updated_at_unix), 'detail.not_changed')]);
  const group = dartTrim(detail.item_group);
  return Object.freeze({ kind, title: dartTrim(detail.name) ? detail.name : detail.code,
    showCode: !detail.is_finished_goods || dartTrim(detail.code) !== dartTrim(detail.name), code: detail.code,
    badge: kind === 'combo' ? a('calculate.combo') : kind === 'finished' ? a('detail.finished_product') : null,
    actionsLabel: a(kind === 'combo' ? 'calculate.combo_actions' : 'detail.item_actions'), actionsEnabled: kind === 'combo' || !busy,
    editEnabled: kind === 'ordinary' && !busy, editBusy: state.saving, editLabel: a(state.saving ? 'action.saving' : 'detail.edit_name_code'),
    groupEnabled: kind === 'ordinary' && !busy, groupBusy: state.changingGroup, groupLabel: a(state.changingGroup ? 'detail.groups_loading' : 'detail.change_group'),
    deleteEnabled: kind === 'ordinary' && !busy, deleteBusy: state.deleting, deleteLabel: a(state.deleting ? 'detail.delete_in_progress' : 'detail.item_delete_title'),
    ordinaryRows: Object.freeze([row('detail.item_name', detail.name), row('detail.item_code', detail.code), row('item.group', detail.item_group)]),
    finishedGroup: kind === 'finished' && group && dartPartialLower(group) !== 'tayyor mahsulot' ? row('item.group', group) : null,
    uom: row('item.uom_label', detail.uom), dates,
    customerLabel: a(detail.customers.length > 1 ? 'detail.customers' : 'detail.customer'),
    customers: Object.freeze(detail.customers.map(customer => Object.freeze({ name: customer.name,
      subtitle: [customer.ref, customer.phone].filter(value => dartTrim(value)).join(' • ') }))), unassigned: a('detail.unassigned'),
  });
}
/** The shared provider/cache returns actual bytes. No unauthenticated URL image fetch is introduced. */
export function adminItemDetailImageDataUri(bytes: Uint8Array): string {
  if (!bytes.length) throw Error('Item image is empty');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', chunks: string[] = []; let part = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    part += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : alphabet[c & 63]);
    if (part.length >= 32768) { chunks.push(part); part = ''; }
  }
  chunks.push(part);
  const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0x47 && bytes[1] === 0x49 ? 'image/gif'
    : bytes[0] === 0x52 && bytes[1] === 0x49 ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${chunks.join('')}`;
}
export type AdminItemDetailReadPresentation = ReturnType<typeof adminItemDetailReadPresentation>;
