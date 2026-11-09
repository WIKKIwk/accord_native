import type { QolipSetsReadSnapshot } from './qolipSetsReadState';

/** Partial read-only content: no shell, clipboard, create/edit/delete, refresh or retry action. */
export type QolipSetsReadContentProps = { snapshot: QolipSetsReadSnapshot };
