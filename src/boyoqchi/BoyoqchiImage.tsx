import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { cachedOrderImageBytes } from '../orderImageApi';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerControlException } from '../workerControlsApi';
import { downloadReturnedPaintImage } from './returnedPaintApi';
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
function downloadName(image: ReturnedPaintImage): string {
  const name = image.image_name.trim().split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '') ?? '';
  if (name && name !== '.' && name !== '..') return name;
  const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[image.image_mime.trim().toLowerCase()] ?? 'jpg';
  return `qaytarilgan-boyoq.${ext}`;
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
  const close = () => { setVisible(false); scale.set(1); x.set(0); y.set(0); };
  const download = async () => {
    if (downloading) return;
    setDownloading(true); setNotice('');
    let directory: Directory | null = null;
    try {
      const bytes = await downloadReturnedPaintImage(session, image);
      // The existing iOS build currently omits NSPhotoLibraryAddUsageDescription. The integrator owns this config.
      if (Platform.OS === 'ios') throw new Error('photo_add_permission_config_missing');
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) throw new Error('photo_permission_denied');
      directory = new Directory(Paths.cache, `returned-paint-${Crypto.randomUUID()}`);
      directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, downloadName(image));
      file.create({ overwrite: true });
      await file.write(bytes);
      await Asset.create(file.uri);
      setNotice(t('Rasm Photos ga saqlandi.'));
    } catch (error) {
      setNotice(error instanceof WorkerControlException ? error.message : t('Rasm yuklab olinmadi'));
    } finally {
      if (directory?.exists) { try { directory.delete(); } catch { /* Temporary cache may already be gone. */ } }
      setDownloading(false);
    }
  };
  const icon = broken ? 'broken_image' : 'image';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Rasmni to‘liq ko‘rish')} onPress={() => setVisible(true)}
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
