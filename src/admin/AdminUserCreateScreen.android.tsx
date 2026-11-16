import { Button, Checkbox, CircularProgressIndicator, Column, IconButton, RNHostView, Row, Spacer, Surface, TextButton, TopAppBar, useNativeState, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminProfileAction } from './AdminProfileAction.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminOutlinedTextField as OutlinedTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import { UserCreateIcon, UserCreateSelectable, userCreateRounded } from './AdminUserCreateNative.android';
import { AdminUserCreateOverlays } from './AdminUserCreateOverlays.android';
import type { AdminUserCreateScreenProps } from './AdminUserCreateScreenTypes';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { useAdminUserCreate, type AdminUserCreateScreenModel } from './useAdminUserCreate';

function Field({ model, name, next }: { model: AdminUserCreateScreenModel; name: 'name' | 'phone'; next?: React.RefObject<TextFieldRef | null> }) {
  const { state } = model, native = useNativeState(model.fields[name]), filled = useRef(state.fillVersion), { colors, mode } = useBaseTheme();
  useEffect(() => { if (filled.current !== state.fillVersion && model.current()) { filled.current = state.fillVersion; native.set(model.fields[name]); } }, [native, state.fillVersion, name, model]);
  const label = model.a(name === 'name' ? 'user.name' : state.choice?.kind === 'customer' ? 'user.phone_optional' : 'user.phone');
  return <OutlinedTextField ref={name === 'phone' ? next : undefined} value={native} singleLine onValueChange={name === 'name' ? model.changeName : model.changePhone} shape={userCreateRounded(18)}
    keyboardOptions={{ keyboardType: name === 'phone' ? 'phone' : 'text', imeAction: name === 'name' ? 'next' : 'default' }} keyboardActions={{ onNext: () => { if (model.interactive()) void next?.current?.focus(); } }}
    textStyle={{ color: colors.onSurface, fontSize: 16, fontWeight: '400' }} colors={{ focusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest,
      unfocusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant }}
    modifiers={[fillMaxWidth(), semantics({ contentDescription: label }), testID(`admin-user-create-${name}`)]}>
    <OutlinedTextField.Label><Text style={{ fontSize: 14, fontWeight: '400' }}>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}
function RoleSelector({ model }: { model: AdminUserCreateScreenModel }) {
  const { colors, mode } = useBaseTheme(), chosen = !!model.state.choice;
  return <Column modifiers={[fillMaxWidth(), padding(12, 12, 12, 6)]}><Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium', fontWeight: '700' }}>{model.a('user.role_select')}</Text><Spacer modifiers={[height(6)]} />
    <Surface onClick={model.customerOnly ? undefined : model.rolePicker} color={mode === 'light' ? colors.surfaceBright : colors.surface} shape={userCreateRounded(18)} border={{ width: 1, color: colors.outlineVariant }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 66 }), testID('admin-user-create-role')]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
        <Surface color={colors.secondaryContainer} shape={userCreateRounded(999)} modifiers={[size(38, 38)]}><Row verticalAlignment="center" horizontalArrangement="center" modifiers={[size(38, 38)]}><UserCreateIcon name={chosen ? 'admin_panel_settings' : 'person_add_alt_1'} color={colors.onSecondaryContainer} iconSize={21} /></Row></Surface>
        <Spacer modifiers={[size(12, 1)]} /><Column modifiers={[weight(1)]}><Text style={{ typography: 'titleMedium' }}>{model.label}</Text><Spacer modifiers={[height(2)]} /><Text maxLines={1} color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.subtitle}</Text></Column>
        {!model.customerOnly ? <><Spacer modifiers={[size(10, 1)]} /><UserCreateIcon name="expand_more" color={colors.onSurfaceVariant} /></> : null}
      </Row>
    </Surface>
  </Column>;
}
function Save({ model }: { model: AdminUserCreateScreenModel }) {
  return <Button enabled={model.saveEnabled} onClick={model.save} shape={userCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-user-create-save')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(model.state.saving ? 'user.saving' : 'user.save')}</Text></Button>;
}
function WerkaCode({ model }: { model: AdminUserCreateScreenModel }) {
  const { colors, mode } = useBaseTheme();
  return <><Text style={{ typography: 'labelMedium', fontWeight: '700' }} color={colors.onSurfaceVariant}>{model.a('user.code')}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={mode === 'light' ? colors.surfaceBright : colors.surface} shape={userCreateRounded(18)} border={{ width: 1, color: colors.outlineVariant }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 58 })]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 6, 6, 6)]}><Column modifiers={[weight(1)]}><UserCreateSelectable value={model.codeCopyEnabled ? model.state.code : model.a('profile.code_not_shown')} /></Column>
        <IconButton enabled={model.codeCopyEnabled} onClick={model.copy} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.copy') }), testID('admin-user-create-code-copy')]}><UserCreateIcon name="content_copy" color={colors.onSurfaceVariant} /></IconButton>
        <IconButton enabled={model.regenerateEnabled} onClick={model.regenerate} modifiers={[size(48, 48), semantics({ contentDescription: model.a('user.code') }), testID('admin-user-create-code-regenerate')]}>{model.state.regenerating ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <UserCreateIcon name="refresh" color={colors.onSurfaceVariant} />}</IconButton>
      </Row>
    </Surface>{model.state.seconds > 0 ? <><Spacer modifiers={[height(12)]} /><Text>{model.a('user.code_retry', { seconds: model.state.seconds })}</Text></> : null}<Spacer modifiers={[height(14)]} />
  </>;
}
function Form({ model }: { model: AdminUserCreateScreenModel }) {
  const phone = useRef<TextFieldRef>(null), { colors } = useBaseTheme(), { state } = model;
  if (!state.choice) return null;
  if (state.choice.kind === 'werka' && state.phase !== 'ready') return <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(state.phase === 'loading' ? 24 : 20, state.phase === 'loading' ? 24 : 12, state.phase === 'loading' ? 24 : 20, 24)]}>
    {state.phase === 'loading' ? <AdminLoadingIndicator /> : <><Text style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }} color={colors.onSurfaceVariant}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} /><TextButton onClick={model.reload} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('admin-user-create-retry')]}><Text style={{ fontSize: 14, fontWeight: '600' }}>{model.t('retry')}</Text></TextButton></>}
  </Column>;
  return <>
    <Column modifiers={[fillMaxWidth(), padding(12, 8, 12, model.custom ? 0 : 24)]}>{state.choice.kind === 'werka' ? <WerkaCode model={model} /> : null}
      <Field model={model} name="name" next={phone} /><Spacer modifiers={[height(12)]} /><Field model={model} name="phone" next={phone} />
      {model.apparatusVisible ? <><Spacer modifiers={[height(16)]} />{state.apparatusLoading ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><AdminLoadingIndicator /></Column> : state.apparatus.length ? <>
        <Text style={{ typography: 'labelLarge' }}>{model.a('scope.allowed')}</Text><Spacer modifiers={[height(6)]} />{state.apparatus.map((item, index) => <Surface key={`${item.id}:${index}`} color="transparent" enabled={!!item.id} onClick={item.id ? () => model.selectApparatus(item.id, !state.selectedApparatus.includes(item.id)) : undefined} modifiers={[fillMaxWidth(), testID(`admin-user-create-apparatus-${index}`)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 48 })]}><Checkbox value={!!item.id && state.selectedApparatus.includes(item.id)} enabled={!!item.id} onCheckedChange={selected => model.selectApparatus(item.id, selected)} /><Spacer modifiers={[size(16, 1)]} /><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{item.name}</Text></Row>
        </Surface>)}</> : <Text style={{ typography: 'bodySmall' }}>{model.a('scope.empty')}</Text>}</> : null}
      {model.custom && model.material ? <><Spacer modifiers={[height(16)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium', fontWeight: '700' }}>{model.a('user.item_groups')}</Text><Spacer modifiers={[height(6)]} />
        <Surface color={colors.surface} border={{ width: 1, color: colors.outlineVariant }} shape={userCreateRounded(16)} enabled={!state.groupsLoading} onClick={model.groupPicker} modifiers={[fillMaxWidth(), testID('admin-user-create-groups')]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 14, 14, 14)]}><UserCreateIcon name="category" color={colors.onSurfaceVariant} iconSize={20} /><Spacer modifiers={[size(10, 1)]} /><Text maxLines={2} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{state.selectedGroups.length ? state.selectedGroups.join(', ') : model.a(state.groupsLoading ? 'user.groups_loading' : 'user.group_choose')}</Text><UserCreateIcon name="expand_more" color={colors.onSurfaceVariant} /></Row>
        </Surface></> : null}
      {!model.custom ? <><Spacer modifiers={[height(18)]} /><Save model={model} /></> : null}
    </Column>
    {model.custom ? <Column modifiers={[fillMaxWidth(), padding(12, 8, 12, 24)]}><Save model={model} /></Column> : null}
  </>;
}
/** @v2 AdminUserCreateScreen */
export type AdminUserCreateAndroidScreenProps = AdminUserCreateScreenProps & { windowObserver: AdminPresentationWindowObserver };
export function AdminUserCreateScreen(props: AdminUserCreateAndroidScreenProps) {
  if (!props.windowObserver || ['arm', 'waitForDetach', 'cancelPending', 'cancel'].some(key => typeof props.windowObserver[key as keyof AdminPresentationWindowObserver] !== 'function')) throw TypeError('Admin creation requires its genuine native window observer');
  const model = useAdminUserCreate(props), { colors } = useBaseTheme(), insets = useSafeAreaInsets(); if (!model.current() || !model.state.valid) return null;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <SafeAreaView edges={['left', 'right']}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={model.back} modifiers={[semantics({ contentDescription: props.backLabel }), testID('admin-user-create-back')]}><UserCreateIcon name="arrow_back" color={colors.onSurface} /></IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ typography: 'titleLarge', fontSize: 24, fontWeight: '800' }} maxLines={1}>{model.a('user.create_title')}</Text></TopAppBar.Title>
        <TopAppBar.Actions><RNHostView matchContents><View style={styles.profile}><AdminProfileAction session={props.session} witness={props.witness} isCurrent={model.current} canInteract={model.interactive} onProfile={props.onProfile} /></View></RNHostView></TopAppBar.Actions>
      </TopAppBar><Surface color={colors.surfaceContainerHigh} modifiers={[fillMaxWidth(), height(3)]} />
    </Column></BaseHost></SafeAreaView>
    {model.notice ? <SafeAreaView edges={['left', 'right']}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={model.state.notice?.tone === 'error' ? '#FCE8E6' : '#E6F4EA'} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}><Text color={model.state.notice?.tone === 'error' ? '#5F1412' : '#173A24'} style={{ typography: 'bodyMedium' }}>{model.notice}</Text></Column></Surface></BaseHost></SafeAreaView> : null}
    <AdminShellBodyFrame hasFooter={model.footer != null} testID="admin-user-create-body-frame"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.surfaceContainerLow} shape={userCreateRounded(18)} modifiers={[fillMaxWidth()]}><Column modifiers={[fillMaxWidth()]}><RoleSelector model={model} /><Form key={model.formId} model={model} /></Column></Surface></BaseHost>
    </ScrollView></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{model.footer}</View><AdminUserCreateOverlays model={model} windowObserver={props.windowObserver} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, fullWidth: { width: '100%' }, profile: { width: 58, height: 60, justifyContent: 'center' }, page: { paddingHorizontal: 4, paddingTop: 4 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
