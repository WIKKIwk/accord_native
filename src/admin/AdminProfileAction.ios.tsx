import { Button, Image, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityHint, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, clipShape, foregroundStyle, frame, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { Image as ExpoImage } from 'expo-image';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminProfileActionProps } from './AdminProfileActionTypes';
import { useAdminProfileAction } from './useAdminProfileAction';

/** @v2 AppShellProfileAction */
export function AdminProfileAction(props: AdminProfileActionProps) {
  const model = useAdminProfileAction(props), { colors } = useBaseTheme(); if (!model.current() || !model.state.valid) return null;
  return <BaseHost matchContents><Button onPress={model.press} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.label), accessibilityHint(model.hint),
    accessibilityIdentifier('admin-profile-account-action'), onLongPressGesture(model.hold, .5)]}>
    {model.state.uri ? <RNHostView matchContents><ExpoImage source={{ uri: model.state.uri }} contentFit="cover" cachePolicy="memory" style={{ width: 38, height: 38, borderRadius: 19 }} /></RNHostView> :
      <Image systemName="person.fill" size={22} modifiers={[foregroundStyle(colors.primaryContainer), frame({ width: 38, height: 38 }), background(colors.onPrimaryContainer), clipShape('circle')]} />}
  </Button></BaseHost>;
}
