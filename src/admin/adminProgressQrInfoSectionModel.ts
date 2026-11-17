import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminProgressQrOrderDetailsProps, AdminProgressQrQueueStatesProps } from './AdminProgressQrInfoSectionsTypes';
import { adminProgressQrOrderDetails, adminProgressQrQueueStates } from './adminProgressQrInfoSectionsPresentation';

/** Stateless read-only projection. Actual original report/Root ownership remains the caller's required dependency. */
export function adminProgressQrOrderDetailsModel(props: AdminProgressQrOrderDetailsProps) {
  const { isCurrent, p, order } = props;
  if (typeof isCurrent !== 'function' || typeof p !== 'function') throw TypeError('Original QR report authority and production localization are required');
  if (!isSynchronouslyTrue(isCurrent)) return null;
  const section = adminProgressQrOrderDetails(order, p);
  return isSynchronouslyTrue(isCurrent) ? section : null;
}
export function adminProgressQrQueueStatesModel(props: AdminProgressQrQueueStatesProps) {
  const { isCurrent, p, queueStates, apparatusNamesById } = props;
  if (typeof isCurrent !== 'function' || typeof p !== 'function' || typeof queueStates?.[Symbol.iterator] !== 'function' || typeof apparatusNamesById?.get !== 'function') throw TypeError('Original QR report authority, ordered queues and apparatus catalog are required');
  if (!isSynchronouslyTrue(isCurrent)) return null;
  const section = adminProgressQrQueueStates(queueStates, apparatusNamesById, p);
  return isSynchronouslyTrue(isCurrent) ? section : null;
}
