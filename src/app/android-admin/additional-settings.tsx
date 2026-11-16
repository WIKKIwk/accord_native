import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminAdditionalSettingsRoute } from '../../admin/AdminManagementRoutes';

export default function AdminAdditionalSettings() {
  return <AdminAdditionalSettingsRoute footer={<AdminBottomBar active="settings" />} />;
}
