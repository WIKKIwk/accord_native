import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminInactiveSuppliersRoute } from '../../admin/AdminManagementRoutes';

export default function AdminInactiveSuppliers() {
  return <AdminInactiveSuppliersRoute footer={<AdminBottomBar active="user" />} />;
}
