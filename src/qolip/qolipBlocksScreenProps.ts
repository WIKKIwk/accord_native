import type { ReactNode } from 'react';
import type { Session } from '../auth';

export type QolipBlocksScreenProps = {
  session: Session;
  isCurrent?: () => boolean;
  onMenu: () => void;
  onProfile: () => void;
  dock: ReactNode;
};
