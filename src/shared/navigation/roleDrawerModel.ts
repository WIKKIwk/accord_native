import type { SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';

export type RoleDrawerItem = {
  id: string;
  label: string;
  symbol?: SymbolViewProps['name'];
  supportingText?: string;
  disabled?: boolean;
};

/** Role data and navigation stay with the caller; the drawer only presents them. */
export type RoleDrawerProps = {
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  title: string;
  items: readonly RoleDrawerItem[];
  active?: string;
  footerAction?: RoleDrawerItem & { destructive?: boolean };
  closeAccessibilityLabel: string;
  children: ReactNode;
};

/** @v2 RoleNavigationDrawer: selecting the current destination only closes it. */
export function selectRoleDrawerItem(item: RoleDrawerItem, props: Pick<RoleDrawerProps, 'active' | 'onClose' | 'onSelect'>) {
  if (item.disabled) return;
  props.onClose();
  if (item.id !== props.active) props.onSelect(item.id);
}
