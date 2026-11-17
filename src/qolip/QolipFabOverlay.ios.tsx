import { RoleFab } from '../shared/navigation/RoleFab.ios';
import type { QolipFabAction } from './QolipFabContext';
import { useQolipRole } from './QolipRoleContext';
export function QolipFabOverlay({ actions, onSelect, resetKey }: { actions: readonly QolipFabAction[]; onSelect(id: string): void; resetKey: string }) {
  const role = useQolipRole();
  return <RoleFab actions={actions.map(action => ({ id: action.id, label: action.label, icon: action.symbol ?? 'plus', width: 288, disabled: action.disabled }))}
    onSelect={onSelect} isCurrent={role.isCurrent} bottomOffset={96} resetKey={resetKey} testIDPrefix="qolip-fab" />;
}
