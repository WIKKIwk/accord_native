import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useBaseTheme } from '../components/useBaseTheme';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { createAdminItemDetailImageProvider } from './adminItemDetailImageProvider';
import { adminItemDetailImageDataUri } from './AdminItemDetailReadPresentation';
import type { AdminItemDetailReadContext } from './AdminItemDetailReadTypes';

/** Real scoped bytes + native decode-triggered180ms linear fade. Known Open: Source ImageFade retains
 * outgoing image/placeholder layers and distinguishes synchronous decoded-cache frames. RN onLoad
 * exposes neither that synchronous flag nor an equivalent retained Flutter ImageState receipt;
 * provider-key replacement currently remounts this inner native image over an opaque placeholder.
 * This bounded native adaptation is not an exact AnimatedSwitcher/gaplessPlayback port. */
export function AdminItemDetailThumbnail({ context, imageUrl, testID }: { context: AdminItemDetailReadContext; imageUrl: string; testID: string }) {
  // Source constructs OrderImageProvider in the actual parent build. Its equality key includes the
  // 30s unversioned-image epoch. Decode-state rebuilds belong to the child and must not refresh it.
  const candidate = imageUrl ? createAdminItemDetailImageProvider(context.session, context.witness, context.isCurrent, imageUrl) : null, key = candidate?.key ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const provider = useMemo(() => candidate, [context.session, context.witness, context.isCurrent, imageUrl, key]);
  return <ThumbnailImage key={key} provider={provider} current={context.isCurrent} testID={testID} />;
}
function ThumbnailImage({ provider, current, testID }: { provider: ReturnType<typeof createAdminItemDetailImageProvider> | null; current: () => boolean; testID: string }) {
  const { colors } = useBaseTheme(), alpha = useSharedValue(0), live = useRef<object | null>(null);
  const [source, setSource] = useState<Readonly<{ provider: typeof provider; uri: string; identity: object }> | null>(null), [failed, setFailed] = useState<object | null>(null);
  useEffect(() => {
    const identity = {}; live.current = identity; alpha.set(0);
    if (provider) {
      const publish = (bytes: Uint8Array) => { if (live.current === identity && isSynchronouslyTrue(current)) setSource({ provider, uri: adminItemDetailImageDataUri(bytes), identity }); };
      try { const cached = provider.peek(); if (cached?.length) publish(cached); else void provider.load().then(publish, () => {}).catch(() => {}); } catch { /* Same Source placeholder on read or image failure. */ }
    }
    return () => { if (live.current === identity) live.current = null; };
  }, [provider, current, alpha]);
  const opacity = useAnimatedStyle(() => ({ opacity: alpha.value })), value = source?.provider === provider && source.identity !== failed ? source : null;
  return <View testID={testID} accessible={false} style={[styles.frame, { backgroundColor: colors.surfaceContainerHighest }]}>
    {value ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, opacity]}><Image source={{ uri: value.uri }} resizeMode="cover" accessible={false} style={styles.image}
      onLoad={() => { if (live.current === value.identity && isSynchronouslyTrue(current)) alpha.set(withTiming(1, { duration: 180, easing: Easing.linear })); }}
      onError={() => { if (live.current === value.identity && isSynchronouslyTrue(current)) { alpha.set(0); setFailed(value.identity); } }} />
    </Animated.View> : null}
  </View>;
}
const styles = StyleSheet.create({ frame: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' }, image: { width: 56, height: 56 } });
