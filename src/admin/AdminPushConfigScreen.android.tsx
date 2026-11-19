import { Button, Column, IconButton, LinearProgressIndicator, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, TextButton, useNativeState } from '@expo/ui/jetpack-compose';
import { AdminTopBar } from './AdminTopBar.android';
import { fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text as NativeText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminOutlinedTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminPushConfigScreenProps } from './AdminPushConfigScreenTypes';
import { useAdminPushConfig, type AdminPushConfigScreenModel } from './useAdminPushConfig';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function Icon({ name, color }: { name: string; color: string }) {
  return <RNHostView matchContents><SymbolView name={{ android: name as 'upload_file' }} size={24} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
function Card({ children }: { children: ReactNode }) {
  const { colors } = useBaseTheme();
  return <Column modifiers={[fillMaxWidth(), padding(4, 4, 4, 4)]}><Surface color={colors.surface} shape={rounded(12)} shadowElevation={1} modifiers={[fillMaxWidth()]}>
    <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>{children}</Column>
  </Surface></Column>;
}
function Action({ label, click, enabled, id, filled = false, icon }: { label: string; click: () => void; enabled: boolean; id: string; filled?: boolean; icon?: string }) {
  const { colors } = useBaseTheme(), Component = filled ? Button : OutlinedButton;
  return <Component onClick={click} enabled={enabled} shape={rounded(20)} modifiers={[fillMaxWidth(), height(56), testID(id)]}>
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{icon ? <Icon name={icon} color={enabled ? filled ? colors.onPrimary : colors.onSurface : colors.onSurfaceVariant} /> : null}<Text style={{ typography: 'labelLarge' }}>{label}</Text></Row>
  </Component>;
}
function Body({ model }: { model: AdminPushConfigScreenModel }) {
  const { state, t, deviceState } = model, config = state.config, { colors } = useBaseTheme(), input = useNativeState(state.json), filled = useRef(state.fillVersion);
  useEffect(() => { if (filled.current !== state.fillVersion) { filled.current = state.fillVersion; input.set(state.json); } }, [input, state.fillVersion, state.json]);
  return <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(16, 16, 16, 16)]}>
    {state.busy ? <LinearProgressIndicator modifiers={[fillMaxWidth(), testID('push-config-progress')]} /> : null}
    {config ? <Card><Text style={{ typography: 'titleMedium' }}>{t(config.configured ? 'configured' : 'not_configured')}</Text>
      {config.project_id ? <><Spacer modifiers={[height(8)]} /><RNHostView matchContents={{ vertical: true }}><View>
        <NativeText selectable style={{ color: colors.onSurface, fontSize: 14 }}>{`${t('project')}: ${config.project_id}`}</NativeText>
        <NativeText selectable style={{ color: colors.onSurface, fontSize: 14 }}>{config.client_email}</NativeText>
      </View></RNHostView></> : null}
      <Spacer modifiers={[height(8)]} /><Text>{t(config.last_verified_at !== null ? 'verified' : 'not_checked')}</Text>
    </Card> : null}
    <Card><Text style={{ typography: 'titleMedium' }}>{t('device_title')}</Text><Spacer modifiers={[height(8)]} />
      <Text modifiers={[testID('push-device-status')]}>{t(model.errorKey(deviceState.status))}</Text>
      {deviceState.errorDetail !== null ? <Text modifiers={[testID('push-device-error-detail')]}>{deviceState.errorDetail}</Text> : null}
      <TextButton onClick={model.applyDevice} enabled={model.enabled}><Text>{t('apply_device')}</Text></TextButton>
    </Card>
    <Spacer modifiers={[height(16)]} /><Text>{t('instructions')}</Text><Spacer modifiers={[height(12)]} />
    <Action label={t('pick')} click={model.pick} enabled={model.enabled} icon="upload_file" id="push-config-pick" />
    {state.fileName !== null ? <Text>{state.fileName}</Text> : null}<Spacer modifiers={[height(12)]} />
    <AdminOutlinedTextField value={input} enabled={model.enabled} minLines={3} maxLines={6} onValueChange={model.changeJson}
      keyboardOptions={{ autoCorrectEnabled: false, capitalization: 'none' }} modifiers={[fillMaxWidth(), testID('push-config-json')]}>
      <AdminOutlinedTextField.Label><Text>{t('json')}</Text></AdminOutlinedTextField.Label>
    </AdminOutlinedTextField><Spacer modifiers={[height(12)]} />
    <Action label={t('save')} click={model.save} enabled={model.enabled} filled icon="save" id="push-config-save" /><Spacer modifiers={[height(8)]} />
    <Action label={t('check')} click={model.check} enabled={model.configuredEnabled} id="push-config-check" />
    <Action label={t('test')} click={model.test} enabled={model.configuredEnabled} id="push-config-test" />
    <TextButton onClick={model.reload} enabled={model.enabled}><Text>{t('refresh')}</Text></TextButton>
    {state.error !== null ? <Text color={colors.error} modifiers={[testID('push-config-error')]}>{t(model.errorKey(state.error))}</Text> : null}
    {state.notice !== null ? <Text modifiers={[testID('push-config-notice')]}>{t(state.notice)}</Text> : null}
    <Spacer modifiers={[height(16)]} /><Text style={{ typography: 'titleMedium' }}>{t('mobile_title')}</Text><Spacer modifiers={[height(8)]} /><Text>{t('mobile_instructions')}</Text>
    {(['android', 'ios'] as const).map(platform => <Column key={platform} modifiers={[fillMaxWidth()]}>
      <Row verticalAlignment="center" horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}>
        <Column><Text>{platform === 'android' ? 'Android' : 'iPhone'}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{t(config?.[platform] ? 'mobile_configured' : 'mobile_missing')}</Text></Column>
        <Icon name={config?.[platform] ? 'check_circle_outline' : 'error_outline'} color={colors.onSurfaceVariant} />
      </Row><Action label={platform === 'android' ? 'google-services.json' : 'GoogleService-Info.plist'} click={() => model.pickMobile(platform)} enabled={model.configuredEnabled} icon="upload_file" id={`push-config-${platform}`} />
    </Column>)}
    <Spacer modifiers={[height(16)]} /><Text style={{ typography: 'bodySmall' }}>{t('ios_hint')}</Text>
  </Column>;
}
/** @v2 AdminPushConfigScreen */
export function AdminPushConfigScreen(props: AdminPushConfigScreenProps) {
  const model = useAdminPushConfig(props), { colors } = useBaseTheme();
  if (!model.current || model.state.invalidated) return <View style={styles.root} />;
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.root, { backgroundColor: colors.surfaceContainerLow }]}><BaseHost style={styles.root}>
    <Column modifiers={[fillMaxSize()]}><AdminTopBar leading={<IconButton onClick={model.back} modifiers={[size(48, 48), semantics({ contentDescription: model.backLabel }), testID('push-config-back')]}><Icon name="arrow_back" color={colors.onSurface} /></IconButton>}
      title={<Text style={{ typography: 'titleLarge' }}>{model.t('title')}</Text>} /><Column modifiers={[fillMaxWidth(), weight(1)]} verticalArrangement={model.allowed ? undefined : 'center'} horizontalAlignment={model.allowed ? undefined : 'center'}>
      {model.allowed ? <Body model={model} /> : <Text>{model.t('admin_only')}</Text>}
    </Column></Column>
  </BaseHost></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 } });
