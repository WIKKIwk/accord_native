import { AdminItemGroupsRoute } from '../../admin/AdminManagementRoutes';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderItemGroups() { return <AdminItemGroupsRoute footer={<BrigaderBottomBar active="home" />} />; }
