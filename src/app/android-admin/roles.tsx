import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminRolesRoute } from '../../admin/AdminManagementRoutes';
export default function AdminRoles() { return <AdminRolesRoute footer={<AdminBottomBar active="settings" />} />; }
