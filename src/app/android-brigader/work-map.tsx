import { AdminWorkMapRoute } from '../../admin/AdminWorkMapRoute';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderWorkMap() { return <AdminWorkMapRoute footer={<BrigaderBottomBar active="home" />} />; }
