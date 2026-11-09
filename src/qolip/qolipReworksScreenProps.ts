import type { ReactNode } from 'react';
import type { Session } from '../auth';

export type QolipReworksScreenProps = {
  session: Session;
  // Must be the real secure V2-format ID source. No implementation is available yet.
  nextRequestId: () => Promise<string>;
  onMenu: () => void;
  onProfile: () => void;
  dock: ReactNode;
};
