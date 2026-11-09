import type { AndroidSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { supplierDockIntent, supplierDockItems, type SupplierDockDestination, type SupplierDockState } from './supplierNavigationModel';
import { useSupplierText } from './useSupplierOverview';

export function SupplierDock({ activeTab, chatActive = false, onSelect }: {
  activeTab: SupplierDockState['activeTab']; chatActive?: boolean; onSelect: (destination: SupplierDockDestination) => void;
}) {
  const { l } = useSupplierText(), insets = useSafeAreaInsets();
  // Notifications, Create and Chat are held for security; no unread count is fabricated.
  const state: SupplierDockState = { activeTab, chatActive, centerActive: false, primaryVisible: false };
  const items: RoleNavigationItem[] = supplierDockItems(l, state).filter(item => item.id !== 'chat' && item.id !== 'notifications').map(item => ({ id: item.id, label: item.label,
    icon: item.icon.android as AndroidSymbol, ...(item.showBadge === undefined ? {} : { showBadge: item.showBadge }) }));
  const active = supplierDockItems(l, state).find(item => item.active)?.id ?? '';
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    const intent = supplierDockIntent(id as SupplierDockDestination, state); if (intent) onSelect(intent.destination);
  }} />;
}
