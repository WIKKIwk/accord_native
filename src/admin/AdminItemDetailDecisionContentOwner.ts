import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemDetailCloseTicket, AdminItemDetailDecisionDialog } from './adminItemDetailDecisionController';
import type { AdminItemDetailDecisionContentProps, AdminItemDetailDecisionHost, AdminItemDetailDecisionViewport } from './AdminItemDetailDecisionContentTypes';
import { adminItemDetailDecisionGroups, adminItemDetailDecisionSurface, adminItemDetailDecisionViewport, adminItemDetailDeleteValues } from './AdminItemDetailDecisionPresentation';
import { dartTrim } from './dartJsonString';

let nextBufferIdentity = 0;

/** Captures one original native content/decision identity; it never owns native removal or parent disposal. */
export class AdminItemDetailDecisionContentLifetime {
  /** React buffer identity only; never a native window/readiness ticket. */
  readonly bufferIdentity = ++nextBufferIdentity;
  private readonly members = new Set<object>(); private retired = false; private checking = false;
  private matched = true; private viewport: AdminItemDetailDecisionViewport | null = null;
  readonly original: AdminItemDetailDecisionHost; readonly initialDialog: AdminItemDetailDecisionDialog | null;
  readonly initialDraft: Readonly<{ code: string; name: string }> | null;
  constructor(props: AdminItemDetailDecisionHost) {
    if (!props.surfaceIdentity || typeof props.surfaceIdentity !== 'object' || Array.isArray(props.surfaceIdentity) || !Number.isInteger(props.dialogId) || props.dialogId <= 0 || !Number.isInteger(props.generation) || props.generation < 0 ||
      !['edit', 'delete', 'group', 'customers'].includes(props.kind) || !props.controller || [props.isCurrent, props.canInteract, props.onCloseRequested, props.controller.isCurrent, props.controller.getSnapshot, props.controller.prepareClose].some(value => typeof value !== 'function')) throw TypeError('Original decision controller and genuine native surface host are required');
    this.original = Object.freeze({ ...props });
    const dialog = props.controller.getSnapshot().dialogs.find(value => value.id === props.dialogId && value.kind === props.kind) ?? null;
    this.initialDialog = dialog;
    this.initialDraft = dialog?.kind === 'edit' ? props.controller.editValues(dialog.id) : null;
  }
  matches(props: AdminItemDetailDecisionHost) {
    return ['surfaceIdentity', 'controller', 'dialogId', 'kind', 'generation', 'isCurrent', 'canInteract', 'onCloseRequested'].every(key => props[key as keyof AdminItemDetailDecisionHost] === this.original[key as keyof AdminItemDetailDecisionHost]);
  }
  attach = (props: AdminItemDetailDecisionHost, viewport: AdminItemDetailDecisionViewport | null) => {
    if (!this.matches(props)) { this.retired = true; return () => {}; }
    this.matched = true; this.viewport = viewport; const member = {}; this.members.add(member); let detached = false;
    return () => { if (detached) return; detached = true; this.members.delete(member); };
  };
  commit = (props: AdminItemDetailDecisionHost, viewport: AdminItemDetailDecisionViewport | null) => {
    this.matched = this.matches(props); if (!this.matched) this.retired = true; this.viewport = viewport;
  };
  dialog = () => {
    const dialog = this.original.controller.getSnapshot().dialogs.find(value => value.id === this.original.dialogId && value.kind === this.original.kind);
    return dialog && this.initialDialog && dialog.detail === this.initialDialog.detail ? dialog : null;
  };
  readCurrent = () => {
    if (this.retired || !this.matched || !this.initialDialog) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const valid = isSynchronouslyTrue(() => this.original.controller.isCurrent(this.original.generation)) && isSynchronouslyTrue(this.original.isCurrent); this.checking = false;
    if (!valid || this.retired || !isSynchronouslyTrue(() => this.original.controller.isCurrent(this.original.generation)) || !this.dialog()) { this.retired = true; return false; } return true;
  };
  canInteract = () => {
    const sheet = this.original.kind === 'group' || this.original.kind === 'customers';
    if (!this.members.size || sheet && this.viewport === null || !this.readCurrent() || this.dialog()?.closing) return false;
    if (this.checking) { this.retired = true; return false; } this.checking = true;
    const allowed = isSynchronouslyTrue(this.original.canInteract); this.checking = false;
    return allowed && this.members.size > 0 && this.readCurrent() && !this.dialog()?.closing && this.original.controller.getSnapshot().dialogs.at(-1)?.id === this.original.dialogId;
  };
  close = (confirm: boolean) => {
    if (typeof confirm !== 'boolean' || !this.canInteract()) return;
    const ticket = this.original.controller.prepareClose(this.original.dialogId, confirm); if (!ticket) return;
    // A valid accepted event may publish closing and unmount content before this handoff returns.
    // Only the ORIGINAL host gets the opaque ticket; this does not acknowledge native removal.
    if (!this.readCurrent() || !this.dialog()?.closing) return;
    this.handoff(ticket);
  };
  private handoff(ticket: AdminItemDetailCloseTicket) { try { void Promise.resolve(this.original.onCloseRequested(ticket)).catch(() => {}); } catch { /* No close success or command is fabricated on host failure. */ } }
  changeEdit = (field: 'code' | 'name', value: string) => { if (this.original.kind === 'edit' && typeof value === 'string' && this.canInteract()) this.original.controller.changeEdit(this.original.dialogId, field, value); };
  save = (code: string, name: string) => {
    if (this.original.kind !== 'edit' || typeof code !== 'string' || typeof name !== 'string' || !this.canInteract()) return;
    this.changeEdit('code', code); this.changeEdit('name', name); this.close(true);
  };
  changeQuery = (query: string) => { if (this.original.kind === 'group' && typeof query === 'string' && this.canInteract()) this.original.controller.changeGroupQuery(this.original.dialogId, query); };
  chooseGroup = (group: string, query: string) => {
    if (!this.canInteract()) return; const dialog = this.dialog();
    if (dialog?.kind !== 'group' || dialog.query !== query || !adminItemDetailDecisionGroups(dialog).some(row => row.value === group)) return;
    this.original.controller.selectGroup(this.original.dialogId, group);
  };
}

export function useAdminItemDetailDecisionContent(props: AdminItemDetailDecisionContentProps) {
  if (typeof props.a !== 'function' || typeof props.t !== 'function') throw TypeError('Original Source text resolvers are required');
  const { surfaceIdentity, controller, a } = props;
  // Same native window cannot adopt a newer controller/account/callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lifetime = useMemo(() => new AdminItemDetailDecisionContentLifetime(props), [surfaceIdentity]);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const viewport = props.kind === 'group' ? adminItemDetailDecisionViewport(props.viewport) : null;
  useLayoutEffect(() => lifetime.attach(props, viewport), [lifetime]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => lifetime.commit(props, viewport));
  const dialog = lifetime.dialog(), visible = lifetime.matches(props) && lifetime.readCurrent();
  const titleKey = props.kind === 'edit' ? 'detail.item_edit' : props.kind === 'delete' ? 'detail.item_delete_title' : 'detail.item_group_select';
  return { lifetime, dialog, visible, closing: dialog?.closing ?? true, title: a(titleKey), surface: adminItemDetailDecisionSurface(props.kind), viewport,
    initialDraft: lifetime.initialDraft, validation: dialog?.kind === 'edit' && dialog.validation ? a(dialog.validation) : null,
    deleteMessage: dialog?.kind === 'delete' ? a('detail.item_delete_message', adminItemDetailDeleteValues(dialog)) : null,
    groups: dialog?.kind === 'group' ? adminItemDetailDecisionGroups(dialog) : [], query: dialog?.kind === 'group' ? dialog.query : '',
    applyEnabled: dialog?.kind === 'group' && !!dartTrim(dialog.selected) && !dialog.closing,
    close: lifetime.close, save: lifetime.save, changeEdit: lifetime.changeEdit, changeQuery: lifetime.changeQuery, chooseGroup: lifetime.chooseGroup,
  };
}
export type AdminItemDetailDecisionContentModel = ReturnType<typeof useAdminItemDetailDecisionContent>;
