import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';

export type SupplierRootDestination = 'home' | 'notifications' | 'recent' | 'chat';
export type SupplierDockDestination = SupplierRootDestination | 'create';
export type SupplierDockState = {
  activeTab: 'home' | 'notifications' | 'recent' | null;
  centerActive: boolean;
  chatActive: boolean;
  primaryVisible: boolean;
  notificationUnread: boolean;
  chatUnreadCount: number;
};
export type SupplierDockItem = {
  id: SupplierDockDestination;
  label: string;
  icon: { ios: string; android: string };
  active: boolean;
  primary?: boolean;
  showBadge?: boolean;
};

type Label = (key: string) => string;

/** @v2 SupplierNavigationDrawer */
export function supplierDrawerItems(l: Label): RoleDrawerItem[] {
  return [
    { id: 'home', label: l('homeNavTitle'), symbol: { ios: 'house', android: 'home' } },
    { id: 'notifications', label: l('notificationsShortTitle'), symbol: { ios: 'bell', android: 'notifications' } },
    { id: 'recent', label: l('historyNavTitle'), symbol: { ios: 'clock.arrow.circlepath', android: 'history' } },
    { id: 'profile', label: l('profileTitle'), symbol: { ios: 'person', android: 'person' } },
  ];
}

/** @v2 SupplierDock, RoleDock */
export function supplierDockItems(l: Label, state: SupplierDockState): SupplierDockItem[] {
  return [
    { id: 'home', label: l('homeNavTitle'), icon: { ios: 'house', android: 'home' },
      active: !state.chatActive && state.activeTab === 'home' && !state.centerActive },
    { id: 'notifications', label: l('notificationsShortTitle'), icon: { ios: 'bell', android: 'notifications' },
      active: !state.chatActive && state.activeTab === 'notifications',
      showBadge: state.notificationUnread && state.activeTab !== 'notifications' },
    ...(state.primaryVisible ? [{ id: 'create' as const, label: l('createNavTitle'), icon: { ios: 'plus', android: 'add' },
      active: !state.chatActive && state.centerActive, primary: true }] : []),
    { id: 'recent', label: l('historyNavTitle'), icon: { ios: 'clock.arrow.circlepath', android: 'history' },
      active: !state.chatActive && state.activeTab === 'recent' },
    { id: 'chat', label: 'Chat', icon: { ios: 'bubble.left', android: 'chat_bubble' },
      active: state.chatActive, showBadge: state.chatUnreadCount > 0 },
  ];
}

/** Root destinations use V2's pop-to-existing-or-push navigation; Create pushes the picker. */
export function supplierDockIntent(destination: SupplierDockDestination, state: SupplierDockState):
  { kind: 'root'; destination: SupplierRootDestination } | { kind: 'push'; destination: 'create' } | null {
  if (destination === 'create') return !state.primaryVisible || state.centerActive ? null : { kind: 'push', destination };
  if (destination === 'chat') return state.chatActive ? null : { kind: 'root', destination };
  if (!state.chatActive && state.activeTab === destination && (destination !== 'home' || !state.centerActive)) return null;
  return { kind: 'root', destination };
}
