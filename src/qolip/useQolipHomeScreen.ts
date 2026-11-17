import { useQolipRole } from './QolipRoleContext';
import { useQolipFab, type QolipFabAction } from './QolipFabContext';
import { useGuardedQolipHome } from './useGuardedQolipHome';
import { useQolipHomeActions } from './useQolipHomeActions';

export function useQolipHomeScreen() {
  const role = useQolipRole(), model = useGuardedQolipHome(role.session, role.boundary), actions = useQolipHomeActions(model);
  const fabActions: QolipFabAction[] = actions.fabActions.map(action => ({ ...action,
    icon: action.id === 'issue' ? 'person_add_alt_1' : action.id === 'scan' ? 'qr_code_scanner' : 'add_location_alt',
    symbol: action.id === 'issue' ? 'person.badge.plus' : action.id === 'scan' ? 'qrcode.viewfinder' : 'plus.square' }));
  useQolipFab(fabActions, actions.selectFab, role.isCurrent() && !!model.actions);
  return { role, model, actions };
}
