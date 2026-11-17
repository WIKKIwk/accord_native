import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { useBrigaderApparatusDock } from './useBrigaderApparatusDock';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
export function BrigaderApparatusDock({ primary = true,actions,active = '' }: { primary?:boolean;actions?:readonly AdminMenuAction[];active?:string }) {
  const model = useBrigaderApparatusDock(), insets = useSafeAreaInsets();
  return <>{primary ? <BrigaderPrimaryAction isCurrent={model.page.current} canInteract={model.page.interactive} actions={actions ?? model.actions} /> : null}<RoleBottomBar active={active} items={model.items} onSelect={id => { const item = model.items.find(item => item.id === id); if (item && item.id !== active) model.open(item.route); }} bottomInset={insets.bottom} /></>;
}
