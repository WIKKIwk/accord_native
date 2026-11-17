import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminQueuePolicyScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: { icon: 'back' | 'menu'; label: string; onPress: () => void };
  footer?: ReactNode; profileAction?: ReactElement; topNotice?: ReactNode;
  /** Use the genuine source Admin top-notice host, preserving its error tone. */
  onErrorNotice: (message: string) => void;
  /** Same optional apparatus filter as the source panel embedded in a detail page. */
  apparatusId?: string;
};
