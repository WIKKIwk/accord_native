import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleFab } from '../shared/navigation/RoleFab.android';
import type { QolipFabAction } from './QolipFabContext';
import { useQolipRole } from './QolipRoleContext';
export function QolipFabOverlay({ actions, onSelect, resetKey }: { actions: readonly QolipFabAction[]; onSelect(id: string): void; resetKey: string }) {
  const role = useQolipRole(), insets = useSafeAreaInsets();
  return <RoleFab actions={actions.map(action => ({ ...action, icon: action.icon ?? 'add', width: 288 }))}
    onSelect={id => { if (role.isCurrent()) onSelect(id); }} bottomOffset={insets.bottom + 96} resetKey={resetKey} testIDPrefix="qolip-fab" />;
}
