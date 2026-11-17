import { useEffect, useState } from 'react';
import { readAdminPresentationWindowCapability, type AdminPresentationWindowObserver } from '../admin/adminPresentationWindow';
import { AdminUserCreateScreen } from '../admin/AdminUserCreateScreen.android';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
export function BrigaderCustomerCreateFlow() {
  const page = useBrigaderFeature(appRoutes.adminUserCreate), args = page.args as { initialName?: string } | undefined;
  const [observer, setObserver] = useState<AdminPresentationWindowObserver | null>(null);
  useEffect(() => { let active = true; void readAdminPresentationWindowCapability('android').then(value => { if (active && value.status === 'available') setObserver(value.observer); }); return () => { active = false; }; }, []);
  if (!observer) return null;
  if (!page.current()) return null;
  return <AdminUserCreateScreen mode="customer" initialName={args?.initialName} session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} canInteract={page.interactive}
    onBack={page.back} backLabel={page.backLabel} onProfile={page.profile} onCreated={customer => page.back(customer)} windowObserver={observer} />;
}
