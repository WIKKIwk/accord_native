import { Image } from 'expo-image';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** @v2 ImageFade */
export function AdminProfileAvatarImage({ uri, cacheKey, width, height, radius, backgroundColor, isCurrent, onError, fallback }: {
  uri: string | null; cacheKey: string; width: number; height: number; radius: number; backgroundColor?: string; isCurrent: () => boolean; onError: () => void; fallback: ReactNode;
}) {
  const placeholder = useSharedValue(1), style = useAnimatedStyle(() => ({ opacity: placeholder.get() })), synchronous = useRef(false);
  useLayoutEffect(() => { synchronous.current = false; placeholder.set(1); }, [placeholder, uri, cacheKey]);
  return <View pointerEvents="none" style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor }}>
    <Animated.View style={[StyleSheet.absoluteFill, style]}>{fallback}</Animated.View>
    {uri ? <Image source={{ uri, cacheKey }} style={StyleSheet.absoluteFill} recyclingKey={cacheKey} contentFit="cover" cachePolicy="memory"
      transition={{ duration: 180, timing: 'linear', effect: 'cross-dissolve', skipOnCacheHit: 'memory' }}
      onLoad={event => { if (isCurrent()) synchronous.current = event.cacheType === 'memory'; }}
      onDisplay={() => { if (isCurrent()) placeholder.set(synchronous.current ? 0 : withTiming(0, { duration: 180, easing: Easing.linear })); }} onError={() => { if (isCurrent()) onError(); }} /> : null}
  </View>;
}
