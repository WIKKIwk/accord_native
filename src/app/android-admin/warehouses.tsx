import { Redirect } from 'expo-router';
import { AdminBottomBar } from '../../admin/AdminBottomBar.android';
import { AdminWarehouseScreen } from '../../admin/AdminWarehouseScreen.android';
import { useBrigaderPage } from '../../brigader/useBrigaderPage';
import { appRoutes } from '../../shared/appRoutes';

export default function AdminWarehouses() {
  const page = useBrigaderPage(appRoutes.adminWarehouses);
  if (!page.shell.isCurrent()) return null;
  if (!page.shell.destination(appRoutes.adminWarehouses, 'android')) return <Redirect href="/" />;
  if (!page.current()) return null;
  return <AdminWarehouseScreen scope="admin" session={page.shell.session} witness={page.shell.witness} isCurrent={page.current}
    backLabel={page.backLabel} onBack={page.back} onProfile={page.profile} footer={<AdminBottomBar active="settings" />} />;
}
