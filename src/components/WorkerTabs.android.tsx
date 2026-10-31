import { Box, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, onGloballyPositioned, padding, selectable, testID } from '@expo/ui/jetpack-compose/modifiers';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getWorkerTabs, type WorkerTab, type WorkerTabsProps } from './workerTabModel';

type TabLayout = { x: number; width: number };

export function WorkerTabs(props: WorkerTabsProps) {
  const tabs = getWorkerTabs(props.machines);
  return <NativeWorkerTabs key={JSON.stringify(tabs.map(tab => tab.id))} {...props} tabs={tabs} />;
}

function NativeWorkerTabs({ tabs, selected, onSelect, loading, children, header, headerOffset }: WorkerTabsProps & { tabs: WorkerTab[] }) {
  const colors = useMaterialColors();
  const defaultHeaderOffset = useSharedValue(0);
  const offset = headerOffset ?? defaultHeaderOffset;
  const lastSelection = useRef(selected);
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selected));
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const currentPage = useRef(selectedIndex);
  const previousPageWidth = useRef(0);
  const tabScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const layouts = useSharedValue<TabLayout[]>([]);
  const labelWidths = useSharedValue<number[]>([]);
  const pagePosition = useSharedValue(selectedIndex);
  const fixedWidth = tabs.length <= 2 && barWidth > 0 ? barWidth / tabs.length : undefined;

  useEffect(() => {
    if (lastSelection.current !== selected) {
      offset.set(withTiming(0, { duration: 160 }));
      lastSelection.current = selected;
    }
    if (pageWidth && (currentPage.current !== selectedIndex || previousPageWidth.current !== pageWidth)) {
      pager.current?.scrollTo({ x: selectedIndex * pageWidth, animated: previousPageWidth.current === pageWidth });
      currentPage.current = selectedIndex;
      previousPageWidth.current = pageWidth;
    }
    const tab = layouts.get()[selectedIndex];
    if (tab) tabScroll.current?.scrollTo({ x: Math.max(0, tab.x + tab.width / 2 - barWidth / 2), animated: true });
  }, [selected, selectedIndex, barWidth, layouts, pageWidth, offset]);

  // Apply measurements atomically on the UI thread. Reading then replacing
  // the array on JS can lose another tab's still-pending measurement.
  const recordTabLayout = useCallback((index: number, layout: TabLayout) => {
    if (layout.width <= 0) return;
    layouts.modify(current => {
      'worklet';
      const previous = current[index];
      if (previous?.x === layout.x && previous.width === layout.width) return current;
      const next = [...current];
      next[index] = layout;
      return next;
    }, false);
  }, [layouts]);

  const recordLabelWidth = useCallback((index: number, width: number) => {
    if (width <= 0) return;
    labelWidths.modify(current => {
      'worklet';
      if (current[index] === width) return current;
      const next = [...current];
      next[index] = width;
      return next;
    }, false);
  }, [labelWidths]);

  const onPageScroll = useAnimatedScrollHandler(event => {
    const width = event.layoutMeasurement.width;
    if (width > 0) pagePosition.set(event.contentOffset.x / width);
  });

  const indicatorMotion = useAnimatedStyle(() => {
    const position = Math.max(0, Math.min(tabs.length - 1, pagePosition.value));
    const from = Math.floor(position);
    const to = Math.ceil(position);
    // Fixed tabs have known bounds even before the first native layout event.
    const first = layouts.value[from] ?? (fixedWidth ? { x: from * fixedWidth, width: fixedWidth } : undefined);
    const last = layouts.value[to] ?? (fixedWidth ? { x: to * fixedWidth, width: fixedWidth } : undefined);
    if (!first || !last) return { opacity: 0, width: 24, transform: [{ translateX: 0 }] };
    const firstWidth = Math.min(Math.max(24, labelWidths.value[from] ?? 24), first.width - 32);
    const lastWidth = Math.min(Math.max(24, labelWidths.value[to] ?? 24), last.width - 32);
    const fraction = position - from;
    const firstX = first.x + (first.width - firstWidth) / 2;
    const lastX = last.x + (last.width - lastWidth) / 2;
    return {
      opacity: 1,
      width: firstWidth + (lastWidth - firstWidth) * fraction,
      transform: [{ translateX: firstX + (lastX - firstX) * fraction }],
    };
  });
  const headerMotion = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.value }] }));

  return <View style={styles.container}>
    {loading ? <ActivityIndicator style={styles.loading} /> : null}
    <Animated.ScrollView ref={pager} style={styles.pager} horizontal pagingEnabled nestedScrollEnabled removeClippedSubviews={false}
      showsHorizontalScrollIndicator={false} onScroll={onPageScroll} scrollEventThrottle={16}
      onLayout={event => {
        setPageWidth(event.nativeEvent.layout.width);
        setPageHeight(event.nativeEvent.layout.height);
      }}
      onMomentumScrollEnd={event => {
          const width = event.nativeEvent.layoutMeasurement.width;
          if (!width) return;
          const page = Math.round(event.nativeEvent.contentOffset.x / width);
          currentPage.current = page;
          if (tabs[page]) onSelect(tabs[page].id);
        }} testID="worker-tab-pager">
      {pageWidth > 0 && pageHeight > 0 ? tabs.map(tab => <View key={tab.id} style={{ width: pageWidth, height: pageHeight }}>{children(tab.id)}</View>) : null}
    </Animated.ScrollView>
    <Animated.View style={[styles.headerOverlay, headerMotion]}>
    <View style={{ backgroundColor: colors.surfaceContainerLow }}>{header}</View>
    <View style={[styles.tabBar, { backgroundColor: colors.surfaceContainerLow }]} onLayout={event => setBarWidth(event.nativeEvent.layout.width)}>
      {/* Host.matchContents is mount-only: measure the row before mounting Hosts. */}
      {barWidth > 0 ? <ScrollView ref={tabScroll} horizontal scrollEnabled={tabs.length > 2} showsHorizontalScrollIndicator={false}>
        <View style={[styles.tabRow, fixedWidth ? { width: barWidth } : undefined]}>
          {tabs.map((tab, index) => <View key={tab.id} style={fixedWidth ? { width: fixedWidth } : undefined}
            onLayout={event => recordTabLayout(index, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })}>
            <Host key={tabs.length <= 2 ? 'fixed' : 'scrollable'} matchContents={tabs.length <= 2 ? false : { horizontal: true }}
              style={[styles.tabHost, fixedWidth ? { width: fixedWidth } : undefined]}>
              <Box contentAlignment="center" modifiers={[
                height(48), fixedWidth ? fillMaxWidth() : defaultMinSize({ minWidth: 90 }),
                selectable(selectedIndex === index, () => onSelect(tab.id), 'tab'),
                testID(`worker-tab-${tab.id}`), padding(16, 0, 16, 0),
              ]}>
                <Text color={selectedIndex === index ? colors.primary : colors.onSurfaceVariant}
                  style={{ typography: 'titleSmall' }} maxLines={1} overflow="ellipsis"
                  modifiers={[onGloballyPositioned(({ width }) => recordLabelWidth(index, width))]}>{tab.name}</Text>
              </Box>
            </Host>
          </View>)}
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.primary }, indicatorMotion]} />
        </View>
      </ScrollView> : null}
    </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  tabBar: { height: 48 },
  tabRow: { flexDirection: 'row', height: 48 },
  tabHost: { height: 48 },
  indicator: { position: 'absolute', left: 0, bottom: 0, height: 3, borderRadius: 3 },
  pager: { flex: 1 },
  loading: { padding: 20 },
});
