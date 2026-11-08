import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePreparationNotice } from '../../preparation/usePreparationNotice';
import { addNotificationComment, notificationDetail, supplierRespondUnannounced } from '../notificationApi';
import { notificationUnreadStore, supplierRuntimeStore } from '../notificationStoresRuntime';
import { sessionAccessRole } from '../searchActivityStore';
import { NotificationDetailController, type NotificationDetailCallbacks } from './notificationDetailController';
import { notificationDetailPolicy } from './notificationDetailModel';
import type { NotificationDetailScreenProps } from './notificationDetailTypes';

const notReady = () => { throw new Error('Notification detail callbacks are not ready'); };

export function useNotificationDetail(props: NotificationDetailScreenProps) {
  const notice = usePreparationNotice();
  const role = sessionAccessRole(props.session);
  const profileRef = typeof props.session.profile.ref === 'string' ? props.session.profile.ref : '';
  const controller = useMemo(() => new NotificationDetailController(props.session, props.receiptId, role, {
    markSeen: (session, id) => notificationUnreadStore.markSeen(session, [id]),
    read: notificationDetail,
    comment: addNotificationComment,
    respond: supplierRespondUnannounced,
    recordDecision: (from, to) => supplierRuntimeStore.recordUnannouncedDecision(from, to),
  }, { onCustomerDetail: notReady, onForeignReceipt: notReady, onNotice: notReady } as NotificationDetailCallbacks, profileRef),
  [props.session, props.receiptId, role, profileRef]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.setCallbacks({ onCustomerDetail: props.onCustomerDetail,
    onForeignReceipt: props.onForeignReceipt, onNotice: notice.show }); },
  [controller, props.onCustomerDetail, props.onForeignReceipt, notice.show]);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  const policy = state.detail ? notificationDetailPolicy(role, profileRef, state.detail) : null;
  return { controller, state, policy, notice: notice.message };
}
