import type { ReactNode } from 'react';
import type { Session } from '../auth';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

export type RezkaWorkerSettingsProps = {
  session: Session;
  snapshot: RezkaSessionSnapshot;
  allowAssignments?: boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
};
