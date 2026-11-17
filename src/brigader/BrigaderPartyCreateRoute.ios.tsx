import { AdminPartyCreateScreen } from '../admin/AdminPartyCreateScreen.ios';
import { BrigaderBottomBar } from './BrigaderBottomBar.ios';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderPage } from './useBrigaderPage';

export function BrigaderPartyCreateRoute({ kind }: { kind: 'supplier' | 'customer' }) {
  const page = useBrigaderPage(kind === 'supplier' ? appRoutes.adminSupplierCreate : appRoutes.adminCustomerCreate);
  if (!page.current()) return null;
  return <AdminPartyCreateScreen kind={kind} session={page.shell.session} witness={page.shell.witness} locale={page.locale}
    isCurrent={page.current} canInteract={page.interactive} onBack={page.back} onCreated={page.back} onProfile={page.profile} backLabel={page.backLabel}
    footer={<BrigaderBottomBar active={kind === 'supplier' ? 'user' : 'settings'} />} />;
}
