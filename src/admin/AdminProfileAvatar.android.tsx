import { Box, FilledTonalIconButton, RNHostView, Shape, Surface } from '@expo/ui/jetpack-compose';
import { padding, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { AdminProfileAvatarImage } from './AdminProfileAvatarImage';
import { AdminProfileAvatarPreview } from './AdminProfileAvatarPreview';
import type { AdminProfileAvatarProps } from './AdminProfileAvatarTypes';
import { adminProfileAvatarPadding, adminProfileAvatarPreviewInitial } from './adminProfileAvatarModel';
import { useAdminProfileAvatar } from './useAdminProfileAvatar';

/** @v2 AdminProfileAvatar */
export function AdminProfileAvatar(props: AdminProfileAvatarProps) {
  const model = useAdminProfileAvatar(props), { colors } = useBaseTheme(), { state } = model, inset = adminProfileAvatarPadding(model.size), inner = model.size - inset * 2;
  if (!model.current()) return null;
  const fallback = <BaseHost matchContents><Surface color={colors.primaryContainer} modifiers={[size(inner, inner)]}><Box contentAlignment="center" modifiers={[size(inner, inner)]}>
    <Text color={colors.onPrimaryContainer} style={{ fontSize: model.size * .26, fontWeight: '900' }}>{model.fallbackText}</Text>
  </Box></Surface></BaseHost>;
  return <View><BaseHost matchContents><Surface color={colors.surface} shape={Shape.RoundedCorner({ cornerRadii: { topStart: model.size / 2, topEnd: model.size / 2, bottomStart: model.size / 2, bottomEnd: model.size / 2 } })} onClick={model.open}
    modifiers={[size(model.size, model.size), semantics({ contentDescription: model.semanticLabel }), testID('admin-profile-avatar')]}><Box modifiers={[padding(inset, inset, inset, inset)]}>
      <RNHostView matchContents><AdminProfileAvatarImage key={`${state.url}:${state.uri}`} uri={state.uri} cacheKey={`${model.namespace}:${state.url}`} width={inner} height={inner} radius={inner / 2} backgroundColor={colors.primaryContainer} fallback={fallback}
        isCurrent={() => !!state.uri && model.imageCurrent('thumbnail', state.uri)} onError={() => { if (state.uri) model.imageFailed('thumbnail', state.uri); }} /></RNHostView>
    </Box></Surface></BaseHost>
    {state.preview ? <AdminProfileAvatarPreview key={state.preview.id} model={model} fallback={(width, height) => <BaseHost matchContents><Surface color={colors.surfaceContainer} modifiers={[size(width, height)]}><Box contentAlignment="center" modifiers={[size(width, height)]}>
      <Text style={{ typography: 'displayMedium' }}>{adminProfileAvatarPreviewInitial(state.preview!.displayName)}</Text></Box></Surface></BaseHost>}
      CloseButton={({ onClose }) => <BaseHost matchContents><FilledTonalIconButton onClick={onClose} colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}
        modifiers={[size(44, 44), semantics({ contentDescription: model.closeLabel }), testID('admin-profile-avatar-preview-close')]}><RNHostView matchContents><SymbolView name={{ android: 'close' }} size={24} tintColor={colors.onSecondaryContainer} /></RNHostView></FilledTonalIconButton></BaseHost>} /> : null}
  </View>;
}
