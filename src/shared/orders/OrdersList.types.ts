import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export type OrdersListProps<T = never> = {
  children: ReactNode;
  footer?: ReactNode;
  rows?: readonly T[];
  renderRow?: (row: T, index: number) => ReactNode;
  rowKey?: (row: T, index: number) => string;
  onRefresh: () => Promise<void>;
  active: boolean;
  pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>;
  headerHeight: SharedValue<number>;
  topInset: number;
  onEndReached?: () => void;
  passthrough?: (item: ReactNode) => boolean;
};
