import { AdminItemGroupsRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.ios';
export default function BrigaderPage() { return <AdminItemGroupsRoute footer={<BrigaderBottomBar active="home" />} />; }
