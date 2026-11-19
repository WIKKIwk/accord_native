import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export type OrdersListScrollMetrics = { offset: number; viewportHeight: number; contentHeight: number };
export type OrdersListGeometry = Omit<OrdersListScrollMetrics, 'offset'>;

export type OrdersListProps<T = never> = {
  children: ReactNode;
  footer?: ReactNode;
  rows?: readonly T[];
  renderRow?: (row: T, index: number) => ReactNode;
  rowKey?: (row: T, index: number) => string;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
  refreshEnabled?: boolean;
  active: boolean;
  pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>;
  headerHeight: SharedValue<number>;
  topInset: number;
  onEndReached?: () => void;
  onScrollMetrics?: (metrics: OrdersListScrollMetrics) => void;
  onGeometryChange?: (geometry: OrdersListGeometry) => void;
  scrollEnabled?: boolean;
  scrollResetKey?: number;
  headerFollowsContent?: boolean;
  userScrollPagination?: { distance: number; loadMore: () => void };
  passthrough?: (item: ReactNode) => boolean;
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled';
};
