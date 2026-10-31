import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Session } from '../auth';
import { loadOrderThumbnail } from '../orderThumbnail';

type Props = { session: Session; orderId: string; imageId: string; backgroundColor: string; iconColor: string };

export function WorkerOrderThumbnail({ session, orderId, imageId, backgroundColor, iconColor }: Props) {
  const [loaded, setLoaded] = useState<{ session: Session; orderId: string; imageId: string; uri: string } | null>(null);
  const uri = loaded?.session === session && loaded.orderId === orderId && loaded.imageId === imageId ? loaded.uri : null;
  useEffect(() => {
    let mounted = true;
    void loadOrderThumbnail(session, orderId, imageId).then(result => {
      if (mounted) setLoaded(result ? { session, orderId, imageId, uri: result } : null);
    });
    return () => { mounted = false; };
  }, [session, orderId, imageId]);
  return <View accessible={false} pointerEvents="none" style={[styles.thumbnail, { backgroundColor }]}>
    <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={20} tintColor={iconColor} />
    {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" onError={() => setLoaded(null)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  thumbnail: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
