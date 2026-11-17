import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminItemDetailDecisionContent } from '../admin/AdminItemDetailDecisionContent';
import { AdminItemDetailCustomerContent } from '../admin/AdminItemDetailCustomerContent';
import { AdminItemDetailActionMenuContent } from '../admin/AdminItemDetailActionMenuContent';
import { createAdminItemDetailActionMenus, type AdminItemDetailActionMenuClose, type AdminItemDetailActionMenuController, type AdminItemDetailActionMenu } from '../admin/adminItemDetailActionMenuController';
import type { AdminItemDetailCloseTicket, AdminItemDetailDecisionDialog } from '../admin/adminItemDetailDecisionController';
import type { AdminItemDetailReadContext, AdminItemDetailPresentations } from '../admin/AdminItemDetailReadTypes';
import { BrigaderDialog } from './BrigaderDialog';
import { BrigaderSheet } from './BrigaderSheet';
import { useBrigaderFixedSnackBars } from './BrigaderFeedbackProvider';

function DecisionBody({ context, dialog, current, interactive, shown, close }: { context: AdminItemDetailReadContext; dialog: AdminItemDetailDecisionDialog; current: () => boolean; interactive: () => boolean; shown: boolean; close: (ticket: AdminItemDetailCloseTicket) => void }) {
  const window = useWindowDimensions(), insets = useSafeAreaInsets(), [identity] = useState(() => ({})), locale = localeController.locale;
  useEffect(() => { if (shown && dialog.kind === 'customers' && interactive()) context.controller.activateCustomers(dialog.id); }, [shown, context.controller, dialog.id, dialog.kind, interactive]);
  const props = { surfaceIdentity: identity, controller: context.controller, dialogId: dialog.id, kind: dialog.kind, generation: context.generation, isCurrent: current, canInteract: interactive, onCloseRequested: close,
    a: (key: string, values?: Record<string, unknown>) => adminText(key, locale, values), t: (key: string) => localizedGetter(key, locale), viewport: { width: window.width, height: window.height, paddingBottom: insets.bottom } };
  return dialog.kind === 'customers' ? <AdminItemDetailCustomerContent {...props} kind="customers" /> : dialog.kind === 'group' ? <AdminItemDetailDecisionContent {...props} kind="group" /> : <AdminItemDetailDecisionContent {...props} kind={dialog.kind} />;
}
function Decision({ context, dialog, onRemoved }: { context: AdminItemDetailReadContext; dialog: AdminItemDetailDecisionDialog; onRemoved: () => void }) {
  const [identity] = useState(() => ({})), closing = useRef<AdminItemDetailCloseTicket | null>(null);
  const current = useCallback(() => context.isCurrent() && context.controller.isCurrent(context.generation) && context.controller.getSnapshot().dialogs.some(item => item.id === dialog.id), [context, dialog.id]);
  const close = useCallback((ticket: AdminItemDetailCloseTicket) => { if (current() && ticket.id === dialog.id) closing.current = ticket; }, [current, dialog.id]);
  const dismiss = useCallback(() => { if (!current()) return; const ticket = context.controller.prepareClose(dialog.id, false); if (ticket) closing.current = ticket; }, [context.controller, current, dialog.id]);
  const detached = useCallback(() => { const ticket = closing.current; closing.current = null; if (!ticket || !current()) return; void context.controller.completeClose(ticket).then(result => { if (result.removed && context.isCurrent()) onRemoved(); }); }, [context, current, onRemoved]);
  const Surface = dialog.kind === 'group' || dialog.kind === 'customers' ? BrigaderSheet : BrigaderDialog;
  return <Surface identity={identity} current={current} closing={dialog.closing} dismiss={dismiss} detached={detached} maxWidth={dialog.kind === 'edit' ? 420 : undefined}>
    {(interactive, shown) => <DecisionBody context={context} dialog={dialog} current={current} interactive={interactive} shown={shown} close={close} />}
  </Surface>;
}
function Menu({ owner, menu, context }: { owner: AdminItemDetailActionMenuController; menu: AdminItemDetailActionMenu; context: AdminItemDetailReadContext }) {
  const [identity] = useState(() => ({})), close = useRef<AdminItemDetailActionMenuClose | null>(null), generation = owner.interactionGeneration;
  const current = useCallback(() => context.isCurrent() && owner.isCurrent(generation) && owner.getSnapshot().menus.some(item => item.ticket === menu.ticket), [context, owner, generation, menu.ticket]);
  const accepted = useCallback((ticket: AdminItemDetailActionMenuClose) => { if (current()) close.current = ticket; }, [current]);
  const dismiss = useCallback(() => { if (current()) { const ticket = owner.prepareClose(menu.ticket, null); if (ticket) close.current = ticket; } }, [owner, menu.ticket, current]);
  const detached = useCallback(() => { const ticket = close.current; close.current = null; if (ticket && current()) void owner.completeClose(ticket); }, [owner, current]);
  return <BrigaderSheet identity={identity} current={current} closing={menu.closing} dismiss={dismiss} detached={detached}>{interactive => <AdminItemDetailActionMenuContent surfaceIdentity={identity} controller={owner} ticket={menu.ticket} generation={generation} isCurrent={current} canInteract={interactive} onCloseRequested={accepted} a={key => adminText(key, localeController.locale)} />}</BrigaderSheet>;
}
function Surfaces({ context, menus, onRemoved }: { context: AdminItemDetailReadContext; menus: AdminItemDetailActionMenuController; onRemoved: () => void }) {
  const state = useSyncExternalStore(context.controller.subscribe, context.controller.getSnapshot, context.controller.getSnapshot), menuState = useSyncExternalStore(menus.subscribe, menus.getSnapshot, menus.getSnapshot), fixed = useBrigaderFixedSnackBars();
  useLayoutEffect(() => { menus.start(); return () => menus.dispose(); }, [menus]);
  useEffect(() => {
    const notice = state.notice; if (!notice || !context.isCurrent()) return;
    const fallback = notice.kind === 'raw' ? notice.message : notice.kind === 'customer' ? adminText('detail.customer_save_failed', localeController.locale, { error: String(notice.error).replace('Exception: ', '') }) : adminText(notice.key, localeController.locale);
    const text = notice.kind === 'operation' ? String(notice.error).replace('Exception: ', '').trim() || fallback : fallback;
    fixed.enqueue({ identity: notice, message: text }); context.controller.dismissNotice(notice.serial);
  }, [context, state.notice, fixed]);
  return <>{menuState.menus.map(menu => <Menu key={menu.ticket.id} context={context} owner={menus} menu={menu} />)}{state.dialogs.map(dialog => <Decision key={`${context.generation}:${dialog.id}`} context={context} dialog={dialog} onRemoved={onRemoved} />)}</>;
}
class PresentationOwners {
  private readonly owners = new WeakMap<AdminItemDetailReadContext['controller'], AdminItemDetailActionMenuController>();
  get(context: AdminItemDetailReadContext) {
    let menus = this.owners.get(context.controller);
    if (!menus) { menus = createAdminItemDetailActionMenus(context.controller); this.owners.set(context.controller, menus); }
    return menus;
  }
}
export function useBrigaderItemDetailPresentations(onRemoved: () => void): AdminItemDetailPresentations {
  const [owners] = useState(() => new PresentationOwners());
  return useMemo(() => ({ render: (context: AdminItemDetailReadContext) => <Surfaces context={context} menus={owners.get(context)} onRemoved={onRemoved} />,
    onActions: (context, detail) => { if (context.canInteract()) owners.get(context).request(detail); } }), [owners, onRemoved]);
}
