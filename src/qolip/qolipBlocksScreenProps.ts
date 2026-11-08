import type { ReactNode } from 'react';
import type { Session } from '../auth';

export type QolipBlocksScreenProps = {
  session: Session;
  onMenu: () => void;
  onProfile: () => void;
  dock: ReactNode;
};
