import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { Button, Divider, HStack, Image, ProgressView, RNHostView, ScrollView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, background, buttonStyle, clipped, controlSize, cornerRadius, disabled, font, foregroundStyle, frame,
  keyboardType, labelStyle, lineLimit, onSubmit, padding, rotationEffect, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import type { AdminWorkerDetailScreenProps } from './AdminWorkerDetailTypes';
import { WorkerMaterialResponsibilities, WorkerWarehouseEditor } from './AdminWorkerDetailEditors.ios';
import { WorkerDetailOverlays } from './AdminWorkerDetailOverlays.ios';
import { dartTrim } from './dartJsonString';
import { useAdminWorkerDetail, type AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';

function Chip({ label, icon }: { label: string; icon: 'phone.fill' | 'person.text.rectangle' | 'building.2' }) {
  const { colors } = useBaseTheme(); return <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: 8 }), background(`${colors.surfaceContainerHighest.slice(0, 7)}B8`), cornerRadius(999)]}>
    <Image systemName={icon} size={15} modifiers={[foregroundStyle('secondary')]} /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('secondary'), lineLimit(1)]}>{label}</Text>
  </HStack>;
}
function Phone({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { state, detail, a } = model, native = useNativeState(state.phoneDraft), filled = useRef(state.phoneFillVersion), { colors } = useBaseTheme();
  useEffect(() => { if (filled.current !== state.phoneFillVersion && model.current()) { filled.current = state.phoneFillVersion; native.set(state.phoneDraft); } }, [native, state.phoneFillVersion, state.phoneDraft, model]);
  const phone = dartTrim(detail.phone);
  return <HStack spacing={8} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 72 }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
    {state.phoneEditing ? <TextField text={native} autoFocus placeholder={model.u('+998901234567')} onTextChange={model.changePhone}
      modifiers={[keyboardType('phone-pad'), submitLabel('done'), onSubmit(model.submitPhone), font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier('admin-worker-detail-phone-input'), accessibilityLabel(a('profile.phone'))]} />
      : <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{phone || a('profile.entered')}</Text>}
    <Button onPress={model.phoneAction} modifiers={[buttonStyle('plain'), disabled(state.savingPhone), frame({ minWidth: 44, minHeight: 44 }), accessibilityIdentifier('admin-worker-detail-phone-action'), accessibilityLabel(a(state.phoneEditing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone'))]}>
      {state.savingPhone ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName={state.phoneEditing ? 'checkmark' : 'pencil'} size={20} />}
    </Button>
  </HStack>;
}
function Controls({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { state, detail, a } = model, { colors } = useBaseTheme(), hasCode = !!dartTrim(detail.code);
  return <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 16, bottom: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Divider /><Text modifiers={[font({ textStyle: 'headline' }), padding({ top: 14 })]}>{a('profile.admin_controls')}</Text>
    <Text modifiers={[font({ textStyle: 'caption' }), padding({ top: 14, bottom: 6 })]}>{a('profile.phone')}</Text><Phone model={model} />
    <Text modifiers={[font({ textStyle: 'caption' }), padding({ top: 14, bottom: 6 })]}>{a('profile.access_code')}</Text>
    <HStack spacing={8} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 72 }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{hasCode ? detail.code : a('profile.code_not_shown')}</Text>
      {hasCode ? <Button onPress={model.copy} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(a('profile.code_copy_hint')), accessibilityIdentifier('admin-worker-detail-copy-code')]}><Image systemName="doc.on.doc" size={20} /></Button> : null}
      <Button onPress={model.regenerate} modifiers={[buttonStyle('plain'), disabled(state.regeneratingCode), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(a('profile.access_code')), accessibilityIdentifier('admin-worker-detail-regenerate-code')]}>
        {state.regeneratingCode ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="arrow.clockwise" size={20} />}
      </Button>
    </HStack>
    {hasCode ? <Text modifiers={[font({ textStyle: 'caption' }), padding({ top: 8 })]}>{a('profile.code_copy_hint')}</Text> : null}
    {detail.code_retry_after_sec > 0 ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), padding({ top: 12 })]}>{a('profile.code_wait', { seconds: detail.code_retry_after_sec })}</Text> : null}
    {model.warehouseEnabled ? <VStack modifiers={[padding({ top: 18 }), frame({ maxWidth: Infinity })]}><WorkerWarehouseEditor model={model} /></VStack> : null}
  </VStack>;
}
function Profile({ model, props }: { model: AdminWorkerDetailScreenModel; props: AdminWorkerDetailScreenProps }) {
  const { state, detail, a } = model, { colors } = useBaseTheme();
  const chatAction = props.renderChatAction?.(model.scopeCurrent, model.interactive);
  return <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), clipped(), animation(Animation.easeOut({ duration: .18 }), state.expanded)]}>
    <RNHostView matchContents={{ vertical: true }}><View style={styles.profileHeader}>
      <View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(colors.onSecondaryContainer), padding({ horizontal: 12, vertical: 8 }), background(colors.secondaryContainer), cornerRadius(999)]}>{model.status}</Text></BaseHost></View>
      <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.scopeCurrent, canInteract: model.interactive })}</View>
      <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), lineLimit(1)]}>{model.displayName}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{model.subtitle}</Text></VStack></BaseHost></View>
    </View></RNHostView>
    <HStack alignment="bottom" spacing={8} modifiers={[padding({ leading: 16, trailing: 16, top: 2, bottom: 16 })]}>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Chip icon="phone.fill" label={dartTrim(detail.phone) || a('profile.phone_missing')} /><Chip icon="person.text.rectangle" label={dartTrim(detail.level) || a('detail.level_missing')} />
        {model.warehouseEnabled ? <Chip icon="building.2" label={a('detail.warehouses_count', { count: state.warehouses.length })} /> : null}
        {chatAction ? <RNHostView matchContents>{chatAction}</RNHostView> : null}
      </VStack>
      {!model.readOnly ? <Button onPress={model.toggle} modifiers={[buttonStyle('plain'), frame({ minWidth: 44, minHeight: 44 }), accessibilityIdentifier('admin-worker-detail-admin-toggle'), accessibilityLabel(a(state.expanded ? 'profile.controls_close' : 'profile.controls_open'))]}>
        <Image systemName="chevron.down" size={20} modifiers={[foregroundStyle('secondary'), rotationEffect(state.expanded ? 180 : 0), animation(Animation.easeOut({ duration: .18 }), state.expanded)]} />
      </Button> : null}
    </HStack>
    {!model.readOnly && state.expanded ? <Controls key={`${model.generation}:${model.phoneGeneration}`} model={model} /> : null}
  </VStack>;
}
function Activity({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { state, a } = model;
  if (state.profileLoading && state.profile === null) return <HStack spacing={12}><ProgressView modifiers={[frame({ width: 18, height: 18 })]} /><Text>{a('detail.activity_loading')}</Text></HStack>;
  if (state.profileError && state.profile === null) return <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{a('detail.activity_load_failed')}</Text>
    <Button label={a('detail.retry')} onPress={model.retryProfile} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-worker-detail-profile-retry')]} /></VStack>;
  const values = model.apparatusLabels.length ? model.apparatusLabels : [a('detail.no_assignment')];
  return <VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{a('detail.worker_activity')}</Text>
    {values.map((value, index) => <VStack key={`${value}:${index}`} alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{index ? <Divider /> : null}<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{a('label.apparatus')}</Text><Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' })]}>{dartTrim(value) ? value : a('profile.entered')}</Text></VStack>)}
  </VStack>;
}
/** @v2 AdminWorkerDetailScreen */
export function AdminWorkerDetailScreen(props: AdminWorkerDetailScreenProps) {
  const model = useAdminWorkerDetail(props), { state, a } = model, { colors } = useBaseTheme();
  if (!model.scopeCurrent()) return null;
  const action = (label: string, press: () => void, id: string) => <Button label={label} onPress={press} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 54 }), padding({ top: 12 }), accessibilityIdentifier(id)]} />;
  return <><Stack.Screen options={{ headerShown: true, title: a('profile.title'), headerBackVisible: false, gestureEnabled: false, headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={() => { model.back(); }} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(props.backLabel)]} /></BaseHost> }} />
    <View style={[styles.root, { backgroundColor: colors.surfaceContainerHigh }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-worker-detail-body-frame"><BaseHost style={styles.body}><ScrollView><VStack spacing={0} modifiers={[padding({ leading: 4, trailing: 4, top: 4, bottom: 116 }), frame({ maxWidth: Infinity })]}>
      <Profile model={model} props={props} />
      {model.preparation ? <VStack modifiers={[padding({ all: 16 }), frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), padding({ top: 12 })]}><WorkerMaterialResponsibilities model={model} /></VStack> : null}
      {!model.system ? <VStack modifiers={[padding({ all: 14 }), frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), padding({ top: 12 })]}><Activity model={model} /></VStack> : null}
      {!model.readOnly && !model.system ? action(a('detail.worker_activity'), model.openActivity, 'admin-worker-detail-activity') : null}
      {state.loadError ? action(a('detail.reload'), model.reload, 'admin-worker-detail-reload') : null}
    </VStack></ScrollView></BaseHost></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View><WorkerDetailOverlays model={model} />{model.notice ? <PreparationNotice message={model.notice} /> : null}</View>
  </>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, profileHeader: { height: 204, width: '100%' },
  banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' }, status: { position: 'absolute', right: 14, top: 14 }, avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 } });
