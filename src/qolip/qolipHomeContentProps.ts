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
  renderBlock: (block: QolipBlock, content: QolipHomeBlockContent) => ReactNode;
  dock?: ReactNode;
};
