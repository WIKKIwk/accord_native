import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AdminUserCreateScreen } from '../admin/AdminUserCreateScreen.android';
import { AdminOwnedDock } from '../admin/AdminOwnedDock.android';
import { readAdminPresentationWindowCapability, type AdminPresentationWindowCapability } from '../admin/adminPresentationWindow';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderPage } from './useBrigaderPage';

export function BrigaderUserCreateRoute() {
  const page = useBrigaderPage(appRoutes.adminUserCreate), [native, setNative] = useState<AdminPresentationWindowCapability | null>(null);
  useEffect(() => { let mounted = true; void readAdminPresentationWindowCapability('android').then(value => { if (mounted) setNative(value); }); return () => { mounted = false; }; }, []);
  if (!page.current()) return null;
  if (native?.status !== 'available') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <><AdminUserCreateScreen mode="general" session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} canInteract={page.interactive}
    onBack={page.back} backLabel={page.backLabel} onProfile={page.profile} windowObserver={native.observer} footer={<AdminOwnedDock active="user" isCurrent={page.current} canInteract={page.interactive} />} />
    <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} /></>;
}
