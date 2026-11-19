import { Button, Form, HStack, Image, ProgressView, Section, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, controlSize, disabled, font, foregroundStyle, frame, labelStyle, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useAdminShellTheme } from './useAdminShellTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { appRoutes } from '../shared/appRoutes';
import { adminSettingsFieldLabels, adminSettingsFieldNames, type AdminSettingsField } from './adminSettingsController';
import type { AdminSettingsScreenProps } from './AdminSettingsTypes';
import { useAdminSettings } from './useAdminSettings';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';

function SettingsField({ label, value, fillVersion, change, name }: { label: string; value: string; fillVersion: number;
  change: (value: string) => void; name: AdminSettingsField }) {
  const native = useNativeState(value), filled = useRef(fillVersion);
  useEffect(() => { if (filled.current !== fillVersion) { filled.current = fillVersion; native.set(value); } }, [native, fillVersion, value]);
  return <VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{label}</Text>
    <TextField text={native} placeholder={label} onTextChange={change}
      modifiers={[textFieldStyle('roundedBorder'), accessibilityIdentifier(`admin-settings-${name}`)]} />
  </VStack>;
}

/** @v2 AdminSettingsScreen */
export function AdminSettingsScreen(props: AdminSettingsScreenProps) {
  const model = useAdminSettings(props), { state, t, a, p } = model, { chromeBackground } = useAdminShellTheme();
  if (!model.current || state.phase === 'invalidated') return <View style={styles.root} />;
  const field = (name: AdminSettingsField) => <SettingsField key={name} name={name} value={state.fields[name]} fillVersion={state.fillVersion}
    label={a(`settings.${adminSettingsFieldLabels[name]}`)} change={value => model.change(name, value)} />;
  return <><Stack.Screen options={{ headerShown: true, title: t('adminSettingsTitle'), gestureEnabled: false, headerBackVisible: false,
    headerRight: props.profileAction ? () => props.profileAction : undefined,
    headerLeft: () => <BaseHost matchContents><Button onPress={model.navigation!.onPress} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), accessibilityLabel(model.navigation!.label), frame({ minWidth: 44, minHeight: 44 })]}><Image systemName={model.navigation!.icon === 'back' ? 'chevron.left' : 'line.3.horizontal'} size={20} /></Button></BaseHost> }} />
    <View style={[styles.root, { backgroundColor: chromeBackground }]}>{props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-settings-body-frame"><View style={styles.content}><BaseHost style={styles.body}>
      {state.phase === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        state.phase === 'error' ? <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <Text>{t('serverDisconnectedRetry')}</Text><Button label={t('retry')} onPress={() => { model.reload(); }} /></VStack> :
          <Form>
            {(model.additional || model.push) ? <Section>
              {model.additional ? <Button onPress={() => model.navigate(appRoutes.adminAdditionalSettings)}><HStack spacing={12}>
                <Image systemName="slider.horizontal.3" /><Text>{p('paddon.management.settings.title')}</Text><Spacer /><Image systemName="chevron.right" size={13} />
              </HStack></Button> : null}
              {model.push ? <Button onPress={() => model.navigate(appRoutes.adminPushConfig)}><HStack spacing={12}>
                <Image systemName="bell.badge" /><Text>{a('push.title')}</Text><Spacer /><Image systemName="chevron.right" size={13} />
              </HStack></Button> : null}
            </Section> : null}
            <Section header={<VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'title3' })]}>{t('erpConnectionTitle')}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{t('erpConnectionSubtitle')}</Text></VStack>}>
              {adminSettingsFieldNames.slice(0, 5).map(field)}
            </Section>
            <Section header={<VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'title3' })]}>{t('adminSettingsSectionTitle')}</Text>
              <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{t('adminSettingsSectionSubtitle')}</Text></VStack>}>
              {field('werka_phone')}{field('werka_name')}
              <Button onPress={model.save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(state.saving), accessibilityIdentifier('admin-settings-save')]}>
                <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 40 })]}>
                  {state.saving ? <ProgressView /> : <Image systemName="checkmark" size={20} />}<Text>{t(state.saving ? 'pinSaving' : 'save')}</Text>
                </HStack>
              </Button>
            </Section>
          </Form>}
    </BaseHost></View></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>{state.notice !== null ? <PreparationNotice message={t('settingsSaved')} /> : null}</View>
  </>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, content: { flex: 1, paddingStart: 12, paddingEnd: 14 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
