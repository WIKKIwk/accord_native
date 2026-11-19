import { Redirect } from 'expo-router';
import { useAdminHomeShortcutRoute } from '../../admin/useAdminHomeShortcutRoute';
import { BrigaderCalculate } from '../../brigader/BrigaderCalculate';
import { appRoutes } from '../../shared/appRoutes';

/** @v2 AdminCalculateScreen */
export default function CalculateRoute() {
  const { current, shortcut } = useAdminHomeShortcutRoute(appRoutes.adminCalculate);
  if (!current) return null;
  return shortcut ? <BrigaderCalculate /> : <Redirect href="/" />;
}
