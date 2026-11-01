import { List, Section } from '@expo/ui/swift-ui';
import { listStyle, refreshable, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number; tabsHeader?: ReactNode;
};

export function WorkerQueueList({ children, onRefresh, tabsHeader }: Props) {
  return <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(onRefresh)]}>
    {tabsHeader ? <Section header={tabsHeader}>{children}</Section> : children}
  </List>;
}
