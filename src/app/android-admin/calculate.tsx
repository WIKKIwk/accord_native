import { AdminHomeShortcutRoute } from '../../admin/AdminHomeShortcutRoute';
import { appRoutes } from '../../shared/appRoutes';

export default function CalculateRoute() {
  return <AdminHomeShortcutRoute route={appRoutes.adminCalculate} />;
}
