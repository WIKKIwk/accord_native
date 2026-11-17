import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminProgressQrMaterialAssignmentProps, AdminProgressQrMaterialStatusProps } from './AdminProgressQrMaterialSectionsTypes';
import { adminProgressQrMaterialAssignmentSection, adminProgressQrMaterialStatusSection } from './adminProgressQrMaterialSectionsPresentation';

export function adminProgressQrMaterialStatusModel(props: AdminProgressQrMaterialStatusProps) {
  const { isCurrent, p, report, queueState } = props;
  if (typeof isCurrent !== 'function' || typeof p !== 'function') throw TypeError('Original material report authority and production localization are required');
  if (!isSynchronouslyTrue(isCurrent)) return null;
  const section = adminProgressQrMaterialStatusSection(report, queueState, p);
  return isSynchronouslyTrue(isCurrent) ? section : null;
}
export function adminProgressQrMaterialAssignmentModel(props: AdminProgressQrMaterialAssignmentProps) {
  const { isCurrent, p, assignment, orderTitle, orderNumber, queueState, apparatusNamesById } = props;
  if (typeof isCurrent !== 'function' || typeof p !== 'function' || typeof apparatusNamesById?.get !== 'function') throw TypeError('Original material report authority, production localization and apparatus catalog are required');
  if (!isSynchronouslyTrue(isCurrent)) return null;
  const section = adminProgressQrMaterialAssignmentSection({ assignment, orderTitle, orderNumber, queueState, apparatusNamesById, p });
  return isSynchronouslyTrue(isCurrent) ? section : null;
}
