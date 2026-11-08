import type { ReactNode } from 'react';
import type { Session } from '../../auth';
import type { DispatchRecord } from '../notificationApi';

/** Navigation and the role dock stay with the host route. */
export type NotificationDetailScreenProps = {
  session: Session;
  receiptId: string;
  onBack: () => void;
  /** Required for Customer MAT-DN IDs; replace the current route with Customer detail. */
  onCustomerDetail?: (receiptId: string) => void;
  /** Required when a Werka pending/draft receipt can open Werka detail. */
  onWerkaDetail?: (record: DispatchRecord) => void;
  /** Pop the screen and show this V2 snackbar on the screen underneath. */
  onForeignReceipt: (message: string) => void;
  footer?: ReactNode;
};
