import { Box, RNHostView, Shape, Surface } from '@expo/ui/jetpack-compose';
import { combinedClickable, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminProfileActionProps } from './AdminProfileActionTypes';
import { useAdminProfileAction } from './useAdminProfileAction';

/** @v2 AppShellProfileAction */
export function AdminProfileAction(props: AdminProfileActionProps) {
  const model = useAdminProfileAction(props), { colors } = useBaseTheme(); if (!model.current() || !model.state.valid) return null;
  return <BaseHost matchContents><Box contentAlignment="center" modifiers={[size(38, 38), combinedClickable({ onClick: model.press, onLongClick: model.hold }, { indication: false }),
    semantics({ contentDescription: model.label }), testID('admin-profile-account-action')]}>
    <Surface color={colors.onPrimaryContainer} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 19, topEnd: 19, bottomStart: 19, bottomEnd: 19 } })} modifiers={[size(38, 38)]}>
      <Box contentAlignment="center" modifiers={[size(38, 38)]}><RNHostView matchContents>{model.state.uri ?
        <Image source={{ uri: model.state.uri }} contentFit="cover" cachePolicy="memory" style={{ width: 38, height: 38, borderRadius: 19 }} /> :
        <SymbolView name={{ android: 'person' }} size={22} tintColor={colors.primaryContainer} importantForAccessibility="no" />}</RNHostView></Box>
    </Surface>
  </Box></BaseHost>;
}
