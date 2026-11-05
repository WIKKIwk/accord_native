import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, PlatformColor, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { profileAvatarSource } from '../profileModel';
import { useBaseLocale } from './useBaseLocale.ios';

type Props = { visible: boolean; onClose: () => void; session: Session; profile: Record<string, unknown>;
  token: string | null; revision: number; displayName: string };

export function ProfileAvatarPreview({ visible, onClose, session, profile, token, revision, displayName }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { text } = useBaseLocale();
  const [failed, setFailed] = useState('');
  const source = profileAvatarSource(session, profile);
  const cacheKey = source ? `${source.cacheKey}:${revision}` : '';
  const imageSource = source && token && failed !== cacheKey
    ? { ...source, cacheKey, headers: { Authorization: `Bearer ${token}` } } : null;
  const previewWidth = Math.min(Math.max(width - 32, 260), 420);
  const previewHeight = Math.min(Math.max(previewWidth * 1.25, 280), height * 0.72);

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={text('closeAction')} accessibilityRole="button" onPress={onClose} />
      <ScrollView style={{ width: previewWidth, height: previewHeight, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ width: previewWidth, height: previewHeight }}
        minimumZoomScale={1} maximumZoomScale={3} bouncesZoom centerContent>
        {imageSource ? <Image source={imageSource} cachePolicy="memory" contentFit="cover"
          style={{ width: previewWidth, height: previewHeight, borderRadius: 28 }} onError={() => setFailed(cacheKey)} /> :
          <View style={[styles.fallback, { width: previewWidth, height: previewHeight, backgroundColor: PlatformColor('secondarySystemBackground') }]}>
            <Text style={[styles.initial, { color: PlatformColor('label') }]}>{(displayName || 'U').charAt(0).toUpperCase()}</Text>
          </View>}
      </ScrollView>
      <Pressable accessibilityLabel={text('closeAction')} accessibilityRole="button" onPress={onClose}
        style={[styles.close, { top: insets.top + 12, backgroundColor: PlatformColor('secondarySystemBackground') }]}>
        <SymbolView name="xmark" size={18} tintColor={PlatformColor('label')} />
      </Pressable>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  fallback: { borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 88, fontWeight: '600' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
