export type AdminItemDetailAction = 'rename' | 'customers' | 'group' | 'delete';
export type AdminItemDetailActionMenuTicket = Readonly<{ id: number; kind: 'finished' | 'combo' }>;
export const adminItemDetailActions: readonly AdminItemDetailAction[] = Object.freeze(['rename', 'customers', 'group', 'delete']);
/** @v2 _ItemDetailActionsSheet; order, Source keys and all four disabled combo rows remain visible. */
export function adminItemDetailActionMenuPresentation(kind: AdminItemDetailActionMenuTicket['kind']) {
  const combo = kind === 'combo';
  return Object.freeze({ titleKey: combo ? 'calculate.combo_actions' : 'detail.item_actions', messageKey: combo ? 'calculate.combo_actions_locked' : null,
    rows: Object.freeze(adminItemDetailActions.map(action => Object.freeze({ action, enabled: !combo,
      key: `admin-${combo ? 'combo' : 'finished'}-action-${action}`,
      labelKey: action === 'rename' ? combo ? 'calculate.combo_action_rename' : 'detail.edit_name_code' : action === 'customers' ? 'detail.manage_customers' : action === 'group' ? 'detail.change_group' : 'detail.item_delete_title',
    }))) });
}
