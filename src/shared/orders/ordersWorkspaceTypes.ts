import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import type { Session } from '../../auth';

export type OrdersTab = { id: string; name: string };
export type OrdersWorkspaceProps = {
  session: Session;
  tabs: readonly OrdersTab[];
  selected: string;
  onSelect: (id: string) => void;
  title?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  header?: ReactNode;
  headerOffset?: SharedValue<number>;
  fontFamily?: string;
  distributeTabs?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  onMenu?: () => void;
  onProfile?: () => void;
  toolbarActions?: ReactNode;
  children: (id: string, pagerGesture?: PanGesture, machinePicker?: ReactNode) => ReactNode;
};

/** A loading/empty page still renders its status content without a fake machine. */
export function visibleOrdersTabs(tabs: readonly OrdersTab[]): readonly OrdersTab[] {
  return tabs.length ? tabs : [{ id: '', name: 'Apparat' }];
}
