import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminRolesNotice } from './adminRolesController';

export type AdminRolesScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void };
  profileAction?: ReactNode; footer?: ReactNode; topNotice?: ReactNode;
  /** The genuine original Scaffold Messenger renders this through topNotice. */
  showTopNotice: (message: string, tone: 'success' | 'error', icon: AdminRolesNotice['icon']) => void;
};
