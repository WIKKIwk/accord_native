import type { ReturnedPaintDraft } from './returnedPaintDraft';

export type BoyoqchiPaintPaletteProps = {
  usage: 'rasxot' | 'astatka';
  draft: ReturnedPaintDraft;
  onUsage: (usage: 'rasxot' | 'astatka') => void;
  onSelect: (name: string) => void;
};
