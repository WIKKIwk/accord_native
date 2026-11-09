import { trimDart } from './qolipApiCommon';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** @v2 qolipMoveReachedTarget */
export function qolipMoveReachedTarget(input: {
  moved: QolipLocationEntry; targetBlock: QolipBlock; qolipCode: string; rowLetter: string; columnNumber: number;
}): boolean {
  const lower = (value: string) => trimDart(value).toLowerCase();
  return lower(input.moved.block) === lower(input.targetBlock.name) &&
    lower(input.moved.warehouse) === lower(input.targetBlock.warehouse) &&
    lower(input.moved.qolip_code) === lower(input.qolipCode) &&
    trimDart(input.moved.row_letter).toUpperCase() === trimDart(input.rowLetter).toUpperCase() &&
    input.moved.column_number === input.columnNumber;
}

/** @v2 qolipMoveTargetBlocks */
export function qolipMoveTargetBlocks(input: {
  blocks: QolipBlock[]; source: QolipLocationEntry; supportsCrossBlockMove: boolean;
}): readonly QolipBlock[] {
  if (input.supportsCrossBlockMove && input.blocks.length) return Object.freeze([...input.blocks]);
  const sourceName = trimDart(input.source.block).toLowerCase();
  for (const block of input.blocks) if (trimDart(block.name).toLowerCase() === sourceName) return [block];
  return [{ name: input.source.block, warehouse: input.source.warehouse }];
}
