import { Button, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, controlSize, disabled, frame, keyboardType, padding, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { BaseHost } from '../components/BaseHost.ios';
import { useAdminShellTheme } from './useAdminShellTheme';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { AdminProfileAction } from './AdminProfileAction.ios';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { useAdminPartyCreate, type AdminPartyCreateProps } from './useAdminPartyCreate';

/** @v2 AdminPartyCreateScaffold */
export function AdminPartyCreateScreen(props: AdminPartyCreateProps & { footer: ReactNode }) {
  const model = useAdminPartyCreate(props), name = useNativeState(''), phone = useNativeState(''), { colors, chromeBackground } = useAdminShellTheme();
  if (!model.current()) return null;
  return <View style={{ flex: 1, backgroundColor: chromeBackground }}><Stack.Screen options={{ headerShown: true, title: model.title, headerBackVisible: false,
    headerLeft: () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={props.onBack} tintColor={colors.onSurface} />,
    headerRight: () => <AdminProfileAction {...props} onProfile={props.onProfile} /> }} />
    <AdminShellBodyFrame hasFooter testID="admin-party-create-body-frame"><ScrollView keyboardShouldPersistTaps="handled"><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 12, top: 12 })]}>
      <Text>{model.nameLabel}</Text><TextField text={name} onTextChange={model.changeName} modifiers={[textFieldStyle('roundedBorder'), accessibilityIdentifier('admin-party-create-name')]} />
      <Text>{model.phoneLabel}</Text><TextField text={phone} onTextChange={model.changePhone} modifiers={[textFieldStyle('roundedBorder'), keyboardType('phone-pad'), accessibilityIdentifier('admin-party-create-phone')]} />
      <Button label={model.saving ? model.savingLabel : model.title} onPress={() => { void model.save().catch(() => {}); }} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ top: 6 }), disabled(model.saving), accessibilityIdentifier('admin-party-create-save')]} />
    </VStack></BaseHost></ScrollView></AdminShellBodyFrame><View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{props.footer}</View>
  </View>;
}
