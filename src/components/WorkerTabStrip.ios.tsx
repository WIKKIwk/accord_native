import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { PlatformColor, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { WorkerTab } from './workerTabModel';

type Props = { tabs: WorkerTab[]; selected: string; onSelect: (id: string) => void };

export function WorkerTabStrip({ tabs, selected, onSelect }: Props) {
  const dark = useColorScheme() === 'dark';
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollOffset = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorVisible = useSharedValue(0);
  const laidOut = useRef(false);

  useEffect(() => {
    const layout = layouts[selected];
    if (!layout) return;

    const animate = laidOut.current;
    indicatorX.set(animate ? withTiming(layout.x, { duration: 220 }) : layout.x);
    indicatorWidth.set(animate ? withTiming(layout.width, { duration: 220 }) : layout.width);
    indicatorVisible.set(1);
    laidOut.current = true;

    const left = scrollOffset.current;
    const right = left + viewportWidth;
    if (viewportWidth > 0 && (layout.x < left || layout.x + layout.width > right)) {
      const target = layout.x < left ? layout.x : layout.x + layout.width - viewportWidth;
      scroll.current?.scrollTo({ x: Math.max(0, target), animated: animate });
    }
  }, [indicatorVisible, indicatorWidth, indicatorX, layouts, selected, viewportWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorVisible.value,
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return <View style={styles.header}>
    <View style={[styles.bar, { backgroundColor: dark ? '#242426' : '#e9e9eb' }]}>
      {isLiquidGlassAvailable() ? <GlassView pointerEvents="none" glassEffectStyle="regular" style={StyleSheet.absoluteFill} /> : null}
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} alwaysBounceHorizontal={false}
        canCancelContentTouches contentContainerStyle={styles.scrollContent}
        onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}>
        <View style={styles.row}>
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: dark ? 'rgba(255,255,255,0.19)' : 'rgba(0,0,0,0.12)' }, indicatorStyle]} />
          {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: tab.id === selected }}
            onPress={() => onSelect(tab.id)} style={styles.tab} onLayout={event => {
              const layout = event.nativeEvent.layout;
              setLayouts(current => {
                const previous = current[tab.id];
                return previous?.x === layout.x && previous.width === layout.width ? current : { ...current, [tab.id]: layout };
              });
            }}>
            <Text numberOfLines={1} style={styles.label}>{tab.name}</Text>
          </Pressable>)}
        </View>
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { height: 60, paddingVertical: 6 },
  bar: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  scrollContent: { flexGrow: 1 },
  row: { flexGrow: 1, flexDirection: 'row', padding: 3 },
  tab: { flexGrow: 1, flexShrink: 0, minHeight: 42, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  label: { color: PlatformColor('label'), fontSize: 16, fontWeight: '500' },
  indicator: { position: 'absolute', left: 0, top: 3, bottom: 3, borderRadius: 22 },
});
