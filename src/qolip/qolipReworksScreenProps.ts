import type { ReactNode } from 'react';
import type { Session } from '../auth';

export type QolipReworksScreenProps = {
  session: Session;
  isCurrent?: () => boolean;
  // Defaults to the real native-clock/secure-random V2 ID source; injectable for tests.
  nextRequestId?: () => Promise<string>;
  onMenu: () => void;
  onProfile: () => void;
  dock: ReactNode;
};
