import { Button, HStack, Image, ProgressView, Spacer, Text, TextField, Toggle, VStack, useNativeState, type TextFieldRef } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, lineLimit, onSubmit, padding, submitLabel, textFieldStyle, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { AdminProfileAction } from './AdminProfileAction';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminUserCreateOverlays } from './AdminUserCreateOverlays.ios';
import type { AdminUserCreateScreenProps } from './AdminUserCreateScreenTypes';
import { useAdminUserCreate, type AdminUserCreateScreenModel } from './useAdminUserCreate';

function Field({ model, name, next }: { model: AdminUserCreateScreenModel; name: 'name' | 'phone'; next: React.RefObject<TextFieldRef | null> }) {
  const value = useNativeState(model.fields[name]), filled = useRef(model.state.fillVersion), label = model.a(name === 'name' ? 'user.name' : model.state.choice?.kind === 'customer' ? 'user.phone_optional' : 'user.phone');
  useEffect(() => { if (filled.current !== model.state.fillVersion && model.current()) { filled.current = model.state.fillVersion; value.set(model.fields[name]); } }, [value, model, name]);
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{label}</Text>
    <TextField ref={name === 'phone' ? next : undefined} text={value} placeholder={label} onTextChange={name === 'name' ? model.changeName : model.changePhone}
      modifiers={[textFieldStyle('roundedBorder'), keyboardType(name === 'phone' ? 'phone-pad' : 'default'), submitLabel(name === 'name' ? 'next' : 'return'), onSubmit(() => { if (name === 'name' && model.interactive()) void next.current?.focus(); }), accessibilityIdentifier(`admin-user-create-${name}`)]} />
  </VStack>;
}
function Save({ model }: { model: AdminUserCreateScreenModel }) {
  return <Button label={model.a(model.state.saving ? 'user.saving' : 'user.save')} onPress={model.save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!model.saveEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-user-create-save')]} />;
}
function RoleSelector({ model }: { model: AdminUserCreateScreenModel }) {
  const { colors } = useBaseTheme();
  return <VStack alignment="leading" spacing={6} modifiers={[padding({ leading: 12, top: 12, trailing: 12, bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle('secondary')]}>{model.a('user.role_select')}</Text>
    <Button onPress={model.customerOnly ? undefined : model.rolePicker} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, minHeight: 66 }), background(colors.surface), cornerRadius(18), disabled(model.customerOnly), accessibilityIdentifier('admin-user-create-role')]}>
      <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}><Image systemName={model.state.choice ? 'person.badge.shield.checkmark' : 'person.badge.plus'} size={21} modifiers={[foregroundStyle(colors.onSecondaryContainer), frame({ width: 38, height: 38 }), background(colors.secondaryContainer), cornerRadius(19)]} />
        <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{model.label}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{model.subtitle}</Text></VStack>
        {!model.customerOnly ? <Image systemName="chevron.down" size={16} modifiers={[foregroundStyle('secondary')]} /> : null}
      </HStack>
    </Button>
  </VStack>;
}
function WerkaCode({ model }: { model: AdminUserCreateScreenModel }) {
  const { colors } = useBaseTheme();
  return <><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle('secondary')]}>{model.a('user.code')}</Text>
    <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 58 }), padding({ leading: 16, top: 6, trailing: 6, bottom: 6 }), background(colors.surface), cornerRadius(18)]}>
      <Text modifiers={[font({ textStyle: 'headline' }), textSelection(true), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.codeCopyEnabled ? model.state.code : model.a('profile.code_not_shown')}</Text>
      <Button onPress={model.copy} modifiers={[buttonStyle('plain'), disabled(!model.codeCopyEnabled), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.copy')), accessibilityIdentifier('admin-user-create-code-copy')]}><Image systemName="doc.on.doc" size={20} /></Button>
      <Button onPress={model.regenerate} modifiers={[buttonStyle('plain'), disabled(!model.regenerateEnabled), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('user.code')), accessibilityIdentifier('admin-user-create-code-regenerate')]}>{model.state.regenerating ? <ProgressView /> : <Image systemName="arrow.clockwise" size={20} />}</Button>
    </HStack>{model.state.seconds > 0 ? <Text modifiers={[font({ textStyle: 'body' }), padding({ top: 12 })]}>{model.a('user.code_retry', { seconds: model.state.seconds })}</Text> : null}<Spacer modifiers={[frame({ height: 14 })]} />
  </>;
}
function Form({ model }: { model: AdminUserCreateScreenModel }) {
  const phone = useRef<TextFieldRef>(null), { state } = model, { colors } = useBaseTheme(); if (!state.choice) return null;
  if (state.choice.kind === 'werka' && state.phase !== 'ready') return <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity }), padding({ leading: 20, top: 12, trailing: 20, bottom: 24 })]}>
    {state.phase === 'loading' ? <ProgressView /> : <><Text modifiers={[foregroundStyle('secondary')]}>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.reload} modifiers={[accessibilityIdentifier('admin-user-create-retry')]} /></>}
  </VStack>;
  return <><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: 12, top: 8, trailing: 12, bottom: model.custom ? 0 : 24 })]}>
    {state.choice.kind === 'werka' ? <WerkaCode model={model} /> : null}<Field model={model} name="name" next={phone} /><Spacer modifiers={[frame({ height: 12 })]} /><Field model={model} name="phone" next={phone} />
    {model.apparatusVisible ? <VStack alignment="leading" spacing={6} modifiers={[padding({ top: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{state.apparatusLoading ? <ProgressView /> : state.apparatus.length ? <>
      <Text modifiers={[font({ textStyle: 'headline' })]}>{model.a('scope.allowed')}</Text>{state.apparatus.map((item, index) => <Toggle key={`${item.id}:${index}`} label={item.name} isOn={!!item.id && state.selectedApparatus.includes(item.id)} onIsOnChange={value => model.selectApparatus(item.id, value)} modifiers={[disabled(!item.id), accessibilityIdentifier(`admin-user-create-apparatus-${index}`)]} />)}
    </> : <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('scope.empty')}</Text>}</VStack> : null}
    {model.custom && model.material ? <VStack alignment="leading" spacing={6} modifiers={[padding({ top: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle('secondary')]}>{model.a('user.item_groups')}</Text>
      <Button onPress={model.groupPicker} modifiers={[buttonStyle('plain'), disabled(state.groupsLoading), frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(16), accessibilityIdentifier('admin-user-create-groups')]}><HStack spacing={10} modifiers={[padding({ horizontal: 14, vertical: 14 })]}>
        <Image systemName="square.grid.2x2" size={20} modifiers={[foregroundStyle('secondary')]} /><Text modifiers={[font({ textStyle: 'body' }), lineLimit(2), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{state.selectedGroups.length ? state.selectedGroups.join(', ') : model.a(state.groupsLoading ? 'user.groups_loading' : 'user.group_choose')}</Text><Image systemName="chevron.down" size={16} modifiers={[foregroundStyle('secondary')]} />
      </HStack></Button>
    </VStack> : null}
    {!model.custom ? <><Spacer modifiers={[frame({ height: 18 })]} /><Save model={model} /></> : null}
  </VStack>{model.custom ? <VStack modifiers={[frame({ maxWidth: Infinity }), padding({ leading: 12, top: 8, trailing: 12, bottom: 24 })]}><Save model={model} /></VStack> : null}</>;
}
/** @v2 AdminUserCreateScreen */
export function AdminUserCreateScreen(props: AdminUserCreateScreenProps) {
  const model = useAdminUserCreate(props), { colors, chromeBackground } = useAdminShellTheme(); if (!model.current() || !model.state.valid) return null;
  return <View style={[styles.screen, { backgroundColor: chromeBackground }]}><Stack.Screen options={{ title: model.a('user.create_title'), headerShown: true, headerLargeTitle: false, headerShadowVisible: false, headerBackVisible: false,
    headerLeft: () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back} tintColor={colors.onSurface} />, headerRight: () => <AdminProfileAction session={props.session} witness={props.witness} isCurrent={model.current} canInteract={model.interactive} onProfile={props.onProfile} /> }} />
    {model.notice ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 16, vertical: 12 }), background(model.state.notice?.tone === 'error' ? '#FCE8E6' : '#E6F4EA')]}><Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(model.state.notice?.tone === 'error' ? '#5F1412' : '#173A24')]}>{model.notice}</Text></VStack></BaseHost> : null}
    <AdminShellBodyFrame hasFooter={model.footer != null} testID="admin-user-create-body-frame"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surfaceContainerLow), cornerRadius(18)]}><RoleSelector model={model} /><Form key={model.formId} model={model} /></VStack></BaseHost>
    </ScrollView></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{model.footer}</View><AdminUserCreateOverlays model={model} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, fullWidth: { width: '100%' }, page: { paddingHorizontal: 4, paddingTop: 4 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
