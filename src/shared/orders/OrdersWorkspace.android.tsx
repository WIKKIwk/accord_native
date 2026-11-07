import { Box, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, onSizeChanged, padding, testID } from '@expo/ui/jetpack-compose/modifiers';
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture, type PanGestureConfig } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, scrollTo, useAnimatedRef, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { visibleOrdersTabs, type OrdersWorkspaceProps, type OrdersTab } from './ordersWorkspaceTypes';

type TabLayout = { x: number; width: number };

const NativeTab = memo(function NativeTab({ tab, index, selected, fixedWidth, fontFamily, pagePosition, goToPage, recordTabLayout, recordLabelWidth }: {
  tab: OrdersTab; index: number; selected: boolean; fixedWidth?: number; fontFamily?: string;
  pagePosition: SharedValue<number>; goToPage: (index: number) => void;
  recordTabLayout: (index: number, layout: TabLayout) => void; recordLabelWidth: (index: number, width: number) => void;
}) {
  const colors = useMaterialColors();
  const tapConfig = useMemo(() => ({
    maxDistance: 14,
    onActivate: () => {
      'worklet';
      goToPage(index);
    },
  }), [goToPage, index]);
  const tap = useTapGesture(tapConfig);
  // Both title colours stay mounted and cross-fade with the pager position, so the
  // colour moves in the same frame as the underline and needs no React render.
  const idleLabel = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pagePosition.get() - index)) }));
  const activeLabel = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(pagePosition.get() - index)) }));
  // Measured outside the detector: a view inside it reports x = 0 for every tab, which
  // would leave the underline and the bar scroll on the first tab.
  return <View style={fixedWidth ? { width: fixedWidth } : undefined}
    onLayout={event => recordTabLayout(index, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })}>
    <GestureDetector gesture={tap}>
      <View style={fixedWidth ? { width: fixedWidth } : undefined}
        accessible accessibilityRole="tab" accessibilityLabel={tab.name} accessibilityState={{ selected }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') scheduleOnUI(goToPage, index); }}>
        <Animated.View style={idleLabel}>
          <Host key={fixedWidth ? 'fixed' : 'scrollable'} matchContents={fixedWidth ? false : { horizontal: true }}
            style={[styles.tabHost, fixedWidth ? { width: fixedWidth } : undefined]}>
            <Box contentAlignment="center" modifiers={[
              height(48), fixedWidth ? fillMaxWidth() : defaultMinSize({ minWidth: 90 }),
              testID(`worker-tab-${tab.id}`), padding(16, 0, 16, 0),
            ]}>
              {/* Not onGloballyPositioned: it sends a JS event for every tab on every frame the bar moves. */}
              <Text color={colors.onSurfaceVariant}
                style={{ typography: 'titleSmall', fontFamily }} maxLines={1} overflow="ellipsis"
                modifiers={[onSizeChanged(({ width }) => recordLabelWidth(index, width))]}>{tab.name}</Text>
            </Box>
          </Host>
        </Animated.View>
        <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, activeLabel]}>
          <Host style={styles.activeTabHost}>
            <Box contentAlignment="center" modifiers={[height(48), fillMaxWidth(), padding(16, 0, 16, 0)]}>
              <Text color={colors.primary} style={{ typography: 'titleSmall', fontFamily }} maxLines={1} overflow="ellipsis">{tab.name}</Text>
            </Box>
          </Host>
        </Animated.View>
      </View>
    </GestureDetector>
  </View>;
});

export function OrdersWorkspace(props: OrdersWorkspaceProps) {
  const tabs = useMemo(() => visibleOrdersTabs(props.tabs), [props.tabs]);
  return <NativeOrdersTabs key={JSON.stringify(tabs.map(tab => tab.id))} {...props} tabs={tabs} />;
}

function NativeOrdersTabs({ tabs, selected, onSelect, loading, children, header, headerOffset, fontFamily, distributeTabs }: OrdersWorkspaceProps & { tabs: readonly OrdersTab[] }) {
  const colors = useMaterialColors();
  const defaultHeaderOffset = useSharedValue(0);
  const offset = headerOffset ?? defaultHeaderOffset;
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selected));
  const selectedId = tabs[selectedIndex]?.id;
  const currentPage = useRef(selectedIndex);
  const lastSelectedId = useRef(selectedId);
  // Ids this bar asked the screen to select that have not come back through `selected` yet.
  const requested = useRef<string[]>([]);
  const tabStrip = useAnimatedRef<Animated.ScrollView>();
  const [barWidth, setBarWidth] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const layouts = useSharedValue<TabLayout[]>([]);
  const labelWidths = useSharedValue<number[]>([]);
  const pagePosition = useSharedValue(selectedIndex);
  const gestureStartPage = useSharedValue(selectedIndex);
  const gestureStartPosition = useSharedValue(selectedIndex);
  const fixedWidth = barWidth > 0 && (tabs.length <= 2 || (distributeTabs && barWidth / tabs.length >= 90)) ? barWidth / tabs.length : undefined;

  const selectPage = useCallback((index: number) => {
    const tab = tabs[index];
    if (!tab || currentPage.current === index) return;
    currentPage.current = index;
    requested.current = [...requested.current.slice(-31), tab.id];
    startTransition(() => onSelect(tab.id));
  }, [onSelect, tabs]);

  // Everything visible (pager, underline, title colour, bar scroll) runs on the UI thread.
  // The screen hears about the page only after the slide: Reanimated stops committing
  // from any React commit until that commit is mounted, so rendering the queues during
  // the slide would freeze it.
  const goToPage = useCallback((index: number, releaseVelocity?: number) => {
    'worklet';
    const tab = layouts.get()[index];
    if (tab) scrollTo(tabStrip, Math.max(0, tab.x + tab.width / 2 - barWidth / 2), 0, true);
    const onSettled = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(selectPage, index);
    };
    pagePosition.set(releaseVelocity === undefined
      ? withTiming(index, { duration: 200 }, onSettled)
      // A released swipe carries on at the finger's speed instead of restarting from
      // rest. Same no-bounce spring as Compose's pager (stiffness 400, damping ratio 1).
      : withSpring(index, { stiffness: 400, damping: 40, mass: 1, overshootClamping: true, energyThreshold: 1e-5, velocity: releaseVelocity }, onSettled));
  }, [barWidth, layouts, pagePosition, selectPage, tabStrip]);

  // Follow `selected` only when it was changed from outside this bar (QR scan, first
  // load). An older choice of ours arriving late must not pull the pager back while a
  // newer one is animating or being dragged.
  useEffect(() => {
    if (lastSelectedId.current === selectedId) return;
    lastSelectedId.current = selectedId;
    const queue = requested.current;
    const own = selectedId === undefined ? -1 : queue.indexOf(selectedId);
    if (own >= 0) {
      requested.current = queue.slice(own + 1);
      return;
    }
    requested.current = [];
    if (currentPage.current === selectedIndex) return;
    currentPage.current = selectedIndex;
    scheduleOnUI(goToPage, selectedIndex);
  }, [selectedId, selectedIndex, goToPage]);

  const pagerGestureConfig = useMemo<PanGestureConfig>(() => ({
    enabled: tabs.length > 1 && pageWidth > 0,
    activeOffsetX: [-16, 16],
    failOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      cancelAnimation(pagePosition);
      // Grabbing a page mid-slide continues from where it is, without a jump.
      gestureStartPosition.set(pagePosition.get());
      gestureStartPage.set(Math.round(pagePosition.get()));
    },
    onUpdate: event => {
      'worklet';
      const page = gestureStartPage.get();
      pagePosition.set(Math.max(Math.max(0, page - 1), Math.min(Math.min(tabs.length - 1, page + 1), gestureStartPosition.get() - event.translationX / pageWidth)));
    },
    onDeactivate: event => {
      'worklet';
      const page = gestureStartPage.get();
      const position = pagePosition.get();
      let target = page;
      if (!event.canceled) {
        // A flick goes the way the finger was moving at release, even after a reversal.
        if (Math.abs(event.velocityX) >= 400) target = event.velocityX < 0 ? Math.ceil(position) : Math.floor(position);
        else if (Math.abs(position - page) >= 0.25) target = position > page ? page + 1 : page - 1;
      }
      goToPage(Math.max(0, Math.min(tabs.length - 1, target)), -event.velocityX / pageWidth);
    },
  }), [tabs.length, pageWidth, pagePosition, gestureStartPage, gestureStartPosition, goToPage]);
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
      {barWidth > 0 ? <Animated.ScrollView ref={tabStrip} horizontal scrollEnabled={!fixedWidth} showsHorizontalScrollIndicator={false}>
        <View style={[styles.tabRow, fixedWidth ? { width: barWidth } : undefined]}>
          {tabs.map((tab, index) => <NativeTab key={tab.id} tab={tab} index={index} selected={selectedIndex === index}
            fixedWidth={fixedWidth} fontFamily={fontFamily} pagePosition={pagePosition} goToPage={goToPage}
            recordTabLayout={recordTabLayout} recordLabelWidth={recordLabelWidth} />)}
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.primary }, indicatorMotion]} />
        </View>
      </Animated.ScrollView> : null}
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
  activeTabHost: { width: '100%', height: 48 },
  indicator: { position: 'absolute', left: 0, bottom: 0, height: 3, borderRadius: 3 },
  pager: { flex: 1, overflow: 'hidden' },
  pages: { flexDirection: 'row' },
  loading: { padding: 20 },
});
