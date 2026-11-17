import { AdminInactiveSuppliersRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderInactiveSuppliers() { return <AdminInactiveSuppliersRoute footer={<BrigaderBottomBar active="user" />} />; }
