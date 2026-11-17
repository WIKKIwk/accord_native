import { Button, Column, IconButton, RNHostView, Spacer, TopAppBar, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminProfileAction } from './AdminProfileAction.android';
import { AdminText } from './AdminTypography.android';
import { AdminOutlinedTextField } from './AdminTextFields.android';
import { UserCreateIcon, userCreateRounded } from './AdminUserCreateNative.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { useAdminPartyCreate, type AdminPartyCreateProps } from './useAdminPartyCreate';
import type { ReactNode } from 'react';

/** @v2 AdminPartyCreateScaffold */
export function AdminPartyCreateScreen(props: AdminPartyCreateProps & { footer: ReactNode }) {
  const model = useAdminPartyCreate(props), name = useNativeState(''), phone = useNativeState(''), { colors, mode } = useBaseTheme();
  const field = { shape: userCreateRounded(18), colors: { focusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, unfocusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant } };
  if (!model.current()) return null;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.surfaceContainerHigh }}>
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }}>
      <TopAppBar.NavigationIcon><IconButton onClick={props.onBack} modifiers={[semantics({ contentDescription: props.backLabel }), testID("admin-party-create-back")]}><UserCreateIcon name="arrow_back" color={colors.onSurface} /></IconButton></TopAppBar.NavigationIcon>
      <TopAppBar.Title><AdminText style={{ fontSize: 24, fontWeight: '800' }}>{model.title}</AdminText></TopAppBar.Title>
      <TopAppBar.Actions><RNHostView matchContents><AdminProfileAction {...props} onProfile={props.onProfile} /></RNHostView></TopAppBar.Actions>
    </TopAppBar></BaseHost>
    <AdminShellBodyFrame hasFooter testID="admin-party-create-body-frame"><ScrollView keyboardShouldPersistTaps="handled"><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth(), padding(12, 12, 12, 0)]}>
      <AdminOutlinedTextField {...field} value={name} onValueChange={model.changeName} modifiers={[fillMaxWidth(), testID('admin-party-create-name')]}><AdminOutlinedTextField.Label><AdminText>{model.nameLabel}</AdminText></AdminOutlinedTextField.Label></AdminOutlinedTextField>
      <Spacer modifiers={[height(12)]} />
      <AdminOutlinedTextField {...field} value={phone} onValueChange={model.changePhone} keyboardOptions={{ keyboardType: 'phone' }} modifiers={[fillMaxWidth(), testID('admin-party-create-phone')]}><AdminOutlinedTextField.Label><AdminText>{model.phoneLabel}</AdminText></AdminOutlinedTextField.Label></AdminOutlinedTextField>
      <Spacer modifiers={[height(18)]} /><Button shape={userCreateRounded(20)} colors={{ containerColor: colors.primary, contentColor: colors.onPrimary }} enabled={!model.saving} onClick={() => { void model.save().catch(() => {}); }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-party-create-save')]}><AdminText>{model.saving ? model.savingLabel : model.title}</AdminText></Button>
    </Column></BaseHost></ScrollView></AdminShellBodyFrame><View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{props.footer}</View>
  </SafeAreaView>;
}
