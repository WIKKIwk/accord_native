import { appRoutes } from '../shared/appRoutes';
import { localizedGetter, localizedMethod } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';

export type WerkaSuccessRecord = Pick<DispatchRecord, 'id' | 'event_type' | 'sent_qty' | 'accepted_qty' | 'uom'>;
export type WerkaSuccessContentProps = {
  record: WerkaSuccessRecord;
  locale: string;
  returnRouteName?: string | null;
  returnLabel?: string | null;
  /** The eventual screen must validate the target and preserve V2's pop-to-first behavior. */
  onReturn: (target: string) => void;
};

/** Source-based content only; this does not navigate or assert that a write succeeded. */
export function werkaSuccessPresentation(props: Omit<WerkaSuccessContentProps, 'onReturn'>) {
  const { record, locale } = props;
  const customerIssue = record.event_type === 'customer_issue_pending';
  const unannounced = record.event_type === 'werka_unannounced_pending';
  const returnsToCreate = customerIssue || unannounced;
  const qty = returnsToCreate ? record.sent_qty : record.accepted_qty;
  const method = customerIssue ? 'sentToCustomerLine' : unannounced ? 'createdLine' : 'receivedLine';
  let subtitle = localizedMethod(method, locale, { qty, uom: record.uom });
  // Dart's toStringAsFixed preserves the sign of negative zero, unlike JS toFixed.
  if (Object.is(qty, -0) && subtitle.startsWith('0.00 ')) subtitle = `-${subtitle}`;
  return {
    id: record.id,
    title: localizedGetter(customerIssue ? 'sentSuccess' : unannounced ? 'createdSuccess' : 'receivedSuccess', locale),
    subtitle,
    actionLabel: props.returnLabel ?? localizedGetter(returnsToCreate ? 'createFlowBack' : 'pendingListBack', locale),
    target: props.returnRouteName ?? (returnsToCreate ? appRoutes.werkaCreateHub : appRoutes.werkaHome),
  };
}
