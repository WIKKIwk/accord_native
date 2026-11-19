import { AdminHomeShortcutRoute } from '../../../admin/AdminHomeShortcutRoute';
import { appRoutes } from '../../../shared/appRoutes';

export default function FactoryMapRoute() {
  return <AdminHomeShortcutRoute route={appRoutes.adminFactoryMap} />;
}
