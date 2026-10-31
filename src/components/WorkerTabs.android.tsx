import { Box, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, onGloballyPositioned, padding, selectable, testID } from '@expo/ui/jetpack-compose/modifiers';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { getWorkerTabs, type WorkerTab, type WorkerTabsProps } from './workerTabModel';

type TabLayout = { x: number; width: number };

export function WorkerTabs(props: WorkerTabsProps) {
  const tabs = useMemo(() => getWorkerTabs(props.machines), [props.machines]);
  return <NativeWorkerTabs key={JSON.stringify(tabs.map(tab => tab.id))} {...props} tabs={tabs} />;
}

function NativeWorkerTabs({ tabs, selected, onSelect, loading, children, header, headerOffset, fontFamily }: WorkerTabsProps & { tabs: WorkerTab[] }) {
  const colors = useMaterialColors();
  const defaultHeaderOffset = useSharedValue(0);
  const offset = headerOffset ?? defaultHeaderOffset;
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selected));
  const currentPage = useRef(selectedIndex);
  const tabScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const layouts = useSharedValue<TabLayout[]>([]);
  const labelWidths = useSharedValue<number[]>([]);
  const pagePosition = useSharedValue(selectedIndex);
  const gestureStartPage = useSharedValue(selectedIndex);
  const fixedWidth = tabs.length <= 2 && barWidth > 0 ? barWidth / tabs.length : undefined;

  useEffect(() => {
    if (currentPage.current !== selectedIndex) {
      pagePosition.set(withTiming(selectedIndex, { duration: 200 }));
      currentPage.current = selectedIndex;
    }
    const tab = layouts.get()[selectedIndex];
    if (tab) tabScroll.current?.scrollTo({ x: Math.max(0, tab.x + tab.width / 2 - barWidth / 2), animated: true });
  }, [selectedIndex, barWidth, layouts, pagePosition]);

  const selectSwipedPage = useCallback((index: number) => {
    currentPage.current = index;
    if (tabs[index]) onSelect(tabs[index].id);
  }, [onSelect, tabs]);
  const pagerGestureConfig = useMemo<PanGestureConfig>(() => ({
    enabled: tabs.length > 1 && pageWidth > 0,
    activeOffsetX: [-24, 24],
    failOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      cancelAnimation(pagePosition);
      gestureStartPage.set(Math.round(pagePosition.get()));
    },
    onUpdate: event => {
      'worklet';
      const start = gestureStartPage.get();
      pagePosition.set(Math.max(Math.max(0, start - 1), Math.min(Math.min(tabs.length - 1, start + 1), start - event.translationX / pageWidth)));
    },
    onDeactivate: event => {
      'worklet';
      const start = gestureStartPage.get();
      const enoughDistance = Math.abs(event.translationX) >= pageWidth * 0.25;
      const quickSwipe = Math.abs(event.translationX) >= 32 && Math.abs(event.velocityX) >= 600;
      const direction = event.translationX < 0 ? 1 : -1;
      const target = event.canceled || (!enoughDistance && !quickSwipe)
        ? start : Math.max(0, Math.min(tabs.length - 1, start + direction));
      pagePosition.set(withTiming(target, { duration: 200 }));
      scheduleOnRN(selectSwipedPage, target);
    },
  }), [tabs.length, pageWidth, pagePosition, gestureStartPage, selectSwipedPage]);
  const pagerGesture = usePanGesture(pagerGestureConfig);

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
  const pageMotion = useAnimatedStyle(() => ({ transform: [{ translateX: -pagePosition.value * pageWidth }] }));

  return <View style={styles.container}>
    {loading ? <ActivityIndicator style={styles.loading} /> : null}
    <View style={styles.pager}
      onLayout={event => {
        setPageWidth(event.nativeEvent.layout.width);
        setPageHeight(event.nativeEvent.layout.height);
      }} testID="worker-tab-pager">
      <GestureDetector gesture={pagerGesture}>
        <Animated.View style={[styles.pages, { width: pageWidth * tabs.length }, pageMotion]}>
          {pageWidth > 0 && pageHeight > 0 ? tabs.map(tab => <View key={tab.id} collapsable={false} style={{ width: pageWidth, height: pageHeight }}>{children(tab.id, pagerGesture)}</View>) : null}
        </Animated.View>
      </GestureDetector>
    </View>
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
                  style={{ typography: 'titleSmall', fontFamily }} maxLines={1} overflow="ellipsis"
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
  pager: { flex: 1, overflow: 'hidden' },
  pages: { flexDirection: 'row' },
  loading: { padding: 20 },
});
