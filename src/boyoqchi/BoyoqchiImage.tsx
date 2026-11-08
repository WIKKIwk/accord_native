import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { cachedOrderImageBytes } from '../orderImageApi';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerControlException } from '../workerControlsApi';
import { saveReturnedPaintImageToPhotos } from './returnedPaintPhoto';
import type { ReturnedPaintImage } from './returnedPaintModel';
import { useBoyoqchiText } from './useBoyoqchiText';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let part = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    part += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) +
      (c === undefined ? '=' : alphabet[c & 63]);
    if (part.length >= 32768) { chunks.push(part); part = ''; }
  }
  chunks.push(part);
  return chunks.join('');
}
export function BoyoqchiImage({ session, image, allowDownload = false }: {
  session: Session; image: ReturnedPaintImage; allowDownload?: boolean;
}) {
  const colors = useWorkerColors(), t = useBoyoqchiText(), insets = useSafeAreaInsets(), { width, height } = useWindowDimensions();
  const [result, setResult] = useState<{ key: string; data: string; broken: boolean } | null>(null), [visible, setVisible] = useState(false);
  const sourceKey = JSON.stringify([session.imageCacheScope, image.image_url, image.image_mime]);
  const data = result?.key === sourceKey ? result.data : '';
  const broken = result?.key === sourceKey && result.broken;
  const [downloading, setDownloading] = useState(false), [notice, setNotice] = useState('');
  const previewGeneration = useRef(0), downloadingRef = useRef(false);
  useEffect(() => () => { previewGeneration.current++; }, []);
  const scale = useSharedValue(1), initialScale = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0);
  const initialX = useSharedValue(0), initialY = useSharedValue(0);
  const pinch = usePinchGesture({ onActivate: () => { 'worklet'; initialScale.set(scale.get()); },
    onUpdate: event => { 'worklet'; scale.set(Math.max(0.8, Math.min(4, initialScale.get() * event.scale))); } });
  const pan = usePanGesture({ averageTouches: true, onActivate: () => { 'worklet'; initialX.set(x.get()); initialY.set(y.get()); },
    onUpdate: event => { 'worklet';
      const maxX = Math.max(0, (scale.get() - 1) * width / 2), maxY = Math.max(0, (scale.get() - 1) * height / 2);
      x.set(Math.max(-maxX, Math.min(maxX, initialX.get() + event.translationX)));
      y.set(Math.max(-maxY, Math.min(maxY, initialY.get() + event.translationY)));
    } });
  const gesture = useSimultaneousGestures(pinch, pan);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  useEffect(() => {
    let mounted = true;
    if (image.image_url.trim()) void cachedOrderImageBytes(session, image.image_url).then(bytes => {
      if (!mounted) return;
      if (!bytes?.length) { setResult({ key: sourceKey, data: '', broken: true }); return; }
      const mime = /^image\/(?:jpeg|png|webp|heic|heif)$/i.test(image.image_mime.trim()) ? image.image_mime.trim() : 'image/jpeg';
      setResult({ key: sourceKey, data: `data:${mime};base64,${base64(bytes)}`, broken: false });
    }).catch(() => { if (mounted) setResult({ key: sourceKey, data: '', broken: true }); });
    return () => { mounted = false; };
  }, [session, image.image_url, image.image_mime, sourceKey]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const close = () => {
    previewGeneration.current++; downloadingRef.current = false;
    setVisible(false); setDownloading(false); setNotice(''); scale.set(1); x.set(0); y.set(0);
  };
  const download = async () => {
    if (downloadingRef.current) return;
    const generation = previewGeneration.current;
    downloadingRef.current = true;
    setDownloading(true); setNotice('');
    try {
      await saveReturnedPaintImageToPhotos(session, image);
      if (previewGeneration.current === generation) setNotice(t('Rasm Photos ga saqlandi.'));
    } catch (error) {
      if (previewGeneration.current === generation) setNotice(error instanceof WorkerControlException ? error.message : t('Rasm yuklab olinmadi'));
    } finally {
      if (previewGeneration.current === generation) { downloadingRef.current = false; setDownloading(false); }
    }
  };
  const icon = broken ? 'broken_image' : 'image';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Rasmni to‘liq ko‘rish')} onPress={() => { previewGeneration.current++; setVisible(true); }}
      style={[styles.thumbnail, { backgroundColor: colors.field }]}>
      {data ? <Image source={{ uri: data }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" onError={() => setResult({ key: sourceKey, data: '', broken: true })} />
        : <SymbolView name={{ ios: broken ? 'photo.badge.exclamationmark' : 'photo', android: icon }} size={42} tintColor={colors.muted} />}
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <GestureHandlerRootView style={styles.preview}>
        <GestureDetector gesture={gesture}><Animated.View style={[styles.imageArea, motion]}>
          {data && !broken ? <Image source={{ uri: data }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory" />
            : <SymbolView name={{ ios: broken ? 'photo.badge.exclamationmark' : 'photo', android: icon }} size={72} tintColor="#ffffffb3" />}
        </Animated.View></GestureDetector>
        <View style={[styles.actions, { top: insets.top + 12 }]}>
          {allowDownload && <Pressable accessibilityRole="button" accessibilityLabel={t('Rasmni yuklab olish')} onPress={() => void download()}
            disabled={downloading} style={styles.action}>{downloading ? <ActivityIndicator color="white" />
              : <SymbolView name={{ ios: 'arrow.down', android: 'download' }} size={22} tintColor="white" />}</Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('Yopish')} onPress={close} style={styles.action}>
            <SymbolView name={{ ios: 'xmark', android: 'close' }} size={22} tintColor="white" />
          </Pressable>
        </View>
        {!!notice && <View style={[styles.notice, { bottom: insets.bottom + 16 }]}><Text style={styles.noticeText}>{notice}</Text></View>}
      </GestureHandlerRootView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  preview: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' },
  imageArea: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  actions: { position: 'absolute', right: 12, flexDirection: 'row', gap: 8 },
  action: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' },
  notice: { position: 'absolute', left: 16, right: 16, borderRadius: 6, padding: 14, backgroundColor: '#333' },
  noticeText: { color: '#fff' },
});
