import { List } from '@expo/ui';
import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number; tabsHeader?: ReactNode;
};

export function WorkerQueueList({ children, onRefresh }: Props) {
  return <List onRefresh={onRefresh}>{children}</List>;
}
