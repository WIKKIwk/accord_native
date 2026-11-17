import { AdminInactiveSuppliersRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.ios';
export default function BrigaderPage() { return <AdminInactiveSuppliersRoute footer={<BrigaderBottomBar active="user" />} />; }
