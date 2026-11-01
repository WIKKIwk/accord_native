import { Column, Host, useMaterialColors } from '@expo/ui/jetpack-compose';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, View, type FlatList } from 'react-native';
import { GestureDetector, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, { scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { WorkerOrderListItem } from './WorkerOrderListItem';
import { WorkerOrderPalette } from './workerOrderPalette';
import { WorkerQueueFilter } from './WorkerQueueFilter';

type Props = {
  children: ReactNode; onRefresh: () => Promise<void>; active: boolean; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>;
  topInset: number; tabsHeader?: ReactNode;
};

export function WorkerQueueList({ children, onRefresh, active, pagerGesture, headerOffset, headerHeight, topInset }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const colors = useMaterialColors();
  const listRef = useAnimatedRef<FlatList<ReactNode>>();
  const scrollOffset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const pageActive = useSharedValue(active);
  const imageFrame = useRef<number | null>(null);
  const imagesScheduled = useRef(false);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: unknown }[] }) => {
    // Let the first visible order rows appear before starting thumbnail work.
    if (imagesScheduled.current || !viewableItems.some(({ item }) => isValidElement(item) && item.type === WorkerOrderListItem)) return;
    imagesScheduled.current = true;
    imageFrame.current = requestAnimationFrame(() => {
      imageFrame.current = requestAnimationFrame(() => {
        imageFrame.current = null;
        setImagesReady(true);
      });
    });
  }, []);
  const scrollGestureConfig = useMemo(() => ({ requireToFail: pagerGesture }), [pagerGesture]);
  const scrollGesture = useNativeGesture(scrollGestureConfig);
  useEffect(() => () => { if (imageFrame.current !== null) cancelAnimationFrame(imageFrame.current); }, []);
  useEffect(() => { pageActive.set(active); }, [active, pageActive]);
  // Align inactive pages near the top without changing deeper scroll positions.
  useAnimatedReaction(
    () => ({ active: pageActive.get(), header: headerOffset.get(), height: headerHeight.get(), max: Math.max(0, contentHeight.get() - viewHeight.get()) }),
    state => {
      if (state.active || viewHeight.get() <= 0 || scrollOffset.get() > state.height) return;
      const target = Math.min(state.header, state.max);
      if (Math.abs(scrollOffset.get() - target) > 0.5) {
        scrollOffset.set(target);
        scrollTo(listRef, 0, target, false);
      }
    }
  );
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
      scrollOffset.set(current);
      if (active && (context.dragging || context.momentum)) {
        const next = Math.max(0, Math.min(current, headerHeight.get(), headerOffset.get() + current - previous));
        headerOffset.set(next);
      }
    },
  });

  return <WorkerOrderPalette.Provider value={colors}><GestureDetector gesture={scrollGesture}><Animated.FlatList ref={listRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset, minHeight: viewportHeight + Math.max(0, topInset - 48) }} data={Children.toArray(children)}
    onLayout={event => { const height = event.nativeEvent.layout.height; setViewportHeight(height); viewHeight.set(height); }}
    onContentSizeChange={(_width, height) => { contentHeight.set(height); }}
    onScroll={onScroll} scrollEventThrottle={16} nestedScrollEnabled removeClippedSubviews={false} windowSize={9}
    onViewableItemsChanged={onViewableItemsChanged} extraData={imagesReady}
    refreshControl={<RefreshControl refreshing={refreshing} progressViewOffset={topInset} onRefresh={() => { void refresh(); }} />}
    renderItem={({ item }) => <View collapsable={false}>{isValidElement<{ imageActive: boolean }>(item) && item.type === WorkerOrderListItem
      ? cloneElement(item, { imageActive: item.props.imageActive && imagesReady })
      : isValidElement(item) && item.type === WorkerQueueFilter ? item
      : <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>{item}</Column></Host>}</View>} /></GestureDetector></WorkerOrderPalette.Provider>;
}
