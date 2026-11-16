import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

/** The owning shell selects the V2 drawer/back behavior and supplies the existing dock. */
export type AdditionalSettingsScreenProps = {
  session: Session;
  witness: SessionWitness;
  isCurrent: () => boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
};
