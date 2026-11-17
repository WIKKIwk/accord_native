import { AdminAdditionalSettingsRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderAdditionalSettings() { return <AdminAdditionalSettingsRoute footer={<BrigaderBottomBar active="settings" />} />; }
