import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { usePreparationNotice } from '../../preparation/usePreparationNotice';
import { addNotificationComment, notificationDetail, supplierRespondUnannounced } from '../notificationApi';
import { notificationUnreadStore, supplierRuntimeStore } from '../notificationStoresRuntime';
import { sessionAccessRole } from '../searchActivityStore';
import { NotificationDetailController } from './notificationDetailController';
import { notificationDetailPolicy } from './notificationDetailModel';
import type { NotificationDetailScreenProps } from './notificationDetailTypes';

export function useNotificationDetail(props: NotificationDetailScreenProps) {
  const latest = useRef(props);
  latest.current = props;
  const notice = usePreparationNotice();
  const noticeRef = useRef(notice.show);
  noticeRef.current = notice.show;
  const role = sessionAccessRole(props.session);
  const controller = useMemo(() => new NotificationDetailController(props.session, props.receiptId, role, {
    markSeen: (session, id) => notificationUnreadStore.markSeen(session, [id]),
    read: notificationDetail,
    comment: addNotificationComment,
    respond: supplierRespondUnannounced,
    recordDecision: (from, to) => supplierRuntimeStore.recordUnannouncedDecision(from, to),
  }, {
    onCustomerDetail: id => latest.current.onCustomerDetail(id),
    onForeignReceipt: message => latest.current.onForeignReceipt(message),
    onNotice: message => noticeRef.current(message),
  }), [props.session, props.receiptId, role]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  const ref = typeof props.session.profile.ref === 'string' ? props.session.profile.ref : '';
  const policy = state.detail ? notificationDetailPolicy(role, ref, state.detail) : null;
  return { controller, state, policy, notice: notice.message };
}
