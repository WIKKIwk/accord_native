import { Column, Host } from '@expo/ui/jetpack-compose';
import { Children, useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number;
};

export function WorkerQueueList({ children, onRefresh, active, headerOffset, headerHeight, topInset }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);
  const onScroll = useAnimatedScrollHandler<{ previous?: number }>({
    onBeginDrag: (event, context) => { context.previous = Math.max(0, event.contentOffset.y); },
    onScroll: (event, context) => {
      const current = Math.max(0, event.contentOffset.y);
      const previous = context.previous ?? current;
      context.previous = current;
      if (!active) return;
      headerOffset.set(current === 0 ? 0 : Math.max(0, Math.min(headerHeight.get(), headerOffset.get() + current - previous)));
    },
  });

  return <Animated.FlatList style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset }} data={Children.toArray(children)}
    onScroll={onScroll} scrollEventThrottle={16} nestedScrollEnabled removeClippedSubviews={false}
    refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={topInset} onRefresh={() => { void refresh(); }} />}
    renderItem={({ item }) => <View collapsable={false}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>{item}</Column></Host></View>} />;
}
