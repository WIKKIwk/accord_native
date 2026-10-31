import { List } from '@expo/ui';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number;
};

export function WorkerQueueList({ children, onRefresh }: Props) {
  return <List onRefresh={onRefresh}>{children}</List>;
}
