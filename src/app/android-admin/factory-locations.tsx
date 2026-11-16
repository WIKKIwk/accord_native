import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminFactoryLocationsRoute } from '../../admin/AdminFactoryLocationsRouteCore';

export default function AdminFactoryLocations() {
  return <AdminFactoryLocationsRoute footer={<AdminBottomBar active="home" />} />;
}
