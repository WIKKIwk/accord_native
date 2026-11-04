import { Host, Mask, Rectangle, RNHostView, VStack } from '@expo/ui/swift-ui';
import { foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Alert, Linking, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { RECENT_BACKDROP_BUDGET_MS, RECENT_FLIGHT_MS, RECENT_HANDOFF_BUDGET_MS, RECENT_HOLD_MS, RECENT_LANDING_HAPTIC_MS, RECENT_NUDGE, RECENT_PRESS_SCALE, RECENT_PREWARM_MS, RECENT_RETRACT_MS, RECENT_RETRACT_STAGGER_MS, RECENT_STAGGER_MS, recentPhotoIndex, recentPhotoLayout, recentSprings, recentTileFrame, recentTileGeometry, type RecentComposerMetrics, type RecentPhotoLayout } from '../chatRecentPhotoMotion';
import { recentChatPhotos, type RecentChatPhoto, type RecentChatPhotosResult } from '../chatRecentPhotos';

type Bounds = { x: number; y: number; width: number; height: number };
type Backdrop = { uri: string; width: number; height: number };
export type RecentPhotoExit = { index: number | null; settled: Promise<unknown> };
export type RecentPhotoStrip = RecentPhotoLayout & {
  id: number; photos: RecentChatPhoto[]; selected: number | null; triggerLeft: number; triggerTop: number;
  onSelect: (photo: RecentChatPhoto) => unknown; backdrop: Promise<Backdrop | null>; exit: RecentPhotoExit | null;
};
type Touch = {
  startX: number; startY: number; x: number; y: number; anchorX: number; anchorY: number; root: Bounds;
  moved: boolean; long: boolean; released: boolean; prewarm: ReturnType<typeof setTimeout>; timer: ReturnType<typeof setTimeout>;
  photos: Promise<RecentChatPhotosResult | null> | null; backdrop: Promise<Backdrop | null> | null;
  strip: RecentPhotoStrip | null;
};
type Props = {
  enabled: boolean; stripOpen: boolean; composer: RecentComposerMetrics; rootRef: RefObject<ComponentRef<typeof View> | null>; onTap: () => void;
  onSelect: (photo: RecentChatPhoto) => unknown; onStripChange: (strip: RecentPhotoStrip | null) => void; onHoldChange: (holding: boolean) => void;
};

let stripSequence = 0;
const noExitWork = Promise.resolve();

// Keep the snapshot in memory only; it is discarded with the photo strip.
async function captureBackdrop(view: ComponentRef<typeof View> | null, root: Bounds): Promise<Backdrop | null> {
  if (!view) return null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const uri = await Promise.race([
      captureRef(view, { format: 'jpg', quality: 0.7, result: 'data-uri',
        width: Math.max(1, Math.round(root.width / 2)), height: Math.max(1, Math.round(root.height / 2)) }),
      new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), RECENT_BACKDROP_BUDGET_MS); }),
    ]);
    return uri ? { uri, width: root.width, height: root.height } : null;
  } catch { return null; /* The picker remains usable if the view cannot be captured. */ }
  finally { if (timeout) clearTimeout(timeout); }
}

export function RecentChatPhotosButton({ enabled, stripOpen, composer, rootRef, onTap, onSelect, onStripChange, onHoldChange }: Props) {
  const dark = useColorScheme() === 'dark';
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const button = useRef<ComponentRef<typeof View>>(null);
  const touch = useRef<Touch | null>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onTap, onSelect, onStripChange, onHoldChange, composer });
  const press = useSharedValue(1);
  useEffect(() => { callbacks.current = { onTap, onSelect, onStripChange, onHoldChange, composer }; }, [onTap, onSelect, onStripChange, onHoldChange, composer]);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (touch.current) { clearTimeout(touch.current.prewarm); clearTimeout(touch.current.timer); }
    touch.current = null;
    callbacks.current.onHoldChange(false);
    callbacks.current.onStripChange(null);
  }; }, []);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const pressTo = (scale: number) => { press.set(reduceMotion ? 1 : withSpring(scale, recentSprings.press)); };
  const settle = () => { pressTo(1); callbacks.current.onHoldChange(false); };

  // Start reading early so the row can open on time; a quick tap clears this before it runs.
  const prepare = (current: Touch) => {
    current.photos ??= recentChatPhotos().catch(() => null);
    current.backdrop ??= captureBackdrop(rootRef.current, current.root);
  };

  const longPress = async (current: Touch) => {
    current.long = true;
    prepare(current);
    let result = await current.photos;
    if (touch.current !== current) return;
    if (result && !result.granted && result.canAskAgain) {
      try { result = await recentChatPhotos(true); } catch { result = null; }
      if (touch.current !== current) {
        if (mounted.current && result?.requested && result.granted) {
          Alert.alert('Rasmlarga ruxsat berildi', 'Tanlash uchun + tugmasini yana bosib turing.');
        }
        return;
      }
    }
    settle();
    if (!result || !result.granted || !result.photos.length) touch.current = null;
    if (!result) { Alert.alert('Rasmlar ochilmadi', 'Qayta urinib ko‘ring.'); return; }
    if (!result.granted) {
      Alert.alert('Rasmlarga ruxsat kerak', 'So‘nggi rasmlarni ko‘rish uchun fotoalbomga ruxsat bering.', [
        { text: 'Yopish', style: 'cancel' }, { text: 'Sozlamalar', onPress: () => { void Linking.openSettings(); } },
      ]);
      return;
    }
    if (!result.photos.length) { Alert.alert('Rasmlar topilmadi', 'Fotoalbomda tanlash uchun rasm yo‘q.'); return; }
    const triggerLeft = current.anchorX - current.root.x;
    const triggerTop = current.anchorY - current.root.y;
    const strip: RecentPhotoStrip = { id: ++stripSequence, photos: result.photos, selected: null, triggerLeft, triggerTop,
      ...recentPhotoLayout(current.root.width, triggerLeft, triggerTop, callbacks.current.composer),
      backdrop: current.backdrop ?? Promise.resolve(null), exit: null, onSelect: photo => callbacks.current.onSelect(photo) };
    strip.selected = current.released ? null : recentPhotoIndex(strip, current.root, current.x, current.y);
    current.strip = strip;
    if (current.released) touch.current = null;
    callbacks.current.onStripChange(strip);
    void (strip.selected === null ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()).catch(() => {});
  };

  const begin = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const current: Touch = {
      startX: pageX, startY: pageY, x: pageX, y: pageY, anchorX: pageX - 20, anchorY: pageY - 20,
      root: { x: 0, y: 0, width, height }, moved: false, long: false, released: false, photos: null, backdrop: null, strip: null,
      prewarm: setTimeout(() => { prepare(current); callbacks.current.onHoldChange(true); }, RECENT_PREWARM_MS),
      timer: setTimeout(() => { void longPress(current); }, RECENT_HOLD_MS),
    };
    touch.current = current;
    pressTo(RECENT_PRESS_SCALE);
    button.current?.measure((_x, _y, _width, _height, pageLeft, pageTop) => {
      if (touch.current === current) { current.anchorX = pageLeft; current.anchorY = pageTop; }
    });
    rootRef.current?.measure((_x, _y, rootWidth, rootHeight, rootX, rootY) => {
      if (touch.current === current && rootWidth > 0 && rootHeight > 0) {
        current.root = { x: rootX, y: rootY, width: rootWidth, height: rootHeight };
      }
    });
  };
  const move = (event: GestureResponderEvent) => {
    const current = touch.current;
    if (!current) return;
    current.x = event.nativeEvent.pageX; current.y = event.nativeEvent.pageY;
    if (!current.long && Math.hypot(current.x - current.startX, current.y - current.startY) > 12) {
      current.moved = true;
      clearTimeout(current.prewarm); clearTimeout(current.timer);
      settle();
    }
    if (current.strip) {
      const index = recentPhotoIndex(current.strip, current.root, current.x, current.y, current.strip.selected);
      if (index !== current.strip.selected) {
        current.strip = { ...current.strip, selected: index };
        callbacks.current.onStripChange(current.strip);
        if (index !== null) void Haptics.selectionAsync().catch(() => {});
      }
    }
  };
  const end = (event: GestureResponderEvent, cancelled: boolean) => {
    const current = touch.current;
    if (!current) return;
    clearTimeout(current.prewarm); clearTimeout(current.timer);
    settle();
    if (cancelled) {
      touch.current = null;
      callbacks.current.onStripChange(current.strip ? { ...current.strip, selected: null, exit: { index: null, settled: noExitWork } } : null);
      return;
    }
    if (current.long && !current.strip) { current.released = true; return; }
    touch.current = null;
    if (current.long && current.strip) {
      const { selected } = current.strip;
      const index = recentPhotoIndex(current.strip, current.root, event.nativeEvent.pageX, event.nativeEvent.pageY, selected);
      if (index !== null) {
        if (index !== selected) void Haptics.selectionAsync().catch(() => {});
        const settled = Promise.resolve(callbacks.current.onSelect(current.strip.photos[index]));
        callbacks.current.onStripChange({ ...current.strip, selected: index, exit: { index, settled } });
      } else callbacks.current.onStripChange({ ...current.strip, selected: null });
    } else if (!current.moved) callbacks.current.onTap();
  };

  return <View ref={button} accessible accessibilityRole="button" accessibilityLabel="Rasm yoki video tanlash"
    accessibilityHint="So‘nggi rasmlar uchun bosib turing" accessibilityState={{ disabled: !enabled }}
    onAccessibilityTap={() => { if (enabled) callbacks.current.onTap(); }}
    onStartShouldSetResponder={() => enabled} onResponderGrant={begin} onResponderMove={move}
    onResponderRelease={event => end(event, false)} onResponderTerminate={event => end(event, true)}
    onResponderTerminationRequest={() => false} style={styles.trigger}>
    {/* The strip draws its own copy of this icon, in the same spot, and turns it into a close mark. */}
    <Animated.View pointerEvents="none" style={[pressStyle, stripOpen ? styles.hidden : null]}>
      <SymbolView name="plus" size={20} tintColor={dark ? '#ffffff' : '#1c1c1e'} />
    </Animated.View>
  </View>;
}

function RecentPhotoTile({ photo, index, strip, reduceMotion, placeholder, onPress }: {
  photo: RecentChatPhoto; index: number; strip: RecentPhotoStrip; reduceMotion: boolean; placeholder: string; onPress: () => void;
}) {
  const { selected, exit } = strip;
  const count = strip.photos.length;
  const travel = useSharedValue(reduceMotion ? 1 : 0);
  const bloom = useSharedValue(reduceMotion ? 1 : 0);
  const focus = useSharedValue(0);
  const nudge = useSharedValue(0);
  const land = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const delay = index * RECENT_STAGGER_MS;
    travel.set(withDelay(delay, withSpring(1, recentSprings.travel)));
    bloom.set(withDelay(delay, withSpring(1, recentSprings.bloom)));
  }, [bloom, index, reduceMotion, travel]);
  useEffect(() => {
    const target = selected === null ? 0 : selected === index ? 1 : -1;
    const shift = selected === null || selected === index ? 0 : Math.sign(index - selected) * RECENT_NUDGE;
    focus.set(reduceMotion ? target : withSpring(target, recentSprings.focus));
    nudge.set(reduceMotion ? shift : withSpring(shift, recentSprings.focus));
  }, [focus, index, nudge, reduceMotion, selected]);
  useEffect(() => {
    if (!exit || reduceMotion) return;
    if (exit.index === index) { land.set(withSpring(1, recentSprings.land)); return; }
    const delay = (count - 1 - index) * RECENT_RETRACT_STAGGER_MS;
    travel.set(withDelay(delay, withSpring(0, recentSprings.retract)));
    bloom.set(withDelay(delay, withSpring(0, recentSprings.retract)));
  }, [bloom, count, exit, index, land, reduceMotion, travel]);
  const geometry = recentTileGeometry(strip, index);
  const motion = useAnimatedStyle(() => {
    const tile = recentTileFrame(travel.get(), bloom.get(), focus.get(), nudge.get(), land.get(), geometry);
    return { opacity: tile.opacity, transform: [
      { translateX: tile.translateX }, { translateY: tile.translateY }, { rotate: `${tile.rotate}deg` }, { scale: tile.scale },
    ] };
  });
  const clip = useAnimatedStyle(() => ({
    borderRadius: recentTileFrame(travel.get(), bloom.get(), focus.get(), nudge.get(), land.get(), geometry).radius,
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: recentTileFrame(travel.get(), bloom.get(), focus.get(), nudge.get(), land.get(), geometry).ring,
  }));
  return <Animated.View style={[styles.tile, { width: strip.size, height: strip.size, backgroundColor: placeholder,
    zIndex: selected === index ? 1 : 0 }, motion]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`So‘nggi rasm ${index + 1}`} onPress={onPress} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.clip, clip]}>
        <Image source={{ uri: `ph://${encodeURIComponent(photo.id.slice(5))}` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" transition={120} />
        <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      </Animated.View>
    </Pressable>
  </Animated.View>;
}

export function RecentChatPhotoStrip({ strip, onDismiss, onClose, reduceMotion = false, backdropVisible = true, onBackdropError }: {
  strip: RecentPhotoStrip; onDismiss: (exit: RecentPhotoExit) => void; onClose: () => void; reduceMotion?: boolean; backdropVisible?: boolean; onBackdropError?: () => void;
}) {
  const dark = useColorScheme() === 'dark';
  const { exit } = strip;
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);
  const backdropOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const iconTurn = useSharedValue(reduceMotion ? 1 : 0);
  const iconScale = useSharedValue(reduceMotion ? 1 : RECENT_PRESS_SCALE);
  const rowOpacity = useSharedValue(1);
  const backdropStarted = useRef(false);
  const dismissed = useRef(false);
  const latest = useRef({ onClose, onBackdropError });
  useEffect(() => { latest.current = { onClose, onBackdropError }; }, [onClose, onBackdropError]);
  useEffect(() => {
    if (reduceMotion) return;
    iconTurn.set(withSpring(1, recentSprings.icon));
    iconScale.set(withSpring(1, recentSprings.press));
  }, [iconScale, iconTurn, reduceMotion]);
  useEffect(() => {
    let live = true;
    void strip.backdrop.then(value => {
      if (!live || dismissed.current) return;
      if (value) setBackdrop(value);
      else latest.current.onBackdropError?.();
    });
    return () => { live = false; };
  }, [strip.backdrop]);
  useEffect(() => {
    if (!exit) return;
    dismissed.current = true;
    if (reduceMotion) { latest.current.onClose(); return; }
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>(resolve => { timers.push(setTimeout(resolve, ms)); });
    const close = () => { if (live) latest.current.onClose(); };
    backdropOpacity.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }));
    iconTurn.set(withSpring(0, recentSprings.retract));
    if (exit.index === null) void wait(RECENT_RETRACT_MS).then(close);
    else {
      void wait(RECENT_LANDING_HAPTIC_MS).then(() => {
        if (live) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      });
      // The tile holds its slot until the real preview exists, then fades into it.
      const preview = Promise.race([exit.settled.catch(() => {}), wait(RECENT_HANDOFF_BUDGET_MS)]);
      void Promise.all([wait(RECENT_FLIGHT_MS), preview]).then(() => {
        if (!live) return undefined;
        rowOpacity.set(withTiming(0, { duration: 90 }));
        return wait(100);
      }).then(close);
    }
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [backdropOpacity, exit, iconTurn, reduceMotion, rowOpacity]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.get() }));
  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.get() }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${45 * iconTurn.get()}deg` }, { scale: iconScale.get() }] }));
  const showBackdrop = () => {
    if (backdropStarted.current || dismissed.current) return;
    backdropStarted.current = true;
    backdropOpacity.set(reduceMotion ? 1 : withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }));
  };
  const close = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismiss({ index: null, settled: noExitWork });
  };
  const selectPhoto = (photo: RecentChatPhoto, index: number) => {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismiss({ index, settled: Promise.resolve(strip.onSelect(photo)) });
  };
  const fadeStart = Math.max(0, strip.blurTop - 120);
  const fadeHeight = strip.blurTop - fadeStart;
  const solidHeight = Math.max(strip.top + strip.size + 80, strip.triggerTop + 51) - strip.blurTop;
  const fade = (from: string, to: string) => foregroundStyle({
    type: 'linearGradient', colors: [from, to], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 },
  });
  const maskBand = (height: number) => frame({ maxWidth: Infinity, minHeight: height, maxHeight: height });
  return <View pointerEvents={exit ? 'none' : 'box-none'} style={StyleSheet.absoluteFill}>
    <Pressable accessibilityRole="button" accessibilityLabel="So‘nggi rasmlarni yopish" onPress={close} style={StyleSheet.absoluteFill} />
    {backdrop && backdropVisible ? <Animated.View pointerEvents="none" style={[styles.blur, {
      top: fadeStart, height: fadeHeight + solidHeight + 120,
    }, backdropStyle]}>
      <Host pointerEvents="none" ignoreSafeArea="all" style={StyleSheet.absoluteFill}>
      <Mask>
        <RNHostView><View style={StyleSheet.absoluteFill}>
          <Image source={{ uri: backdrop.uri }} blurRadius={24} contentFit="fill" cachePolicy="none" onLoad={showBackdrop}
            onError={() => { if (!dismissed.current) onBackdropError?.(); }}
            style={{ position: 'absolute', left: 0, top: -fadeStart, width: backdrop.width, height: backdrop.height }} />
        </View></RNHostView>
        <Mask.Content>
          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
            <Rectangle modifiers={[fade('#00000000', '#000000'), maskBand(fadeHeight)]} />
            <Rectangle modifiers={[foregroundStyle('#000000'), maskBand(solidHeight)]} />
            <Rectangle modifiers={[fade('#000000', '#00000000'), maskBand(120)]} />
          </VStack>
        </Mask.Content>
      </Mask>
      </Host>
    </Animated.View> : null}
    <Animated.View pointerEvents="box-none" style={[styles.strip, { left: strip.left, top: strip.top, gap: strip.gap }, rowStyle]}>
      {strip.photos.map((photo, index) => <RecentPhotoTile key={photo.id} photo={photo} index={index} strip={strip} reduceMotion={reduceMotion}
        placeholder={dark ? '#2c2c2e' : '#e5e5ea'} onPress={() => selectPhoto(photo, index)} />)}
    </Animated.View>
    <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="So‘nggi rasmlarni yopish"
      style={[styles.close, { left: strip.triggerLeft, top: strip.triggerTop }]}>
      <Animated.View style={iconStyle}><SymbolView name="plus" size={20} tintColor={dark ? '#ffffff' : '#1c1c1e'} /></Animated.View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  strip: { position: 'absolute', flexDirection: 'row', backgroundColor: 'transparent' },
  tile: { borderRadius: 14, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  clip: { flex: 1, overflow: 'hidden' },
  ring: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 2.5, borderColor: '#0a84ff' },
  blur: { position: 'absolute', left: 0, right: 0 },
  close: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
