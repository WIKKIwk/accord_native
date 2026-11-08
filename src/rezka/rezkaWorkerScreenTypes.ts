import type { ReactNode } from 'react';
import type { Session } from '../auth';

export type RezkaWorkerSettingsProps = {
  session: Session;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
};
