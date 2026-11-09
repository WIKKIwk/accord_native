import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useBaseTheme } from '../components/useBaseTheme';
import type { BoyoqchiPaintPaletteProps } from './boyoqchiPaintPaletteTypes';

type Usage = BoyoqchiPaintPaletteProps['usage'];
/** @v2 ReturnedPaintSheet: palette pages allow a horizontal usage swipe. */
export function BoyoqchiUsageSwipe({ usage, onUsage, disabled, children }: {
  usage: Usage; onUsage: (usage: Usage) => void; disabled: boolean; children: ReactNode;
}) {
  const { width } = useWindowDimensions(), { direction } = useBaseTheme();
  const latest = useRef({ usage, onUsage, disabled }), mounted = useRef(false);
  useLayoutEffect(() => { latest.current = { usage, onUsage, disabled }; }, [usage, onUsage, disabled]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selectDirection = useCallback((step: number) => {
    const current = latest.current;
    if (!mounted.current || current.disabled) return;
    const target: Usage = step > 0 ? 'astatka' : 'rasxot';
    if (target !== current.usage) current.onUsage(target);
  }, []);
  const pan = usePanGesture({ enabled: !disabled, activeOffsetX: [-16, 16], failOffsetY: [-10, 10],
    onDeactivate: event => {
      'worklet';
      if (event.canceled) return;
      const fast = Math.abs(event.velocityX) >= 400;
      if (!fast && Math.abs(event.translationX) < Math.max(40, width * 0.25)) return;
      const delta = fast ? event.velocityX : event.translationX;
      if (!Number.isFinite(delta) || delta === 0) return;
      const step = (delta < 0) === (direction !== 'rightToLeft') ? 1 : -1;
      scheduleOnRN(selectDirection, step);
    } });
  return <GestureHandlerRootView style={{ width: '100%' }}><GestureDetector gesture={pan}>
    <View collapsable={false}>{children}</View>
  </GestureDetector></GestureHandlerRootView>;
}
