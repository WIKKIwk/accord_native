import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { AdminWarehouseScreen } from '../admin/AdminWarehouseScreen.android';
import { AdminOwnedDock } from '../admin/AdminOwnedDock.android';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderPage } from './useBrigaderPage';

export function BrigaderWarehouseRoute() {
  const page = useBrigaderPage(appRoutes.adminWarehouses);
  if (!page.current()) return null;
  return <><AdminWarehouseScreen scope="admin" session={page.shell.session} witness={page.shell.witness} isCurrent={page.current}
    onBack={page.back} backLabel={page.backLabel} onProfile={page.profile} footer={<AdminOwnedDock active="home" isCurrent={page.current} canInteract={page.interactive} />} />
    <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} /></>;
}
