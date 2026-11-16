import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminSettingsScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: { icon: 'back' | 'menu'; label: string; onPress: (changed: boolean) => void };
  footer?: ReactNode;
  /** Original-account profile/account action, supplied by the real navigation host. */
  profileAction?: ReactElement;
  onNavigate: (route: string) => void;
  isRouteAvailable?: (route: string) => boolean;
};
