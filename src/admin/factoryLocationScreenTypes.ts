import type { ReactNode } from 'react';
import type { FactoryLocationController, FactoryLocationTicket } from './factoryLocationController';

/** The owner supplies a session-scoped controller and real dialog/navigation callbacks. */
export type FactoryLocationScreenProps = {
  controller: FactoryLocationController;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
  onOpenEditor: (ticket: FactoryLocationTicket) => void;
  onOpenRename: (ticket: FactoryLocationTicket) => void;
};
