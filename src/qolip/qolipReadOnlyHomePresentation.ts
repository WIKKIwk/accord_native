import type { QolipBlock } from './qolipReadOnlyBlocksApi';
import { qolipHomeBlockKey } from './qolipHomeLogic';
import type { QolipHomeState } from './qolipReadOnlyHomeState';

export type QolipHomeTab = { key: string; block: QolipBlock; index: number; selected: boolean; matchCount: number };
export type QolipHomePresentation = { kind: 'invalid' | 'loading' | 'retry' | 'refresh-unavailable' | 'unattached' | 'no-blocks' }
  | { kind: 'blocks'; tabs: readonly QolipHomeTab[]; selected: QolipHomeTab;
    cellCounts: Readonly<Record<string, Readonly<Record<string, number>>>> };

/** Outer read-only branches of QolipHomeScreen.build, not a complete screen port. */
export function qolipReadOnlyHomePresentation(state: ReturnType<QolipHomeState['getSnapshot']>): QolipHomePresentation {
  if (state.invalid) return { kind: 'invalid' };
  if (state.loading && state.snapshot === null) return { kind: 'loading' };
  if (state.error) return { kind: state.refreshUnavailable ? 'refresh-unavailable' : 'retry' };
  const blocks = state.orderedBlocks.length ? state.orderedBlocks : state.snapshot?.blocks ?? [];
  if (!blocks.length) return { kind: state.snapshot?.warehouses.length ? 'no-blocks' : 'unattached' };
  // V2's extra controller page belongs to Add, which is not exposed by this content checkpoint.
  const selectedIndex = Math.max(0, Math.min(state.selectedIndex, blocks.length - 1));
  const tabs = blocks.map((block, index) => {
    const key = qolipHomeBlockKey(block);
    return { key, block, index, selected: index === selectedIndex, matchCount: state.blockCounts[key] ?? 0 };
  });
  return { kind: 'blocks', tabs, selected: tabs[selectedIndex], cellCounts: state.cellCounts };
}
