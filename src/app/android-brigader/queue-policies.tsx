import { AdminQueuePoliciesRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderQueuePolicies() { return <AdminQueuePoliciesRoute footer={<BrigaderBottomBar active="settings" />} />; }
