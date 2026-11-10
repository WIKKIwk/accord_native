import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { adminProductionMapOrderImageUrl } from '../orderImageUri';
import { useWorkerColors } from './useWorkerColors';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Identity = { session: Session; orderId: string; imageId: string };

export function WorkerOrderHeader({ session, orderId, imageId, code, title, onOpenImage, onClose }: Identity & {
  code: string; title?: string; onOpenImage: () => void; onClose: () => void;
}) {
  const colors = useWorkerColors();
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Buyurtma rasmini ochish" onPress={onOpenImage}>
      <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active size={44}
        backgroundColor={colors.surface} iconColor={colors.icon} />
    </Pressable>
    <View style={styles.fill}>
      <Text style={[styles.label, { color: colors.muted }]}>Buyurtma raqami:</Text>
      <Text numberOfLines={1} style={[styles.code, { color: colors.text }]}>{code}</Text>
      {title ? <Text numberOfLines={2} style={[styles.label, { color: colors.muted }]}>{title}</Text> : null}
    </View>
    <WorkerIconButton icon="close" label="Yopish" onPress={onClose} tonal />
  </View>;
}

export function WorkerOrderImage({ session, orderId, imageId, onClose }: Identity & { onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const colors = useWorkerColors();
  const token = activeSessionToken(session);
  const url = new URL(adminProductionMapOrderImageUrl(session.baseUrl, orderId, imageId));
  return <View style={[styles.viewer, { backgroundColor: colors.field }]}>
    <View style={styles.imageHeader}>
      <Text style={[styles.code, { color: colors.text }]}>Buyurtma rasmi</Text>
      <WorkerIconButton icon="close" label="Rasmni yopish" onPress={onClose} tonal />
    </View>
    {token && url.protocol === 'https:' && url.origin === session.baseUrl && !failed
      ? <Image source={{ uri: url.toString(), headers: { Authorization: `Bearer ${token}` },
        cacheKey: JSON.stringify(['order-image', session.imageCacheScope, session.baseUrl, orderId, imageId]) }}
        style={styles.fill} contentFit="contain" cachePolicy="memory-disk" onError={() => setFailed(true)} />
      : <Text style={{ color: colors.muted }}>Rasm mavjud emas.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  label: { fontSize: 12, fontWeight: '500' }, code: { fontSize: 22, fontWeight: '600' },
  viewer: { flex: 1, padding: 16 }, imageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
