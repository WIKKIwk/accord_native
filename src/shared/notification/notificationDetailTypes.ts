import type { ReactNode } from 'react';
import type { Session } from '../../auth';
import type { DispatchRecord } from '../notificationApi';

/** Navigation and the role dock stay with the host route. */
export type NotificationDetailScreenProps = {
  session: Session;
  receiptId: string;
  onBack: () => void;
  onCustomerDetail: (receiptId: string) => void;
  onWerkaDetail: (record: DispatchRecord) => void;
  /** Pop the screen and show this V2 snackbar on the screen underneath. */
  onForeignReceipt: (message: string) => void;
  footer?: ReactNode;
};
