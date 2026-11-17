import { AdminActivityRoute } from '../../admin/AdminActivityRouteCore';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.ios';
export default function BrigaderPage() { return <AdminActivityRoute footer={<BrigaderBottomBar active="activity" />} />; }
