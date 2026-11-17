import { Button, HStack, Image, ProgressView, ScrollView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, autocorrectionDisabled, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, lineLimit, padding, textFieldStyle, textInputAutocapitalization, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminPushConfigScreenProps } from './AdminPushConfigScreenTypes';
import { useAdminPushConfig, type AdminPushConfigScreenModel } from './useAdminPushConfig';

function Card({ children }: { children: ReactNode }) {
  const { colors } = useBaseTheme();
  return <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' }), background(colors.surface), cornerRadius(12)]}>{children}</VStack>;
}
function Action({ label, click, enabled, id, filled = false, icon }: { label: string; click: () => void; enabled: boolean; id: string; filled?: boolean; icon?: ComponentProps<typeof Image>['systemName'] }) {
  return <Button onPress={click} modifiers={[buttonStyle(filled ? 'borderedProminent' : 'bordered'), controlSize('large'), disabled(!enabled), accessibilityIdentifier(id)]}>
    <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 40 })]}>{icon ? <Image systemName={icon} size={20} /> : null}<Text>{label}</Text></HStack>
  </Button>;
}
function Body({ model }: { model: AdminPushConfigScreenModel }) {
  const { state, t, deviceState } = model, config = state.config, input = useNativeState(state.json), filled = useRef(state.fillVersion);
  useEffect(() => { if (filled.current !== state.fillVersion) { filled.current = state.fillVersion; input.set(state.json); } }, [input, state.fillVersion, state.json]);
  return <ScrollView><VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    {state.busy ? <ProgressView modifiers={[accessibilityIdentifier('push-config-progress')]} /> : null}
    {config ? <Card><Text modifiers={[font({ textStyle: 'headline' })]}>{t(config.configured ? 'configured' : 'not_configured')}</Text>
      {config.project_id ? <><Text modifiers={[textSelection(true)]}>{`${t('project')}: ${config.project_id}`}</Text><Text modifiers={[textSelection(true)]}>{config.client_email}</Text></> : null}
      <Text>{t(config.last_verified_at !== null ? 'verified' : 'not_checked')}</Text>
    </Card> : null}
    <Card><Text modifiers={[font({ textStyle: 'headline' })]}>{t('device_title')}</Text>
      <Text modifiers={[accessibilityIdentifier('push-device-status')]}>{t(model.errorKey(deviceState.status))}</Text>
      {deviceState.errorDetail !== null ? <Text modifiers={[accessibilityIdentifier('push-device-error-detail')]}>{deviceState.errorDetail}</Text> : null}
      <Button label={t('apply_device')} onPress={model.applyDevice} modifiers={[disabled(!model.enabled), controlSize('large')]} />
    </Card><Text>{t('instructions')}</Text>
    <Action label={t('pick')} click={model.pick} enabled={model.enabled} icon="doc.badge.plus" id="push-config-pick" />
    {state.fileName !== null ? <Text>{state.fileName}</Text> : null}
    <VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{t('json')}</Text>
      <TextField text={input} axis="vertical" placeholder={t('json')} onTextChange={model.changeJson}
        modifiers={[textFieldStyle('roundedBorder'), lineLimit({ min: 3, max: 6 }), autocorrectionDisabled(), textInputAutocapitalization('never'), disabled(!model.enabled), accessibilityIdentifier('push-config-json')]} />
    </VStack>
    <Action label={t('save')} click={model.save} enabled={model.enabled} filled icon="square.and.arrow.down" id="push-config-save" />
    <Action label={t('check')} click={model.check} enabled={model.configuredEnabled} id="push-config-check" />
    <Action label={t('test')} click={model.test} enabled={model.configuredEnabled} id="push-config-test" />
    <Button label={t('refresh')} onPress={model.reload} modifiers={[disabled(!model.enabled), controlSize('large')]} />
    {state.error !== null ? <Text modifiers={[foregroundStyle('red'), accessibilityIdentifier('push-config-error')]}>{t(model.errorKey(state.error))}</Text> : null}
    {state.notice !== null ? <Text modifiers={[accessibilityIdentifier('push-config-notice')]}>{t(state.notice)}</Text> : null}
    <Text modifiers={[font({ textStyle: 'headline' })]}>{t('mobile_title')}</Text><Text>{t('mobile_instructions')}</Text>
    {(['android', 'ios'] as const).map(platform => <VStack key={platform} alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <HStack><VStack alignment="leading" spacing={4}><Text>{platform === 'android' ? 'Android' : 'iPhone'}</Text>
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{t(config?.[platform] ? 'mobile_configured' : 'mobile_missing')}</Text></VStack><Spacer />
        <Image systemName={config?.[platform] ? 'checkmark.circle' : 'exclamationmark.circle'} /></HStack>
      <Action label={platform === 'android' ? 'google-services.json' : 'GoogleService-Info.plist'} click={() => model.pickMobile(platform)} enabled={model.configuredEnabled} icon="doc.badge.plus" id={`push-config-${platform}`} />
    </VStack>)}<Text modifiers={[font({ textStyle: 'caption' })]}>{t('ios_hint')}</Text>
  </VStack></ScrollView>;
}
/** @v2 AdminPushConfigScreen */
export function AdminPushConfigScreen(props: AdminPushConfigScreenProps) {
  const model = useAdminPushConfig(props), { colors } = useBaseTheme();
  if (!model.current || model.state.invalidated) return <View style={styles.root} />;
  return <><Stack.Screen options={{ headerShown: true, title: model.t('title'), headerBackVisible: false,
    headerLeft: () => <RoleHeaderButton icon="back" label={model.backLabel} onPress={model.back} tintColor={colors.onSurface} /> }} />
    <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow }]}><BaseHost style={styles.root}>
      {model.allowed ? <Body model={model} /> : <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><Text>{model.t('admin_only')}</Text></VStack>}
    </BaseHost></View>
  </>;
}
const styles = StyleSheet.create({ root: { flex: 1 } });
