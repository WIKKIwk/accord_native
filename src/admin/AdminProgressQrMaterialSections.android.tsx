import { AdminProgressQrInfoSectionCard } from './AdminProgressQrInfoSections.android';
import type { AdminProgressQrMaterialAssignmentProps, AdminProgressQrMaterialStatusProps } from './AdminProgressQrMaterialSectionsTypes';
import { adminProgressQrMaterialAssignmentModel, adminProgressQrMaterialStatusModel } from './adminProgressQrMaterialSectionModel';

/** @v2 _RawMaterialStatusSection / _SentenceLine */
export function AdminProgressQrMaterialStatus(props: AdminProgressQrMaterialStatusProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrMaterialStatusModel(props)} />; }
/** @v2 _RawMaterialAssignmentSection */
export function AdminProgressQrMaterialAssignment(props: AdminProgressQrMaterialAssignmentProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrMaterialAssignmentModel(props)} />; }
