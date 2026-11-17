import { AdminActivityRoute } from '../../admin/AdminActivityRouteCore';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderActivity() { return <AdminActivityRoute footer={<BrigaderBottomBar active="activity" />} />; }
