import { List } from '@expo/ui/swift-ui';
import { listStyle, refreshable, scrollContentBackground, scrollEdgeEffectStyle } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number; onEndReached?: () => void; passthrough?: (item: ReactNode) => boolean;
};

export function OrdersList({ children, onRefresh }: Props) {
  return <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), scrollEdgeEffectStyle('soft', 'top'), refreshable(onRefresh)]}>
    {children}
  </List>;
}
