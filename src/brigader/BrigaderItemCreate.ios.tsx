import { useCallback } from 'react';
import { AdminItemCreateScreen } from '../admin/AdminItemCreateScreen.ios';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { useBrigaderFixedSnackBars } from './BrigaderFeedbackProvider';
import { BrigaderBottomBar } from './BrigaderBottomBar.ios';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import type { SupplierItem } from '../shared/catalogApi';
import type { AdminItemCreateCustomer } from '../admin/adminItemCreateModel';

export function BrigaderItemCreate({ bulk = false }: { bulk?: boolean }) {
  const page = useBrigaderFeature(bulk ? appRoutes.adminItemBulkMove : appRoutes.adminItemCreate), flows = useBrigaderFlows(), fixed = useBrigaderFixedSnackBars();
  const { current, interactive } = page;
  const openItem = useCallback(async (item: SupplierItem) => { await flows.open({ route: appRoutes.adminItemDetail, args: item.code }, { isCurrent: current, canInteract: interactive }); }, [flows, current, interactive]);
  const createCustomer = useCallback(async (name: string) => (await flows.open<AdminItemCreateCustomer>({ route: appRoutes.adminUserCreate, args: { customerOnly: true, initialName: name } }, { isCurrent: current, canInteract: current })) ?? null, [flows, current]);
  const args = page.args as { initialTabIndex?: number; initialItemGroup?: string; openCreateDialog?: boolean; returnOnCreate?: boolean } | number | undefined;
  if (!page.current()) return null;
  return <AdminItemCreateScreen session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} canInteract={page.interactive}
    initialTabIndex={typeof args === 'number' ? args : args?.initialTabIndex ?? 0} initialItemGroup={typeof args === 'object' ? args.initialItemGroup : undefined}
    openCreateDialog={typeof args === 'object' ? args.openCreateDialog : undefined} returnOnCreate={typeof args === 'object' ? args.returnOnCreate : undefined}
    onReturnCreated={item => page.back(item)} onOpenItem={openItem} onCreateCustomer={createCustomer} onBack={page.back} backLabel={page.backLabel}
    sourceScaffoldAncestor={null} topNoticeDismissLabel={localizedGetter('closeAction', page.locale)} fixedSnackBars={fixed}
    profileAction={<AdminShellProfileAction />} footer={<BrigaderBottomBar active="settings" primary={false} />} renderPrimaryAction={props => <BrigaderPrimaryAction {...props} />} />;
}
