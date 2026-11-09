import { Host } from '@expo/ui/swift-ui';
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { FlatList, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export type WerkaArchivePagerHandle = { scrollToPage: (page: number) => void };
const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
type Props = {
  ref?: Ref<WerkaArchivePagerHandle>;
  initialPage: number;
  pageCount: number;
  enabled: boolean;
  renderPage: (page: number) => ReactNode;
  onPageChanged: (page: number) => void;
  onPagerError: (error: unknown) => void;
};

/** Native scroll offsets, not a requested selection, are the source of month events. */
export function WerkaArchivePager({ ref, initialPage, pageCount, enabled, renderPage, onPageChanged, onPagerError }: Props) {
  const list = useRef<FlatList<number>>(null), latest = useRef({ enabled, pageCount });
  const [layout, setLayout] = useState({ width: 0, anchor: initialPage }), widthRef = useRef(0), page = useRef(initialPage);
  const anchor = useRef(initialPage), ready = useRef(false);
  const width = layout.width;
  useLayoutEffect(() => { latest.current = { enabled, pageCount }; });
  useImperativeHandle(ref, () => ({
    scrollToPage(next: number) {
      if (!latest.current.enabled || !ready.current || !list.current || !Number.isInteger(next)
        || next < 0 || next >= latest.current.pageCount) throw new Error();
      list.current.scrollToIndex({ index: next, animated: true });
    },
  }), []);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (!Number.isFinite(next) || next <= 0 || next === widthRef.current) return;
    widthRef.current = next;
    anchor.current = page.current;
    ready.current = false;
    setLayout({ width: next, anchor: page.current });
  };
  // A remounted list may briefly report page zero before its initial scroll is
  // applied. Wait for native viewability of the intended page, without emitting it.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index?: number | null; isViewable: boolean }[] }) => {
    if (width === widthRef.current && viewableItems.some(item => item.isViewable && item.index === anchor.current)) ready.current = true;
  }, [width]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    if (!latest.current.enabled || latest.current.pageCount < 1 || !Number.isFinite(contentOffset.x)
      || !Number.isFinite(layoutMeasurement.width) || layoutMeasurement.width <= 0
      || width !== widthRef.current || Math.abs(layoutMeasurement.width - width) > 0.5) return;
    const index = Math.max(0, Math.min(latest.current.pageCount - 1, Math.round(contentOffset.x / layoutMeasurement.width)));
    if (!ready.current) {
      if (index === anchor.current) ready.current = true;
      return;
    }
    if (index === page.current) return;
    page.current = index;
    onPageChanged(index);
  };
  const data = Array.from({ length: pageCount }, (_, index) => index);
  return <View style={{ height: 336, width: '100%' }} onLayout={onLayout}>
    {width > 0 ? <FlatList key={width} ref={list} data={data} horizontal pagingEnabled scrollEnabled={enabled} testID="archive_picker_month_pager"
      initialScrollIndex={layout.anchor} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      keyExtractor={String} showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll}
      onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig}
      onScrollToIndexFailed={({ index }) => onPagerError(Object.assign(new Error(), { page: index }))}
      renderItem={({ item }) => <Host style={{ width, height: 336 }} ignoreSafeArea="container">{renderPage(item)}</Host>} /> : null}
  </View>;
}
