import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';
import { AdminTopNoticeContent } from './AdminTopNoticeContent';
import type { AdminTopNoticeHostProps } from './AdminTopNoticeTypes';
import { adminTopNoticeHeightCurve } from './adminTopNoticeModel';
import type { AdminTopNoticeBanner } from './adminTopNoticeModel';

function Banner({ scaffold, inlineInsets, dismissLabel }: AdminTopNoticeHostProps) {
  const banner = scaffold.banner!, { messenger, progress } = scaffold, identity = useMemo(() => ({ banner }), [banner]), mounted = useRef(false);
  const left = inlineInsets?.left, right = inlineInsets?.right, width = inlineInsets?.width, known = inlineInsets !== null;
  const geometry = useMemo(() => Object.freeze({ left, right, width, known }), [left, right, width, known]), committed = useRef<typeof geometry | null>(null);
  const [measurement, setMeasurement] = useState<{ banner: AdminTopNoticeBanner; geometry: typeof geometry; height: number } | null>(null),
    height = known && measurement?.banner === banner && measurement.geometry === geometry ? measurement.height : null;
  useLayoutEffect(() => { committed.current = geometry; return () => { if (committed.current === geometry) committed.current = null; }; }, [geometry]);
  useLayoutEffect(() => { mounted.current = true; const detach = banner.attachText(identity); return () => { mounted.current = false; detach(); }; }, [banner, identity]);
  const current = () => {
    if (!mounted.current || !geometry.known || committed.current !== geometry || messenger.current() !== true || !scaffold.ticket) return false;
    const original = messenger.bannerFor(scaffold.ticket) === banner;
    return original && mounted.current && committed.current === geometry;
  };
  const curve = Easing.bezierFn(...adminTopNoticeHeightCurve);
  const motion = useAnimatedStyle(() => ({ height: height === null ? 0 : height * (scaffold.accessibleNavigation ? 1 : curve(Math.max(0, Math.min(1, progress.get())))), opacity: height === null ? 0 : 1 }));
  return <Animated.View style={[styles.clip, motion]} pointerEvents={known ? 'auto' : 'none'} accessible={known} accessibilityLiveRegion={known ? 'polite' : 'none'} accessibilityLabel={known ? banner.message : undefined}
    accessibilityElementsHidden={!known} importantForAccessibility={known ? 'auto' : 'no-hide-descendants'}
    accessibilityActions={known ? [{ name: 'dismiss', label: dismissLabel }] : undefined} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'dismiss' && current()) messenger.removeCurrent(banner); }} testID="admin-top-notice-inline">
    <View style={[styles.bottom, { left, right }]} onLayout={event => {
      const value = event.nativeEvent.layout.height, measuredWidth = event.nativeEvent.layout.width;
      if (!Number.isFinite(value) || value <= 0) return;
      // Scoped callers provide their actual full-window width. One logical point allows native layout rounding; this is not a native window-frame receipt.
      if (geometry.width !== undefined && (!Number.isFinite(measuredWidth) || measuredWidth <= 0 || Math.abs(measuredWidth - (geometry.width - geometry.left! - geometry.right!)) > 1)) return;
      if (current()) setMeasurement({ banner, geometry, height: value });
    }}><AdminTopNoticeContent banner={banner} /></View>
  </Animated.View>;
}
/** Put inline between the ACTUAL header and body, outside AppShell's rounded body frame. It consumes measured height. */
export function AdminTopNoticeHost(props: AdminTopNoticeHostProps) {
  const { scaffold, inlineInsets, dismissLabel } = props;
  if (inlineInsets !== null && (!inlineInsets || ![inlineInsets.left, inlineInsets.right].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
    inlineInsets.width !== undefined && (typeof inlineInsets.width !== 'number' || !Number.isFinite(inlineInsets.width) || inlineInsets.width <= inlineInsets.left + inlineInsets.right)) || typeof dismissLabel !== 'string') throw TypeError('Actual inline banner SafeArea and localized dismiss label are required');
  if (!scaffold.ticket || !scaffold.banner || !scaffold.messenger.current() || scaffold.messenger.bannerFor(scaffold.ticket) !== scaffold.banner) return null;
  return <Banner {...props} />;
}
const styles = StyleSheet.create({ clip: { width: '100%', overflow: 'hidden', flexShrink: 0 }, bottom: { position: 'absolute', bottom: 0 } });
