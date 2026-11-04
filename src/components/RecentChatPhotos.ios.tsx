import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { Alert, Linking, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { recentChatPhotos, type RecentChatPhoto } from '../chatRecentPhotos';

type Bounds = { x: number; y: number; width: number };
export type RecentPhotoStrip = {
  photos: RecentChatPhoto[]; left: number; top: number; size: number; gap: number; selected: number | null;
  triggerLeft: number; triggerTop: number; onSelect: (photo: RecentChatPhoto) => void;
};
type Touch = {
  startX: number; startY: number; x: number; y: number; anchorX: number; anchorY: number; root: Bounds;
  moved: boolean; long: boolean; timer: ReturnType<typeof setTimeout>;
  strip: RecentPhotoStrip | null;
};
type Props = {
  enabled: boolean; rootRef: RefObject<ComponentRef<typeof View> | null>; onTap: () => void;
  onSelect: (photo: RecentChatPhoto) => void; onStripChange: (strip: RecentPhotoStrip | null) => void;
};

export function recentPhotoIndex(strip: RecentPhotoStrip, root: Bounds, x: number, y: number): number | null {
  const relativeX = x - root.x - strip.left - 8;
  const relativeY = y - root.y - strip.top - 8;
  if (relativeX < 0 || relativeY < 0 || relativeY >= strip.size) return null;
  const index = Math.floor(relativeX / (strip.size + strip.gap));
  return index < strip.photos.length && relativeX - index * (strip.size + strip.gap) < strip.size ? index : null;
}

export function RecentChatPhotosButton({ enabled, rootRef, onTap, onSelect, onStripChange }: Props) {
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const button = useRef<ComponentRef<typeof View>>(null);
  const touch = useRef<Touch | null>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onTap, onSelect, onStripChange });
  useEffect(() => { callbacks.current = { onTap, onSelect, onStripChange }; }, [onTap, onSelect, onStripChange]);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (touch.current) clearTimeout(touch.current.timer);
    touch.current = null;
    callbacks.current.onStripChange(null);
  }; }, []);

  const longPress = async (current: Touch) => {
    current.long = true;
    let result = await recentChatPhotos().catch(() => null);
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
    if (!result) { Alert.alert('Rasmlar ochilmadi', 'Qayta urinib ko‘ring.'); return; }
    if (!result.granted) {
      Alert.alert('Rasmlarga ruxsat kerak', 'So‘nggi rasmlarni ko‘rish uchun fotoalbomga ruxsat bering.', [
        { text: 'Yopish', style: 'cancel' }, { text: 'Sozlamalar', onPress: () => { void Linking.openSettings(); } },
      ]);
      return;
    }
    if (!result.photos.length) { Alert.alert('Rasmlar topilmadi', 'Fotoalbomda tanlash uchun rasm yo‘q.'); return; }
    const gap = 8;
    const size = Math.max(40, Math.min(84, Math.floor((current.root.width - 40 - 3 * gap) / 4)));
    const top = Math.max(8, current.anchorY - current.root.y - size - 30);
    const strip: RecentPhotoStrip = { photos: result.photos, left: 12, top, size, gap, selected: null,
      triggerLeft: current.anchorX - current.root.x, triggerTop: current.anchorY - current.root.y,
      onSelect: photo => callbacks.current.onSelect(photo) };
    strip.selected = recentPhotoIndex(strip, current.root, current.x, current.y);
    current.strip = strip;
    callbacks.current.onStripChange(strip);
  };

  const begin = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const current: Touch = {
      startX: pageX, startY: pageY, x: pageX, y: pageY, anchorX: pageX - 20, anchorY: pageY - 20,
      root: { x: 0, y: 0, width }, moved: false, long: false, strip: null,
      timer: setTimeout(() => { void longPress(current); }, 450),
    };
    touch.current = current;
    button.current?.measure((_x, _y, _width, _height, pageLeft, pageTop) => {
      if (touch.current === current) { current.anchorX = pageLeft; current.anchorY = pageTop; }
    });
    rootRef.current?.measure((_x, _y, rootWidth, _height, rootX, rootY) => {
      if (touch.current === current && rootWidth > 0) current.root = { x: rootX, y: rootY, width: rootWidth };
    });
  };
  const move = (event: GestureResponderEvent) => {
    const current = touch.current;
    if (!current) return;
    current.x = event.nativeEvent.pageX; current.y = event.nativeEvent.pageY;
    if (!current.long && Math.hypot(current.x - current.startX, current.y - current.startY) > 12) {
      current.moved = true; clearTimeout(current.timer);
    }
    if (current.strip) {
      const index = recentPhotoIndex(current.strip, current.root, current.x, current.y);
      if (index !== current.strip.selected) {
        current.strip = { ...current.strip, selected: index };
        callbacks.current.onStripChange(current.strip);
      }
    }
  };
  const end = (event: GestureResponderEvent, cancelled: boolean) => {
    const current = touch.current;
    if (!current) return;
    touch.current = null;
    clearTimeout(current.timer);
    if (cancelled) { callbacks.current.onStripChange(null); return; }
    if (current.long && current.strip) {
      const index = recentPhotoIndex(current.strip, current.root, event.nativeEvent.pageX, event.nativeEvent.pageY);
      if (index !== null) {
        callbacks.current.onStripChange(null);
        callbacks.current.onSelect(current.strip.photos[index]);
      } else callbacks.current.onStripChange({ ...current.strip, selected: null });
    } else {
      callbacks.current.onStripChange(null);
      if (!current.long && !current.moved) callbacks.current.onTap();
    }
  };

  return <View ref={button} accessible accessibilityRole="button" accessibilityLabel="Rasm yoki video tanlash"
    accessibilityHint="So‘nggi rasmlar uchun bosib turing" accessibilityState={{ disabled: !enabled }}
    onAccessibilityTap={() => { if (enabled) callbacks.current.onTap(); }}
    onStartShouldSetResponder={() => enabled} onResponderGrant={begin} onResponderMove={move}
    onResponderRelease={event => end(event, false)} onResponderTerminate={event => end(event, true)}
    onResponderTerminationRequest={() => false} style={styles.trigger}>
    <View pointerEvents="none"><SymbolView name="plus" size={20} tintColor={dark ? '#ffffff' : '#1c1c1e'} /></View>
  </View>;
}

export function RecentChatPhotoStrip({ strip, onClose }: { strip: RecentPhotoStrip; onClose: () => void }) {
  const dark = useColorScheme() === 'dark';
  const steps = 12;
  const fadeStart = Math.max(0, strip.top - 120);
  const fadeStep = (strip.top - fadeStart) / steps;
  const solidHeight = strip.size + 80;
  const solidEnd = strip.top + solidHeight;
  const tint = dark ? 'dark' : 'light';
  const selectPhoto = (photo: RecentChatPhoto) => { onClose(); strip.onSelect(photo); };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: steps }, (_, index) => <BlurView key={`top-${index}`} tint={tint}
        intensity={Math.round(40 * (index + 1) / steps)} style={[styles.blurBand, { top: fadeStart + index * fadeStep, height: fadeStep }]} />)}
      <BlurView tint={tint} intensity={40} style={[styles.blurBand, { top: strip.top, height: solidHeight }]} />
      {Array.from({ length: steps }, (_, index) => <BlurView key={`bottom-${index}`} tint={tint}
        intensity={Math.round(40 * (steps - index - 1) / steps)} style={[styles.blurBand, { top: solidEnd + index * 10, height: 10 }]} />)}
    </View>
    <View style={[styles.strip, { left: strip.left, top: strip.top, gap: strip.gap }]}>
      {strip.photos.map((photo, index) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`So‘nggi rasm ${index + 1}`}
        onPress={() => selectPhoto(photo)} style={{ width: strip.size, height: strip.size, borderRadius: 12, overflow: 'hidden',
          borderWidth: strip.selected === index ? 3 : 0, borderColor: '#0a84ff' }}>
        <Image source={{ uri: `ph://${encodeURIComponent(photo.id.slice(5))}` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" />
      </Pressable>)}
    </View>
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="So‘nggi rasmlarni yopish"
      style={[styles.close, { left: strip.triggerLeft, top: strip.triggerTop }]}>
      <SymbolView name="xmark" size={20} tintColor={dark ? '#ffffff' : '#1c1c1e'} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  strip: { position: 'absolute', flexDirection: 'row', padding: 8, borderRadius: 18, backgroundColor: '#242426ee' },
  blurBand: { position: 'absolute', left: 0, right: 0 },
  close: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
