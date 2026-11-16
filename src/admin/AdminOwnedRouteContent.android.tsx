import { appRoutes } from '../shared/appRoutes';
import { AdminCustomerDetailWithAssignments } from './AdminCustomerDetailWithAssignments.android';
import { AdminOwnedUsersFallback } from './AdminOwnedUsersFallback.android';
import { AdminOwnedProfileContent } from './AdminOwnedProfileContent.android';
import type { AdminOwnedRouteContentProps } from './AdminOwnedRouteContentTypes';
import { AdminProfileAvatar } from './AdminProfileAvatar.android';
import { AdminSupplierDetailRoute } from './AdminSupplierDetailRoute.android';
import { AdminSupplierItemsScreen } from './AdminSupplierItemsScreen.android';
import { AdminWerkaRoute } from './AdminWerkaRoute.android';
import { AdminWorkerDetailScreen } from './AdminWorkerDetailScreen.android';
import { AdminWorkerProfileScreen } from './AdminWorkerProfileScreen.android';
import { dartTrim } from './dartJsonString';

/** AppRouter's four real detail branches and its ordinary child pages; no return-triggered child reload is invented. */
export function AdminOwnedRouteContent(props: AdminOwnedRouteContentProps & { open: (target: Parameters<import('./adminOwnedRoutes').AdminOwnedRoutes['open']>[0]) => Promise<boolean> }) {
  const { session, witness, isCurrent, canInteract, profileAction, footer, backLabel, onBack, entry } = props, target = entry.target;
  const common = { session, witness, isCurrent, canInteract, profileAction, footer, backLabel };
  if (target.kind === 'profile') return <AdminOwnedProfileContent {...props} />;
  if (target.kind === 'supplier-items') return <AdminSupplierItemsScreen {...common} supplierRef={target.supplierRef} mode={target.mode} onBack={() => onBack(false)} />;
  if (target.kind === 'worker-profile') return <AdminWorkerProfileScreen {...common} entry={target.entry} onBack={() => onBack(false)} />;
  const item = target.ticket.item;
  if ((entry.routeName === appRoutes.adminCustomerDetail || entry.routeName === appRoutes.adminSupplierDetail) && !dartTrim(item.id)) {
    return <AdminOwnedUsersFallback {...common} onBack={() => onBack(false)} />;
  }
  const renderChat = props.providers.renderChatAction;
  const chatAction = entry.routeName !== appRoutes.adminWorkerDetail ? renderChat?.({ session, witness, entry: item, isCurrent, canInteract, onNotice: props.onNotice }) ?? undefined : undefined;
  const avatar = (value: import('./AdminProfileAvatarTypes').AdminProfileAvatarProps) => <AdminProfileAvatar {...value} />;
  switch (entry.routeName) {
    case appRoutes.adminWerka:
      return <AdminWerkaRoute {...common} onBack={onBack} renderAvatar={value => avatar({ session, witness, ...value })} chatAction={chatAction} />;
    case appRoutes.adminCustomerDetail:
      return <AdminCustomerDetailWithAssignments {...common} customerRef={dartTrim(item.id)} entry={item} onBack={onBack} chatAction={chatAction} />;
    case appRoutes.adminSupplierDetail:
      return <AdminSupplierDetailRoute {...common} supplierRef={dartTrim(item.id)} onBack={onBack} renderAvatar={value => avatar({ session, witness, ...value })} chatAction={chatAction}
        onViewItems={supplierRef => props.open({ kind: 'supplier-items', mode: 'view', supplierRef })} onAddItem={supplierRef => props.open({ kind: 'supplier-items', mode: 'add', supplierRef })} />;
    case appRoutes.adminWorkerDetail:
      return <AdminWorkerDetailScreen {...common} entry={item} onBack={onBack} renderAvatar={value => avatar({ session, witness, ...value })}
        renderChatAction={renderChat ? (childCurrent, childInteractive) => renderChat({ session, witness, entry: item, isCurrent: childCurrent, canInteract: childInteractive, onNotice: props.onNotice }) : undefined}
        onOpenActivity={worker => props.open({ kind: 'worker-profile', entry: worker })} />;
    default: return null;
  }
}
