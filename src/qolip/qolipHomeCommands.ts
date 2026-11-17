import type { QolipBlock } from './qolipBlocksApi';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { qolipMoveReachedTarget } from './qolipLocationLogic';

export type QolipHomeTarget = { block: QolipBlock; rowLetter: string; columnNumber: number };
export type QolipHomeMoveResult = { kind: 'moved'; target: QolipHomeTarget } | { kind: 'unconfirmed'; location: string } | null;
type MoveDependencies = {
  current(): boolean;
  single(item: QolipLocationEntry, target: QolipHomeTarget, quantity: number): Promise<QolipLocationEntry>;
  multiple(items: QolipLocationEntry[], target: QolipHomeTarget): Promise<QolipLocationEntry[]>;
  refresh(name: string): Promise<readonly QolipLocationEntry[]>;
};
const key = (value: string) => value.trim().toLowerCase();

/** V2 _moveQolipToCell / _moveQolips: mutation response alone never confirms a target. */
export async function moveQolipHomeLocations(items: readonly QolipLocationEntry[], target: QolipHomeTarget,
  deps: MoveDependencies, quantity?: number): Promise<QolipHomeMoveResult> {
  if (!deps.current() || !items.length) return null;
  const batch = quantity === undefined;
  const moved = batch ? await deps.multiple([...items], target) : [await deps.single(items[0], target, quantity)];
  if (!deps.current()) return null;
  const names = new Map<string, string>();
  for (const name of [...items.map(item => item.block), target.block.name, ...moved.map(item => item.block)]) {
    const trimmed = name.trim(); if (trimmed && !names.has(key(trimmed))) names.set(key(trimmed), trimmed);
  }
  const refreshed = new Map(await Promise.all([...names].map(async ([nameKey, name]) => [nameKey, await deps.refresh(name)] as const)));
  if (!deps.current()) return null;
  const targetRows = refreshed.get(key(target.block.name)) ?? [];
  const byCode = new Map(moved.map(item => [key(item.qolip_code), item]));
  const confirmed = items.every(item => {
    const result = byCode.get(key(item.qolip_code));
    return !!result && qolipMoveReachedTarget({ moved: result, targetBlock: target.block, qolipCode: item.qolip_code,
      rowLetter: target.rowLetter, columnNumber: target.columnNumber }) && targetRows.some(row => row.id === result.id && key(row.qolip_code) === key(item.qolip_code));
  });
  if (confirmed) return { kind: 'moved', target };
  const first = moved[0];
  return { kind: 'unconfirmed', location: !batch && first ? first.location_label.trim() ? `${first.block} / ${first.location_label}` : first.block
    : `${target.block.name} / ${target.rowLetter}${target.columnNumber}` };
}

/** V2 take and move forms only accept a positive whole count within the loaded stock. */
export function qolipHomeQuantity(value: string, maximum: number): { quantity: number; error: null } | { quantity: null; error: 'home.invalid_count' | 'home.only_count' } {
  const trimmed = value.trim(), quantity = /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { quantity: null, error: 'home.invalid_count' };
  if (quantity > maximum) return { quantity: null, error: 'home.only_count' };
  return { quantity, error: null };
}

/** V2 _issueSelectedQolips sends one unit per selected location, sequentially, retaining partial success. */
export async function issueQolipHomeSelection(items: readonly QolipLocationEntry[], workerId: string, deps: {
  current(): boolean; issue(item: QolipLocationEntry, workerId: string): Promise<unknown>; refresh(block: string): Promise<unknown>;
}) {
  let success = 0, firstError: unknown;
  for (const item of items) {
    if (!deps.current()) return null;
    try { await deps.issue(item, workerId); success++; } catch (error) { firstError ??= error; }
  }
  if (!deps.current()) return null;
  for (const block of new Set(items.map(item => item.block))) void deps.refresh(block).catch(() => {});
  return { success, failed: items.length - success, firstError };
}
