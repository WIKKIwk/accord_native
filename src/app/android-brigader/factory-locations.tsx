import { AdminFactoryLocationsRoute } from '../../admin/AdminFactoryLocationsRouteCore';
import { BrigaderBottomBar } from '../../brigader/BrigaderBottomBar.android';
export default function BrigaderFactoryLocations() { return <AdminFactoryLocationsRoute footer={<BrigaderBottomBar active="home" />} />; }
