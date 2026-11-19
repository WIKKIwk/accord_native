import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { Button, Divider, HStack, Image, ProgressView, RNHostView, ScrollView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, background, buttonStyle, clipped, controlSize, cornerRadius, disabled,
  font, foregroundStyle, frame, keyboardType, labelStyle, lineLimit, multilineTextAlignment, onSubmit, padding, rotationEffect, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { Modal, Pressable, ScrollView as RNScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { uiText } from '../shared/localization';
import type { AdminSupplierDetailScreenProps } from './AdminSupplierDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminSupplierDetail, useAdminSupplierPhoneEditor, useAdminSupplierRemoveHost, type AdminSupplierDetailScreenModel } from './useAdminSupplierDetail';

export function NativeSupplierPhoneField({ model }: { model: AdminSupplierDetailScreenModel }) {
  const detail = model.state.detail!, native = useNativeState(dartTrim(detail.phone)), editor = useAdminSupplierPhoneEditor(model, native), { colors } = useBaseTheme(), phone = dartTrim(detail.phone);
  return <HStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 68 }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
    {editor.editing ? <TextField text={native} autoFocus placeholder={uiText('+998 90 123 45 67', model.locale)}
      modifiers={[keyboardType('phone-pad'), submitLabel('done'), onSubmit(() => { void editor.submit(); }), font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' }),
        accessibilityLabel(model.a('profile.phone')), accessibilityIdentifier('admin-supplier-detail-phone-input')]} /> : <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{phone || model.a('profile.entered')}</Text>}
    <Button onPress={editor.action} modifiers={[buttonStyle('plain'), disabled(model.state.savingPhone), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-supplier-detail-phone-action'),
      accessibilityLabel(model.a(editor.editing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone'))]}>
      {model.state.savingPhone ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName={editor.editing ? 'checkmark' : 'pencil'} size={22} />}
    </Button>
  </HStack>;
}
function Action({ label, action, id, enabled = true }: { label: string; action: () => void; id: string; enabled?: boolean }) {
  return <Button onPress={action} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(!enabled), frame({ maxWidth: Infinity, minHeight: 54 }), accessibilityIdentifier(id)]}>
    <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{label}</Text>
  </Button>;
}
function Controls({ model }: { model: AdminSupplierDetailScreenModel }) {
  const { state } = model, detail = state.detail!, { colors } = useBaseTheme(), hasCode = !!dartTrim(detail.code);
  return <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 16, bottom: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Divider /><Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' })]}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[frame({ height: 14 })]} />
    <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.phone')}</Text><Spacer modifiers={[frame({ height: 6 })]} /><NativeSupplierPhoneField model={model} />
    <Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.access_code')}</Text><Spacer modifiers={[frame({ height: 6 })]} />
    <HStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{hasCode ? detail.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <Button onPress={() => model.copy(detail.code)} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-supplier-detail-copy-code')]}><Image systemName="document.on.document" size={22} /></Button> : null}
      <Button onPress={model.regenerate} modifiers={[buttonStyle('plain'), disabled(state.regenerating), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-supplier-detail-regenerate-code')]}>
        {state.regenerating ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="arrow.clockwise" size={22} />}
      </Button>
    </HStack>
    {hasCode ? <><Spacer modifiers={[frame({ height: 8 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {state.seconds > 0 ? <><Spacer modifiers={[frame({ height: 12 })]} /><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.a('profile.code_wait', { seconds: state.seconds })}</Text></> : null}
    <Spacer modifiers={[frame({ height: 18 })]} /><Text modifiers={[font({ textStyle: 'title3' })]}>{model.a('detail.assigned_items')}</Text><Spacer modifiers={[frame({ height: 10 })]} />
    <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{detail.assigned_items.length ? model.a('detail.assigned_items_count', { count: detail.assigned_items.length }) : model.a('detail.assigned_items_empty')}</Text>
    <Spacer modifiers={[frame({ height: 12 })]} /><HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
      <Action label={model.a('detail.items_view')} action={model.viewItems} id="admin-supplier-detail-items-view" /><Action label={model.a('detail.add')} action={model.addItem} id="admin-supplier-detail-items-add" />
    </HStack><Spacer modifiers={[frame({ height: 8 })]} /><Action label={model.a(state.savingStatus ? 'action.saving' : detail.blocked ? 'detail.unblock' : 'detail.block')}
      action={() => model.toggleBlocked(detail)} enabled={!state.savingStatus} id="admin-supplier-detail-status" />
    <Spacer modifiers={[frame({ height: 8 })]} /><Action label={model.a(state.removing ? 'detail.removing' : 'detail.remove_from_system')} action={model.requestRemove} enabled={!state.removing} id="admin-supplier-detail-remove" />
  </VStack>;
}
function Chip({ label, icon }: { label: string; icon: 'phone.fill' | 'shippingbox.fill' }) {
  const { colors } = useBaseTheme();
  return <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: 8 }), background(colors.surfaceContainerHighest), cornerRadius(999)]}>
    <Image systemName={icon} size={15} modifiers={[foregroundStyle('secondary')]} /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('secondary'), lineLimit(1)]}>{label}</Text>
  </HStack>;
}
function Header({ model, props }: { model: AdminSupplierDetailScreenModel; props: AdminSupplierDetailScreenProps }) {
  const { colors } = useBaseTheme(), detail = model.state.detail!;
  return <RNHostView matchContents={{ vertical: true }}><View style={styles.profileHeader}>
    <View style={styles.banner} /><View style={styles.status}><BaseHost matchContents><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(colors.onSecondaryContainer),
      padding({ horizontal: 12, vertical: 8 }), background(colors.secondaryContainer), cornerRadius(999)]}>{model.a(detail.blocked ? 'detail.blocked' : 'detail.ready')}</Text></BaseHost></View>
    <View style={styles.avatar}>{props.renderAvatar({ avatarUrl: detail.avatar_url, displayName: model.initials, fallbackText: model.initials, size: 92, isCurrent: model.current, canInteract: model.bodyInteractive ?? model.interactive })}</View>
    <View style={styles.identity}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), lineLimit(1)]}>{model.displayName}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{model.a('detail.supplier_profile')}</Text>
    </VStack></BaseHost></View>
  </View></RNHostView>;
}
function Detail({ model, props }: { model: AdminSupplierDetailScreenModel; props: AdminSupplierDetailScreenProps }) {
  const { state } = model, detail = state.detail!, { colors } = useBaseTheme();
  return <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surface), cornerRadius(18), clipped(), animation(Animation.easeOut({ duration: .18 }), state.expanded)]}>
    <Header model={model} props={props} /><HStack alignment="bottom" spacing={8} modifiers={[padding({ leading: 16, trailing: 16, top: 2, bottom: 16 })]}>
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Chip icon="phone.fill" label={dartTrim(detail.phone) || model.a('profile.phone_missing')} /><Chip icon="shippingbox.fill" label={model.a('detail.items_count', { count: detail.assigned_items.length })} />
        {props.chatAction ? <RNHostView matchContents>{props.chatAction}</RNHostView> : null}
      </VStack>
      {!model.readOnly ? <Button onPress={model.toggle} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a(state.expanded ? 'profile.controls_close' : 'profile.controls_open')), accessibilityIdentifier('admin-supplier-detail-admin-toggle')]}>
        <Image systemName="chevron.down" size={20} modifiers={[foregroundStyle('secondary'), rotationEffect(state.expanded ? 180 : 0), animation(Animation.easeOut({ duration: .18 }), state.expanded)]} />
      </Button> : null}
    </HStack>{!model.readOnly && state.expanded ? <Controls key={model.generation} model={model} /> : null}
  </VStack>;
}
/** SwiftUI alert has no outside-tap dismissal; this modal retains V2's dialog behavior with native controls. */
export function SupplierRemoveConfirmation({ model }: { model: AdminSupplierDetailScreenModel }) {
  const host = useAdminSupplierRemoveHost(model), { colors } = useBaseTheme();
  if (!host.visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={() => host.choose(false)}><View style={styles.modal}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => host.choose(false)} />
    <View accessibilityViewIsModal style={[styles.dialogCard, { backgroundColor: colors.surfaceContainerHigh }]}><RNScrollView style={styles.dialogScroll} keyboardShouldPersistTaps="handled">
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[padding({ leading: 24, top: 24, trailing: 24, bottom: 20 }), frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{model.a('detail.supplier_remove_title')}</Text><Spacer modifiers={[frame({ height: 10 })]} />
        <Text modifiers={[foregroundStyle('secondary')]}>{model.a('detail.supplier_remove_message')}</Text><Spacer modifiers={[frame({ height: 22 })]} />
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
          <Button onPress={() => host.choose(false)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-supplier-detail-remove-cancel')]}>
            <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a('action.cancel')}</Text>
          </Button>
          <Button onPress={() => host.choose(true)} role="destructive" modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-supplier-detail-remove-confirm')]}>
            <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a('detail.customer_remove')}</Text>
          </Button>
        </HStack>
      </VStack></BaseHost>
    </RNScrollView></View>
  </View></Modal>;
}
// @v2 AdminSupplierDetailScreen, _AdminSupplierDetailCard and _AdminSupplierPanel.
export function AdminSupplierDetailScreen(props: AdminSupplierDetailScreenProps) {
  const model = useAdminSupplierDetail(props), { state } = model, { colors } = useBaseTheme();
  if (!model.current() || state.phase === 'invalidated' || state.phase === 'removed') return null;
  const body = state.phase === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        state.phase === 'error' ? <ScrollView><VStack spacing={16} modifiers={[padding({ leading: 20, trailing: 20, top: 4, bottom: 24 }), frame({ maxWidth: Infinity })]}>
          <Text modifiers={[foregroundStyle('secondary'), multilineTextAlignment('center')]}>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.reload} modifiers={[accessibilityIdentifier('admin-supplier-detail-retry')]} />
        </VStack></ScrollView> : <ScrollView><VStack modifiers={[padding({ leading: 4, trailing: 4, top: 4, bottom: 116 }), frame({ maxWidth: Infinity })]}><Detail model={model} props={props} /></VStack></ScrollView>;
  return <><Stack.Screen options={{ headerShown: true, title: model.a('profile.title'), headerBackVisible: false, gestureEnabled: false, headerRight: () => props.profileAction,
    headerLeft: () => <BaseHost matchContents><Button label={props.backLabel} systemImage="chevron.left" onPress={model.back} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }),
      accessibilityLabel(props.backLabel), accessibilityIdentifier('admin-supplier-detail-back')]} /></BaseHost> }} />
    <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}><AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-supplier-detail-body-frame">{props.bodySafeAreaBottom === undefined ? <BaseHost style={styles.body}>{body}</BaseHost> :
      <View testID="admin-supplier-detail-inner-safe-area" pointerEvents={props.bodySafeAreaBottom === null ? 'none' : 'auto'} accessibilityElementsHidden={props.bodySafeAreaBottom === null}
        importantForAccessibility={props.bodySafeAreaBottom === null ? 'no-hide-descendants' : 'auto'} accessibilityState={{ busy: props.bodySafeAreaBottom === null }}
        style={[styles.body, { paddingBottom: props.bodySafeAreaBottom ?? undefined, opacity: props.bodySafeAreaBottom === null ? 0 : 1 }]}><BaseHost style={styles.body}>
      {body}
    </BaseHost></View>}</AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>{model.notice ? <PreparationNotice message={model.notice} /> : null}
    {state.removePrompt ? <SupplierRemoveConfirmation key={`${model.generation}:${state.removePrompt.serial}`} model={model} /> : null}</View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  profileHeader: { height: 204, width: '100%' }, banner: { position: 'absolute', left: 0, right: 0, top: 0, height: 112, backgroundColor: '#000000' },
  status: { position: 'absolute', right: 14, top: 14 }, avatar: { position: 'absolute', left: 16, top: 74, width: 92, height: 92 }, identity: { position: 'absolute', left: 124, right: 16, top: 140 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.54)' },
  dialogCard: { width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: 28, overflow: 'hidden' }, dialogScroll: { flexGrow: 0, flexShrink: 1 } });
