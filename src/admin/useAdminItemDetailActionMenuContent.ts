import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemDetailActionMenuContentProps } from './AdminItemDetailActionMenuContentTypes';
import { adminItemDetailActionMenuPresentation, type AdminItemDetailAction } from './adminItemDetailActionMenuModel';

type Host = Pick<AdminItemDetailActionMenuContentProps, 'controller' | 'ticket' | 'generation' | 'canInteract' | 'onCloseRequested'>;
class ActionMenuContentLifetime {
  private readonly members = new Set<object>();
  constructor(private readonly original: Host) {}
  attach = () => { const member = {}; this.members.add(member); return () => { this.members.delete(member); }; };
  choose = (action: AdminItemDetailAction) => {
    const { controller, generation, ticket, canInteract, onCloseRequested } = this.original;
    if (!this.members.size || !controller.isCurrent(generation) || !isSynchronouslyTrue(canInteract) || !this.members.size || !controller.isCurrent(generation)) return;
    const close = controller.prepareClose(ticket, action);
    if (close && this.members.size && controller.isCurrent(generation)) onCloseRequested(close);
  };
}
/** No native close is acknowledged by this hook. Only the genuine host may complete its issued close ticket. */
export function useAdminItemDetailActionMenuContent(props: AdminItemDetailActionMenuContentProps) {
  const { controller, ticket, generation, canInteract, onCloseRequested, a } = props;
  if (typeof canInteract !== 'function' || typeof onCloseRequested !== 'function' || typeof a !== 'function') throw TypeError('The original action-menu host and text resolver are required');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const lifetime = useMemo(() => new ActionMenuContentLifetime({ controller, ticket, generation, canInteract, onCloseRequested }), [controller, ticket, generation, canInteract, onCloseRequested]);
  useLayoutEffect(() => lifetime.attach(), [lifetime]);
  const menu = state.menus.find(value => value.ticket === ticket), presentation = adminItemDetailActionMenuPresentation(ticket.kind);
  return { visible: !!menu && !state.invalidated, closing: menu?.closing ?? true, title: a(presentation.titleKey),
    message: presentation.messageKey === null ? null : a(presentation.messageKey),
    rows: presentation.rows.map(row => ({ ...row, label: a(row.labelKey) })), choose: lifetime.choose };
}
