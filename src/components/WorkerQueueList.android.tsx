import { Column, Host } from '@expo/ui/jetpack-compose';
import { Children, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { GestureDetector, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number;
};

export function WorkerQueueList({ children, onRefresh, active, pagerGesture, headerOffset, headerHeight, topInset }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const ownHeaderOffset = useSharedValue(0);
  const scrollGestureConfig = useMemo(() => ({ requireToFail: pagerGesture }), [pagerGesture]);
  const scrollGesture = useNativeGesture(scrollGestureConfig);
  useEffect(() => {
    if (active) headerOffset.set(withTiming(ownHeaderOffset.get(), { duration: 160 }));
  }, [active, headerOffset, ownHeaderOffset]);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);
  const onScroll = useAnimatedScrollHandler<{ previous?: number; dragging?: boolean; momentum?: boolean }>({
    onBeginDrag: (event, context) => {
      const maxScroll = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      context.previous = Math.max(0, Math.min(maxScroll, event.contentOffset.y));
      context.dragging = true;
    },
    onEndDrag: (_event, context) => { context.dragging = false; },
    onMomentumBegin: (_event, context) => { context.momentum = true; },
    onMomentumEnd: (_event, context) => { context.momentum = false; },
    onScroll: (event, context) => {
      const maxScroll = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      const current = Math.max(0, Math.min(maxScroll, event.contentOffset.y));
      const previous = context.previous ?? current;
      context.previous = current;
      const previousHeader = ownHeaderOffset.get();
      let next = Math.min(current, headerHeight.get(), previousHeader);
      if (active && (context.dragging || context.momentum)) {
        next = Math.max(0, Math.min(current, headerHeight.get(), previousHeader + current - previous));
      }
      ownHeaderOffset.set(next);
      if (active && (context.dragging || context.momentum || next !== previousHeader)) headerOffset.set(next);
    },
  });

  return <GestureDetector gesture={scrollGesture}><Animated.FlatList style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset }} data={Children.toArray(children)}
    onScroll={onScroll} scrollEventThrottle={16} nestedScrollEnabled removeClippedSubviews={false}
    refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={topInset} onRefresh={() => { void refresh(); }} />}
    renderItem={({ item }) => <View collapsable={false}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>{item}</Column></Host></View>} /></GestureDetector>;
}
