import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { AdminUserCreateScreen } from '../admin/AdminUserCreateScreen.ios';
import { AdminOwnedDock } from '../admin/AdminOwnedDock.ios';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderPage } from './useBrigaderPage';

export function BrigaderUserCreateRoute() {
  const page = useBrigaderPage(appRoutes.adminUserCreate);
  if (!page.current()) return null;
  return <><AdminUserCreateScreen mode="general" session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} canInteract={page.interactive}
    onBack={page.back} backLabel={page.backLabel} onProfile={page.profile} footer={<AdminOwnedDock active="user" isCurrent={page.current} canInteract={page.interactive} />} />
    <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} /></>;
}
