import { AdminQueuePoliciesRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.ios';
export default function BrigaderPage() { return <AdminQueuePoliciesRoute footer={<BrigaderBottomBar active="home" />} />; }
