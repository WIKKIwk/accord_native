import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { profileAvatarSource } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';

type Props = {
  session: Session;
  profile: Record<string, unknown>;
  token: string | null;
  revision: number;
  name: string;
  zoomLabel: string;
  closeLabel: string;
};

export function ProfileAvatarPreview({ session, profile, token, revision, name, zoomLabel, closeLabel }: Props) {
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useMaterialColors();
  const previewWidth = Math.min(420, Math.max(260, width - 32));
  const previewHeight = Math.min(height * 0.72, Math.max(280, previewWidth * 1.25));
  const scale = useSharedValue(1);
  const startingScale = useSharedValue(1);
  const x = useSharedValue(0), y = useSharedValue(0);
  const startingX = useSharedValue(0), startingY = useSharedValue(0);
  const pinch = usePinchGesture({
    onActivate: () => { 'worklet'; startingScale.set(scale.get()); },
    onUpdate: event => { 'worklet'; scale.set(Math.max(1, Math.min(3, startingScale.get() * event.scale))); },
  });
  const pan = usePanGesture({
    averageTouches: true,
    onActivate: () => { 'worklet'; startingX.set(x.get()); startingY.set(y.get()); },
    onUpdate: event => {
      'worklet';
      const maxX = (scale.get() - 1) * previewWidth / 2 + 80;
      const maxY = (scale.get() - 1) * previewHeight / 2 + 80;
      x.set(Math.max(-maxX, Math.min(maxX, startingX.get() + event.translationX)));
      y.set(Math.max(-maxY, Math.min(maxY, startingY.get() + event.translationY)));
    },
  });
  const gestures = useSimultaneousGestures(pinch, pan);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  const source = profileAvatarSource(session, profile);
  const close = () => { setVisible(false); scale.set(1); x.set(0); y.set(0); };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={zoomLabel} onPress={() => { setFailed(false); setVisible(true); }}>
      <ProfileAvatar session={session} profile={profile} token={token} revision={revision} />
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={StyleSheet.absoluteFill} onPress={close} />
          <GestureDetector gesture={gestures}>
            <Animated.View style={[styles.preview, { width: previewWidth, height: previewHeight, backgroundColor: colors.surfaceContainerHighest }, motion]}>
              <Text style={[styles.initial, { color: colors.onSurface }]}>{(name || 'U').charAt(0).toUpperCase()}</Text>
              {source && token && !failed ? <Image source={{ ...source, cacheKey: `${source.cacheKey}:${revision}`, headers: { Authorization: `Bearer ${token}` } }}
                style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" onError={() => setFailed(true)} /> : null}
            </Animated.View>
          </GestureDetector>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={close} testID="profile-avatar-close"
            style={[styles.close, { top: insets.top + 12, backgroundColor: colors.surfaceContainerHighest }]}>
            <Text style={[styles.closeText, { color: colors.onSurface }]}>×</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)' },
  preview: { alignItems: 'center', justifyContent: 'center', borderRadius: 28, overflow: 'hidden' },
  initial: { fontSize: 44, fontWeight: '600' },
  close: { position: 'absolute', right: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 30, lineHeight: 34 },
});
