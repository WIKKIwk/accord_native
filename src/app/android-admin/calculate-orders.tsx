import { AdminHomeShortcutRoute } from '../../admin/AdminHomeShortcutRoute';
import { appRoutes } from '../../shared/appRoutes';

export default function CalculateOrdersRoute() {
  return <AdminHomeShortcutRoute route={appRoutes.adminCalculateOrders} />;
}
