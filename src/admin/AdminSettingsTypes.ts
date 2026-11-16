import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminSettingsScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: { icon: 'back' | 'menu'; label: string; onPress: (changed: boolean) => void };
  footer?: ReactNode;
  onNavigate: (route: string) => void;
  isRouteAvailable?: (route: string) => boolean;
};
