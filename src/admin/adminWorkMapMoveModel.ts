import type { AdminApparatus } from '../apparatusApi';
import { dartTrim } from './dartJsonString';
import type { AdminWorkMapRow } from './adminWorkMapController';

/** The picker has one non-apparatus option; it is not a fabricated catalog item. */
export const adminWorkMapMoveUnassigned = Object.freeze({ moveUnassigned: true as const });
export type AdminWorkMapMoveSelection = AdminApparatus | typeof adminWorkMapMoveUnassigned;
export function adminWorkMapMoveIsUnassigned(value: AdminWorkMapMoveSelection | null): value is typeof adminWorkMapMoveUnassigned {
  return value === adminWorkMapMoveUnassigned;
}
export function adminWorkMapMoveScope(value: AdminWorkMapMoveSelection): string {
  return adminWorkMapMoveIsUnassigned(value) ? 'unassigned' : dartTrim(value.id);
}
export function adminWorkMapMoveName(value: AdminWorkMapMoveSelection): string {
  return adminWorkMapMoveIsUnassigned(value) ? 'Tanlanmagan' : value.name;
}
export function adminWorkMapMoveSame(left: AdminWorkMapMoveSelection | null, right: AdminWorkMapMoveSelection | null): boolean {
  if (!left || !right) return false;
  if (adminWorkMapMoveIsUnassigned(left) || adminWorkMapMoveIsUnassigned(right)) return left === right;
  return left.id === right.id;
}
/** V2 prefers print apparatus, retains existing choices, then uses the first distinct fallback. */
export function adminWorkMapMoveDefaults(source: readonly AdminApparatus[], currentTop: AdminWorkMapMoveSelection | null = null,
  currentBottom: AdminWorkMapMoveSelection | null = null): { top: AdminWorkMapMoveSelection | null; bottom: AdminWorkMapMoveSelection | null } {
  const print = source.filter(item => item.operation === 'print'), candidates = print.length ? print : source;
  if (!candidates.length) return { top: null, bottom: null };
  return { top: currentTop ?? candidates[0], bottom: currentBottom ?? (candidates.length > 1 ? candidates[1]
    : source.find(item => item.id !== candidates[0].id) ?? null) };
}
/** Paged source has no per-apparatus counts: unassigned precedes catalog rows when the other pane is real. */
export function adminWorkMapMovePickerOptions(source: readonly AdminApparatus[], opposite: AdminWorkMapMoveSelection | null): AdminWorkMapMoveSelection[] {
  const real = opposite && !adminWorkMapMoveIsUnassigned(opposite) ? source.filter(item => item.id !== opposite.id) : [...source];
  return opposite && !adminWorkMapMoveIsUnassigned(opposite) ? [adminWorkMapMoveUnassigned, ...real] : real;
}

/** Passive TransferListRow text from the already decoded Move window. */
export function adminWorkMapMoveRow(row: AdminWorkMapRow, index: number, fallback: string) {
  const code = dartTrim(row.code), title = dartTrim(row.title) || fallback;
  return { id: row.id, position: String(index + 1), code, title, supporting: dartTrim(row.customer) };
}
