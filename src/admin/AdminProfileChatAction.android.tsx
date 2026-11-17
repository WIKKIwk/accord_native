import { Button, CircularProgressIndicator, RNHostView, Row } from '@expo/ui/jetpack-compose';
import { defaultMinSize, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText } from './AdminTypography.android';
import { useAdminProfileChatAction, type AdminProfileChatActionProps } from './useAdminProfileChatAction';

export function AdminProfileChatAction(props: AdminProfileChatActionProps) {
  const model = useAdminProfileChatAction(props), { colors } = useBaseTheme();
  if (!model.visible) return null;
  return <BaseHost matchContents><Button enabled={!model.busy} onClick={model.open}
    colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }} contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }}
    modifiers={[defaultMinSize({ minWidth: 0, minHeight: 34 }), testID('admin-profile-chat-action')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
      {model.busy ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(16, 16)]} /> : <RNHostView matchContents><SymbolView name={{ android: 'chat_bubble' }} size={17} tintColor={colors.onSecondaryContainer} /></RNHostView>}
      <AdminText>{model.label}</AdminText>
    </Row></Button></BaseHost>;
}
