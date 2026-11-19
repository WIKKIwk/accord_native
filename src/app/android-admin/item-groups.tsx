import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminItemGroupsRoute } from '../../admin/AdminManagementRoutes';

export default function AdminItemGroups() {
  return <AdminItemGroupsRoute footer={<AdminBottomBar active="settings" />} />;
}
