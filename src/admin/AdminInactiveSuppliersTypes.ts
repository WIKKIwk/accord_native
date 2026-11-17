import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminInactiveSuppliersScreenProps = {
  session: Session;
  witness: SessionWitness;
  isCurrent: () => boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void };
  profileAction?: ReactNode;
  topNotice?: ReactNode;
  footer?: ReactNode;
};
