import { Button, HStack, Image, ProgressView, RNHostView, ScrollView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, background, buttonStyle, clipped, controlSize, cornerRadius, disabled,
  font, foregroundStyle, frame, keyboardType, labelStyle, lineLimit, multilineTextAlignment, onSubmit, padding, rotationEffect, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { uiText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminWerkaScreenProps } from './AdminWerkaScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminWerka, type AdminWerkaScreenModel } from './useAdminWerka';

/** Native buffers deliberately ignore busy/countdown rebuilds; only _fill replaces text. */
export function NativeWerkaNameField({ model }: { model: AdminWerkaScreenModel }) {
  const { state, fields } = model, native = useNativeState(fields.name), filled = useRef(state.fillVersion), attached = useRef(false);
  useLayoutEffect(() => { attached.current = true; return () => { attached.current = false; }; }, []);
  useEffect(() => { if (filled.current !== state.fillVersion && model.current()) { filled.current = state.fillVersion; native.set(fields.name); } }, [native, state.fillVersion, fields.name, model]);
  return <TextField text={native} placeholder={model.a('profile.name_placeholder')} onTextChange={value => { if (attached.current && model.interactive()) model.changeName(value); }}
    modifiers={[textFieldStyle('roundedBorder'), font({ textStyle: 'body' }), accessibilityLabel(model.a('profile.name')), accessibilityIdentifier('admin-werka-detail-name-input')]} />;
}
export function NativeWerkaPhoneField({ model }: { model: AdminWerkaScreenModel }) {
  const { state, fields } = model, native = useNativeState(fields.phone), filled = useRef(state.fillVersion), [editing, setEditing] = useState<number | null>(null),
    lifetime = useRef({ active: false, serial: 0, nextEditor: 0, editor: null as number | null, saving: state.saving }), { colors } = useBaseTheme();
  useLayoutEffect(() => { const ticket = lifetime.current; ticket.active = true; ticket.serial++; return () => { ticket.active = false; ticket.editor = null; ticket.serial++; }; }, []);
  useLayoutEffect(() => { lifetime.current.saving = state.saving; }, [state.saving]);
  useEffect(() => { if (filled.current !== state.fillVersion && model.current()) { filled.current = state.fillVersion; native.set(fields.phone); } }, [native, state.fillVersion, fields.phone, model]);
  const submit = async () => {
    if (!lifetime.current.active || !model.interactive() || lifetime.current.saving || editing === null || lifetime.current.editor !== editing) return;
    const original = lifetime.current.serial;
    if (await model.save() && lifetime.current.active && original === lifetime.current.serial && lifetime.current.editor === editing && model.current()) {
      lifetime.current.editor = null; setEditing(null);
    }
  };
  // Expo's modifier factory stores this callback; only the native submit event invokes it.
  // eslint-disable-next-line react-hooks/refs
  const submitted = onSubmit(() => { void submit(); });
  const phone = dartTrim(fields.phone);
  return <HStack spacing={8} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 56 }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
    {editing !== null ? <TextField text={native} autoFocus placeholder={uiText('+998 90 123 45 67', localeController.locale)} onTextChange={value => { if (lifetime.current.active && lifetime.current.editor === editing && model.interactive()) model.changePhone(value); }}
      modifiers={[keyboardType('phone-pad'), submitLabel('done'), submitted, font({ textStyle: 'body' }),
        frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityLabel(model.a('profile.phone')), accessibilityIdentifier('admin-werka-detail-phone-input')]} /> :
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{phone || model.a('profile.entered')}</Text>}
    <Button onPress={() => {
      if (!lifetime.current.active || !model.interactive() || lifetime.current.saving) return;
      if (editing !== null) void submit();
      else if (lifetime.current.editor === null) { const editor = ++lifetime.current.nextEditor; lifetime.current.editor = editor; setEditing(editor); }
    }} modifiers={[buttonStyle('plain'), disabled(state.saving), frame({ width: 32, height: 32 }),
      accessibilityLabel(model.a(editing !== null ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone')), accessibilityIdentifier('admin-werka-detail-phone-action')]}>
      {state.saving ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName={editing !== null ? 'checkmark' : 'pencil'} size={20} modifiers={[foregroundStyle(colors.onSurface)]} />}
    </Button>
  </HStack>;
}
function Controls({ model }: { model: AdminWerkaScreenModel }) {
  const { state } = model, { colors } = useBaseTheme(), hasCode = !!dartTrim(state.code);
  return <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 16, bottom: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' })]}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[frame({ height: 14 })]} />
    <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.name')}</Text><Spacer modifiers={[frame({ height: 6 })]} /><NativeWerkaNameField model={model} />
    <Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.phone')}</Text><Spacer modifiers={[frame({ height: 6 })]} /><NativeWerkaPhoneField model={model} />
    <Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.access_code')}</Text><Spacer modifiers={[frame({ height: 6 })]} />
    <HStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{hasCode ? state.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <Button onPress={model.copy} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }),
        accessibilityLabel(model.a('profile.code_copy_hint')), accessibilityIdentifier('admin-werka-detail-copy-code')]}><Image systemName="document.on.document" size={22} /></Button> : null}
      <Button onPress={model.regenerate} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), disabled(state.regenerating),
        accessibilityIdentifier('admin-werka-detail-regenerate-code')]}>
        {state.regenerating ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="arrow.clockwise" size={22} />}
      </Button>
    </HStack>
    {hasCode ? <><Spacer modifiers={[frame({ height: 8 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {state.seconds > 0 ? <><Spacer modifiers={[frame({ height: 12 })]} /><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.a('profile.code_wait', { seconds: state.seconds })}</Text></> : null}
    <Spacer modifiers={[frame({ height: 18 })]} /><Button onPress={() => { void model.save(); }}
      modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(state.saving), frame({ maxWidth: Infinity, minHeight: 54 }), accessibilityIdentifier('admin-werka-detail-save')]}>
      <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a(state.saving ? 'profile.saving' : 'profile.save')}</Text>
    </Button>
  </VStack>;
}
function Chip({ label, icon }: { label: string; icon: 'phone.fill' | 'building.2.fill' }) {
  const { colors } = useBaseTheme();
  return <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: 8 }), background(`${colors.surfaceContainerHighest.slice(0, 7)}B8`), cornerRadius(999)]}>
    <Image systemName={icon} size={15} modifiers={[foregroundStyle('secondary')]} /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('secondary'), lineLimit(1)]}>{label}</Text>
  </HStack>;
}
function Header({ model, props }: { model: AdminWerkaScreenModel; props: AdminWerkaScreenProps }) {
  const { colors } = useBaseTheme();
  return <RNHostView matchContents={{ vertical: true }}><View style={styles.profileHeader}>
    <View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(colors.onSecondaryContainer),
      padding({ horizontal: 12, vertical: 8 }), background(colors.secondaryContainer), cornerRadius(999)]}>{model.a('profile.ready')}</Text></BaseHost></View>
    <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: model.state.avatarUrl, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current })}</View>
    <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), lineLimit(1)]}>{model.displayName}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{model.a('profile.description')}</Text>
    </VStack></BaseHost></View>
  </View></RNHostView>;
}
function Detail({ model, props }: { model: AdminWerkaScreenModel; props: AdminWerkaScreenProps }) {
  const { state } = model, { colors } = useBaseTheme();
  return <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), clipped(), animation(Animation.easeOut({ duration: .18 }), state.expanded)]}>
    <Header model={model} props={props} />
    <HStack alignment="bottom" spacing={8} modifiers={[padding({ leading: 16, trailing: 16, top: 2, bottom: 16 })]}>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Chip icon="phone.fill" label={dartTrim(model.fields.phone) || model.a('profile.phone_missing')} /><Chip icon="building.2.fill" label={model.a('profile.warehouse_worker')} />
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </VStack>
      <Button onPress={model.toggle} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open')), accessibilityIdentifier('admin-werka-detail-admin-toggle')]}>
        <Image systemName="chevron.down" size={20} modifiers={[foregroundStyle('secondary'), rotationEffect(state.expanded ? 180 : 0), animation(Animation.easeOut({ duration: .18 }), state.expanded)]} />
      </Button>
    </HStack>
    {state.expanded ? <Controls key={`${model.generation}:${state.fillVersion}`} model={model} /> : null}
  </VStack>;
}

// @v2 AdminWerkaScreen, _AdminWerkaDetailCard and _WerkaAdminPanel; native SwiftUI controls.
export function AdminWerkaScreen(props: AdminWerkaScreenProps) {
  const model = useAdminWerka(props), { state } = model, { colors } = useBaseTheme();
  if (!model.current() || state.phase === 'invalidated') return null;
  return <><Stack.Screen options={{ headerShown: true, title: model.a('profile.title'), headerBackVisible: false, gestureEnabled: false,
    headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={model.back}
      modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel), accessibilityIdentifier('admin-werka-back')]} /></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerLow }]}><BaseHost style={styles.body}>
      {state.phase === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        state.phase === 'error' ? <ScrollView><VStack spacing={16} modifiers={[padding({ leading: 20, trailing: 20, top: 4, bottom: 24 }), frame({ maxWidth: Infinity })]}>
          <Text modifiers={[foregroundStyle('secondary'), multilineTextAlignment('center')]}>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.reload} modifiers={[accessibilityIdentifier('admin-werka-retry')]} />
        </VStack></ScrollView> : <ScrollView><VStack modifiers={[padding({ leading: 4, trailing: 4, top: 4, bottom: 116 }), frame({ maxWidth: Infinity })]}><Detail model={model} props={props} /></VStack></ScrollView>}
    </BaseHost>{props.footer}{state.copiedNotice !== null ? <PreparationNotice message={model.a('profile.code_copied')} /> : null}</View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' },
  profileHeader: { height: 204, width: '100%' }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' },
  status: { position: 'absolute', right: 14, top: 14 }, avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 } });
