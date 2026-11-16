import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemDetailActionMenuContentProps } from './AdminItemDetailActionMenuContentTypes';
import { adminItemDetailActionMenuPresentation, type AdminItemDetailAction } from './adminItemDetailActionMenuModel';

type Host = Pick<AdminItemDetailActionMenuContentProps, 'surfaceIdentity' | 'controller' | 'ticket' | 'generation' | 'isCurrent' | 'canInteract' | 'onCloseRequested'>;
class ActionMenuContentLifetime {
  private readonly members = new Set<object>(); private retired = false; private checking = false;
  private readonly original: Host;
  constructor(props: Host) { this.original = Object.freeze({ ...props }); }
  matches = (props: Host) => Object.keys(this.original).every(key => props[key as keyof Host] === this.original[key as keyof Host]);
  commit = (props: Host) => { if (!this.matches(props)) this.retired = true; };
  attach = () => { const member = {}; this.members.add(member); return () => { this.members.delete(member); }; };
  private current = () => {
    if (this.retired) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const valid = isSynchronouslyTrue(() => this.original.controller.isCurrent(this.original.generation)) && isSynchronouslyTrue(this.original.isCurrent) && isSynchronouslyTrue(() => this.original.controller.isCurrent(this.original.generation)); this.checking = false;
    if (!valid || this.retired) { this.retired = true; return false; } return true;
  };
  choose = (action: AdminItemDetailAction) => {
    const { controller, generation, ticket, canInteract, onCloseRequested } = this.original;
    if (!this.members.size || !this.current() || !isSynchronouslyTrue(canInteract) || !this.members.size || !this.current()) return;
    const close = controller.prepareClose(ticket, action);
    // Closing publication may synchronously remove the body while the ORIGINAL
    // native shell survives. Its accepted ticket still needs the genuine host.
    if (close && this.current() && controller.isClosePending(close, ticket, generation)) {
      try { void Promise.resolve(onCloseRequested(close)).catch(() => {}); } catch { /* Host failure never fabricates a native ACK or child action. */ }
    }
  };
}
/** No native close is acknowledged by this hook. Only the genuine host may complete its issued close ticket. */
export function useAdminItemDetailActionMenuContent(props: AdminItemDetailActionMenuContentProps) {
  const { surfaceIdentity, controller, ticket, isCurrent, canInteract, onCloseRequested, a } = props;
  if (!surfaceIdentity || typeof surfaceIdentity !== 'object' || Array.isArray(surfaceIdentity) || typeof isCurrent !== 'function' || typeof canInteract !== 'function' || typeof onCloseRequested !== 'function' || typeof a !== 'function') throw TypeError('The original action-menu host and text resolver are required');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  // A retained native window cannot adopt another account/controller/callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lifetime = useMemo(() => new ActionMenuContentLifetime({ surfaceIdentity, controller, ticket, generation: props.generation, isCurrent, canInteract, onCloseRequested }), [surfaceIdentity]);
  useLayoutEffect(() => lifetime.attach(), [lifetime]);
  useLayoutEffect(() => lifetime.commit(props));
  const menu = state.menus.find(value => value.ticket === ticket), presentation = adminItemDetailActionMenuPresentation(ticket.kind);
  return { visible: lifetime.matches(props) && !!menu && !state.invalidated, closing: menu?.closing ?? true, title: a(presentation.titleKey),
    message: presentation.messageKey === null ? null : a(presentation.messageKey),
    rows: presentation.rows.map(row => ({ ...row, label: a(row.labelKey) })), choose: lifetime.choose };
}
