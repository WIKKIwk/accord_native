import { Button, RNHostView, Text, VStack, Image } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, cornerRadius, font, foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminProfileAvatarImage } from './AdminProfileAvatarImage';
import { AdminProfileAvatarPreview } from './AdminProfileAvatarPreview';
import type { AdminProfileAvatarProps } from './AdminProfileAvatarTypes';
import { adminProfileAvatarPadding, adminProfileAvatarPreviewInitial } from './adminProfileAvatarModel';
import { useAdminProfileAvatar } from './useAdminProfileAvatar';

/** @v2 AdminProfileAvatar */
export function AdminProfileAvatar(props: AdminProfileAvatarProps) {
  const model = useAdminProfileAvatar(props), { colors } = useBaseTheme(), { state } = model, inset = adminProfileAvatarPadding(model.size), inner = model.size - inset * 2;
  if (!model.current()) return null;
  const fallback = <BaseHost matchContents><VStack modifiers={[frame({ width: inner, height: inner }), background(colors.primaryContainer)]}>
    <Text modifiers={[font({ size: model.size * .26, weight: 'black' }), foregroundStyle(colors.onPrimaryContainer)]}>{model.fallbackText}</Text>
  </VStack></BaseHost>;
  return <View><BaseHost matchContents><Button onPress={model.open} modifiers={[buttonStyle('plain'), frame({ width: model.size, height: model.size }), background(colors.surface), cornerRadius(model.size / 2), accessibilityIdentifier('admin-profile-avatar'), accessibilityLabel(model.semanticLabel)]}>
    <RNHostView matchContents><AdminProfileAvatarImage key={`${state.url}:${state.uri}`} uri={state.uri} cacheKey={`${model.namespace}:${state.url}`} width={inner} height={inner} radius={inner / 2} backgroundColor={colors.primaryContainer} fallback={fallback}
      isCurrent={() => !!state.uri && model.imageCurrent('thumbnail', state.uri)} onError={() => { if (state.uri) model.imageFailed('thumbnail', state.uri); }} /></RNHostView>
  </Button></BaseHost>{state.preview ? <AdminProfileAvatarPreview key={state.preview.id} model={model} fallback={(width, height) => <BaseHost matchContents><VStack modifiers={[frame({ width, height }), background(colors.surfaceContainer)]}>
    <Text modifiers={[font({ size: 45, weight: 'regular' }), foregroundStyle(colors.onSurface)]}>{adminProfileAvatarPreviewInitial(state.preview!.displayName)}</Text></VStack></BaseHost>}
    CloseButton={({ onClose }) => <BaseHost matchContents><Button onPress={onClose} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), background(colors.secondaryContainer), cornerRadius(22), accessibilityLabel(model.closeLabel), accessibilityIdentifier('admin-profile-avatar-preview-close')]}>
      <Image systemName="xmark" size={20} modifiers={[foregroundStyle(colors.onSecondaryContainer)]} /></Button></BaseHost>} /> : null}</View>;
}
