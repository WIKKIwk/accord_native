import { Column } from '@expo/ui/jetpack-compose';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, View, type FlatList } from 'react-native';
import { GestureDetector, useNativeGesture } from 'react-native-gesture-handler';
import Animated, { scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { OrderListItem } from './OrderListItem';
import { WorkerOrderPalette } from '../../components/workerOrderPalette';
import { BaseHost } from '../../components/BaseHost.android';
import { useBaseTheme } from '../../components/useBaseTheme';
import type { OrdersListProps } from './OrdersList.types';

export function OrdersList<T = never>({ children, footer, rows, renderRow, rowKey, onRefresh, refreshing, active, pagerGesture, headerOffset, headerHeight, topInset, passthrough, onEndReached, onScrollMetrics, scrollEnabled, scrollResetKey, headerFollowsContent, userScrollPagination, keyboardShouldPersistTaps }: OrdersListProps<T>) {
  const [refreshPending, setRefreshPending] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const { colors } = useBaseTheme();
  const listRef = useAnimatedRef<FlatList<ReactNode | T>>();
  const scrollOffset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  const pageActive = useSharedValue(active);
  const imageFrame = useRef<number | null>(null);
  const imagesScheduled = useRef(false);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: unknown; key?: string }[] }) => {
    // Let the first visible order rows appear before starting thumbnail work.
    if (imagesScheduled.current || !viewableItems.some(({ item, key }) => key?.startsWith('row:') || (isValidElement(item) && item.type === OrderListItem))) return;
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
  useEffect(() => { if (scrollResetKey !== undefined) listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [listRef, scrollResetKey]);
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
    if (!onRefresh) return;
    setRefreshPending(true);
    try { await onRefresh(); } finally { setRefreshPending(false); }
  }, [onRefresh]);
  const onScroll = useAnimatedScrollHandler<{ previous?: number; dragging?: boolean; momentum?: boolean; userScroll?: boolean; paged?: boolean }>({
    onBeginDrag: (event, context) => {
      const maxScroll = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      context.previous = Math.max(0, Math.min(maxScroll, event.contentOffset.y));
      context.dragging = true;
      context.userScroll = true;
      context.paged = false;
    },
    onEndDrag: (_event, context) => { context.dragging = false; },
    onMomentumBegin: (_event, context) => { context.momentum = true; },
    onMomentumEnd: (_event, context) => { context.momentum = false; context.userScroll = false; },
    onScroll: (event, context) => {
      const maxScroll = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      const current = Math.max(0, Math.min(maxScroll, event.contentOffset.y));
      const previous = context.previous ?? current;
      context.previous = current;
      scrollOffset.set(current);
      if (active && userScrollPagination && context.userScroll && !context.paged && (context.dragging || context.momentum) && current !== previous && maxScroll - current < userScrollPagination.distance) {
        context.paged = true;
        scheduleOnRN(userScrollPagination.loadMore);
      }
      if (active && onScrollMetrics) scheduleOnRN(onScrollMetrics, { offset: current, viewportHeight: event.layoutMeasurement.height, contentHeight: event.contentSize.height });
      if (active && headerFollowsContent) {
        headerOffset.set(Math.min(current, headerHeight.get()));
      } else if (active && (context.dragging || context.momentum)) {
        const next = Math.max(0, Math.min(current, headerHeight.get(), headerOffset.get() + current - previous));
        headerOffset.set(next);
      }
    },
  });
  const headerItems = useMemo(() => Children.toArray(children), [children]);
  const footerItems = useMemo(() => Children.toArray(footer), [footer]);
  const dataRows = rows && renderRow ? rows : undefined;
  const data = useMemo(() => [...headerItems, ...(dataRows ?? []), ...footerItems], [headerItems, dataRows, footerItems]);
  const keyExtractor = useCallback((item: ReactNode | T, index: number) => {
    const rowIndex = index - headerItems.length;
    if (dataRows && rowIndex >= 0 && rowIndex < dataRows.length) return `row:${rowKey ? rowKey(item as T, rowIndex) : rowIndex}`;
    const prefix = index >= headerItems.length + (dataRows?.length ?? 0) ? 'footer' : 'child';
    return `${prefix}:${isValidElement(item) && item.key != null ? item.key : index}`;
  }, [headerItems.length, dataRows, rowKey]);
  const renderItem = useCallback(({ item, index }: { item: ReactNode | T; index: number }) => {
    const rowIndex = index - headerItems.length;
    const element = dataRows && renderRow && rowIndex >= 0 && rowIndex < dataRows.length
      ? renderRow(item as T, rowIndex) : item as ReactNode;
    return <View collapsable={false}>{isValidElement<{ imageActive: boolean }>(element) && element.type === OrderListItem
      ? cloneElement(element, { imageActive: element.props.imageActive && imagesReady })
      : passthrough?.(element) ? element
      : <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>{element}</Column></BaseHost>}</View>;
  }, [headerItems.length, dataRows, renderRow, imagesReady, passthrough]);

  return <WorkerOrderPalette.Provider value={colors}><GestureDetector gesture={scrollGesture}><Animated.FlatList ref={listRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset, minHeight: viewportHeight + Math.max(0, topInset - 48) }} data={data} keyExtractor={keyExtractor}
    onLayout={event => { const height = event.nativeEvent.layout.height; setViewportHeight(height); viewHeight.set(height); }}
    onEndReached={onEndReached} onEndReachedThreshold={0.5}
    onContentSizeChange={(_width, height) => { contentHeight.set(height); }}
    onScroll={onScroll} scrollEventThrottle={onScrollMetrics ? 100 : 16} nestedScrollEnabled removeClippedSubviews={false} windowSize={9}
    scrollEnabled={scrollEnabled} keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    onViewableItemsChanged={onViewableItemsChanged} extraData={imagesReady}
    refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? refreshPending} progressViewOffset={topInset} onRefresh={() => { void refresh(); }} /> : undefined}
    renderItem={renderItem} /></GestureDetector></WorkerOrderPalette.Provider>;
}
