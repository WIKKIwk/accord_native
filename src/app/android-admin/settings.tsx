import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminSettingsRoute } from '../../admin/AdminManagementRoutes';

export default function AdminSettings() {
  return <AdminSettingsRoute footer={<AdminBottomBar active="settings" />} />;
}
