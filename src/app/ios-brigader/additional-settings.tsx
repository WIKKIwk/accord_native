import { AdminAdditionalSettingsRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.ios';
export default function BrigaderPage() { return <AdminAdditionalSettingsRoute footer={<BrigaderBottomBar active="home" />} />; }
