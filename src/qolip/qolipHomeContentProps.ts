import type { ReactNode } from 'react';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipHomePresentation } from './qolipHomePresentation';

export type QolipHomeBlockContent = {
  index: number;
  searchCounts: Readonly<Record<string, number>>;
  refresh: () => Promise<void>;
};

/** An unwired read-only presentation. Its future owner must supply real, guarded callbacks and block content. */
export type QolipHomeContentProps = {
  home: QolipHomePresentation;
  search: string;
  onSearchChange: (value: string) => void;
  onMenu: () => void;
  onProfile: () => void;
  onSelectBlock: (index: number) => void;
  onReorderBlocks: (oldIndex: number, newIndex: number) => void;
  retry: () => Promise<void>;
  refreshBlock: (blockName: string) => Promise<void>;
  dock?: ReactNode;
} & ({
  renderBlock: (block: QolipBlock, content: QolipHomeBlockContent) => ReactNode;
  renderRetainedBlocks?: never;
} | {
  renderBlock?: never;
  renderRetainedBlocks: (home: Extract<QolipHomePresentation, { kind: 'blocks' }>) => ReactNode;
});
