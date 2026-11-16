import type { AdminCustomerDetailScreenProps } from './AdminCustomerDetailScreenTypes';

/** Held composition has real subordinate owners; navigation/profile/dock actions remain host-owned. */
export type AdminCustomerDetailWithAssignmentsProps = Omit<AdminCustomerDetailScreenProps, 'renderAvatar' | 'renderApparatusCard' | 'renderMaterialWarehouseEditor'>;
