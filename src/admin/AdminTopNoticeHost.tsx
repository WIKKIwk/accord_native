import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';
import { AdminTopNoticeContent } from './AdminTopNoticeContent';
import type { AdminTopNoticeHostProps } from './AdminTopNoticeTypes';
import { adminTopNoticeHeightCurve } from './adminTopNoticeModel';
import type { AdminTopNoticeBanner } from './adminTopNoticeModel';

function Banner({ scaffold, inlineInsets, dismissLabel }: AdminTopNoticeHostProps) {
  const banner = scaffold.banner!, { messenger, progress } = scaffold, identity = useMemo(() => ({ banner }), [banner]), mounted = useRef(false);
  const [measurement, setMeasurement] = useState<{ banner: AdminTopNoticeBanner; height: number } | null>(null), height = measurement?.banner === banner ? measurement.height : null;
  useLayoutEffect(() => { mounted.current = true; const detach = banner.attachText(identity); return () => { mounted.current = false; detach(); }; }, [banner, identity]);
  const curve = Easing.bezierFn(...adminTopNoticeHeightCurve);
  const motion = useAnimatedStyle(() => ({ height: height === null ? 0 : height * (scaffold.accessibleNavigation ? 1 : curve(Math.max(0, Math.min(1, progress.get())))), opacity: height === null ? 0 : 1 }));
  return <Animated.View style={[styles.clip, motion]} accessible accessibilityLiveRegion="polite" accessibilityLabel={banner.message}
    accessibilityActions={[{ name: 'dismiss', label: dismissLabel }]} onAccessibilityAction={event => { if (mounted.current && event.nativeEvent.actionName === 'dismiss') messenger.removeCurrent(banner); }} testID="admin-top-notice-inline">
    <View style={[styles.bottom, { left: inlineInsets.left, right: inlineInsets.right }]} onLayout={event => {
      const value = event.nativeEvent.layout.height;
      if (mounted.current && messenger.current() && scaffold.ticket && messenger.bannerFor(scaffold.ticket) === banner && Number.isFinite(value) && value > 0) setMeasurement({ banner, height: value });
    }}><AdminTopNoticeContent banner={banner} /></View>
  </Animated.View>;
}
/** Put inline between the ACTUAL header and body, outside AppShell's rounded body frame. It consumes measured height. */
export function AdminTopNoticeHost(props: AdminTopNoticeHostProps) {
  const { scaffold, inlineInsets, dismissLabel } = props;
  if (!inlineInsets || ![inlineInsets.left, inlineInsets.right].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) || typeof dismissLabel !== 'string') throw TypeError('Actual inline banner SafeArea and localized dismiss label are required');
  if (!scaffold.ticket || !scaffold.banner || !scaffold.messenger.current() || scaffold.messenger.bannerFor(scaffold.ticket) !== scaffold.banner) return null;
  return <Banner {...props} />;
}
const styles = StyleSheet.create({ clip: { width: '100%', overflow: 'hidden', flexShrink: 0 }, bottom: { position: 'absolute', bottom: 0 } });
