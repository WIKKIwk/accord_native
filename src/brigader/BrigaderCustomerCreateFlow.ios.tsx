import { AdminUserCreateScreen } from '../admin/AdminUserCreateScreen.ios';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
export function BrigaderCustomerCreateFlow() {
  const page = useBrigaderFeature(appRoutes.adminUserCreate), args = page.args as { initialName?: string } | undefined;
  if (!page.current()) return null;
  return <AdminUserCreateScreen mode="customer" initialName={args?.initialName} session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} canInteract={page.interactive}
    onBack={page.back} backLabel={page.backLabel} onProfile={page.profile} onCreated={customer => page.back(customer)} />;
}
