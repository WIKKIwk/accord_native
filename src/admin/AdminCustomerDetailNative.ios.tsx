import { Button, Divider, HStack, Image, ProgressView, RNHostView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, lineLimit, onSubmit, padding, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { uiText } from '../shared/localization';
import type { AdminCustomerDetailScreenProps, AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { dartTrim } from './dartJsonString';
import { useAdminCustomerControls, useAdminCustomerPhoneEditor, useAdminCustomerPromptHost, useAdminCustomerWarehouseProps, type AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

export function CustomerPhoneField({ model }: { model: AdminCustomerDetailScreenModel }) {
  const { detail } = model, native = useNativeState(dartTrim(detail.phone)), editor = useAdminCustomerPhoneEditor({ detail, current: model.current,
    interactive: model.controlsCurrent, savingPhone: model.state.savingPhone, savePhone: model.savePhone }, native), { colors } = useBaseTheme(), phone = dartTrim(detail.phone);
  return <HStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 68 }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
    {editor.editing ? <TextField text={native} autoFocus placeholder={uiText('+998 90 123 45 67', model.locale)} modifiers={[keyboardType('phone-pad'), submitLabel('done'), onSubmit(() => { void editor.submit(); }),
      font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityLabel(model.a('profile.phone')), accessibilityIdentifier('admin-customer-detail-phone-input')]} /> :
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{phone || model.a('profile.entered')}</Text>}
    <Button onPress={editor.action} modifiers={[buttonStyle('plain'), disabled(model.state.savingPhone), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-customer-detail-phone-action'),
      accessibilityLabel(model.a(editor.editing ? 'profile.save_phone' : phone ? 'profile.update_phone' : 'profile.enter_phone'))]}>
      {model.state.savingPhone ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName={editor.editing ? 'checkmark' : 'pencil'} size={22} />}
    </Button>
  </HStack>;
}
export function CustomerAction({ label, action, id, enabled = true }: { label: string; action: () => void; id: string; enabled?: boolean }) {
  return <Button onPress={action} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(!enabled), frame({ maxWidth: Infinity, minHeight: 54 }), accessibilityIdentifier(id)]}>
    <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{label}</Text>
  </Button>;
}
export function CustomerControls({ model, props }: { model: AdminCustomerDetailScreenModel; props: AdminCustomerDetailScreenProps }) {
  const { state, detail, mode } = model, controls = useAdminCustomerControls(model), { colors } = useBaseTheme(), hasCode = !!dartTrim(detail.code), warehouse = model.materialWarehouse;
  return <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 16, bottom: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Divider /><Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' })]}>{model.a('profile.admin_controls')}</Text><Spacer modifiers={[frame({ height: 14 })]} />
    <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.phone')}</Text><Spacer modifiers={[frame({ height: 6 })]} /><CustomerPhoneField model={model} />
    <Spacer modifiers={[frame({ height: 14 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.access_code')}</Text><Spacer modifiers={[frame({ height: 6 })]} />
    <HStack spacing={0} modifiers={[padding({ horizontal: 14, vertical: 12 }), frame({ maxWidth: Infinity }), background(colors.surfaceContainerHighest), cornerRadius(14)]}>
      <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{hasCode ? detail.code : model.a('profile.code_not_shown')}</Text>
      {hasCode ? <Button onPress={controls.copy} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-customer-detail-copy-code')]}><Image systemName="document.on.document" size={22} /></Button> : null}
      <Button onPress={controls.regenerate} modifiers={[buttonStyle('plain'), disabled(state.regenerating), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-customer-detail-code-regenerate')]}>
        {state.regenerating ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="arrow.clockwise" size={22} />}
      </Button>
    </HStack>
    {hasCode ? <><Spacer modifiers={[frame({ height: 8 })]} /><Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('profile.code_copy_hint')}</Text></> : null}
    {detail.code_retry_after_sec > 0 ? <><Spacer modifiers={[frame({ height: 12 })]} /><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.a('profile.code_wait', { seconds: detail.code_retry_after_sec })}</Text></> : null}
    {mode.material ? <>
      <Spacer modifiers={[frame({ height: 18 })]} /><Text modifiers={[font({ textStyle: 'title3' })]}>{model.a('item.group')}</Text><Spacer modifiers={[frame({ height: 8 })]} />
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(detail.assigned_item_groups.length ? colors.onSurfaceVariant : colors.error)]}>{model.a(detail.assigned_item_groups.length ? 'detail.groups_scope' : 'detail.groups_unassigned')}</Text>
      {detail.assigned_item_groups.length ? <><Spacer modifiers={[frame({ height: 10 })]} /><VStack alignment="leading" spacing={8}>
        {detail.assigned_item_groups.map((group, index) => <HStack key={`${group}:${index}`} spacing={8} modifiers={[padding({ horizontal: 10, vertical: 8 }), background(colors.surfaceContainerHigh), cornerRadius(14)]}><Image systemName="square.grid.2x2" size={17} /><Text>{group}</Text></HStack>)}
      </VStack></> : null}<Spacer modifiers={[frame({ height: 12 })]} />
      <Button onPress={controls.editGroups} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(state.editingGroups), frame({ maxWidth: Infinity, minHeight: 54 }), accessibilityIdentifier('admin-material-detail-edit-item-groups')]}>
        <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{state.editingGroups ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="pencil" size={22} />}<Text>{model.a(state.editingGroups ? 'detail.loading' : 'detail.edit_groups')}</Text></HStack>
      </Button><Spacer modifiers={[frame({ height: 18 })]} />
      {warehouse ? <RNHostView matchContents={{ vertical: true }}><View style={styles.fullWidth}><CustomerWarehouseEditor key={`${warehouse.principalRole}:${warehouse.principalRef}`} warehouse={warehouse} props={props} controls={controls} /></View></RNHostView> : null}
    </> : null}
    {mode.items ? <><Spacer modifiers={[frame({ height: 18 })]} /><Text modifiers={[font({ textStyle: 'title3' })]}>{model.a('detail.assigned_items')}</Text><Spacer modifiers={[frame({ height: 10 })]} />
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{detail.assigned_items.length ? model.a('detail.assigned_items_count', { count: detail.assigned_items.length }) : model.a('detail.assigned_items_empty')}</Text>
      <Spacer modifiers={[frame({ height: 12 })]} /><HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
        <CustomerAction label={model.a('detail.items_view')} action={controls.openAssigned} enabled={!!detail.assigned_items.length} id="admin-customer-detail-items-view" />
        <CustomerAction label={model.a(state.addingItem ? 'detail.items_adding' : 'detail.add')} action={controls.openAvailable} enabled={!state.addingItem} id="admin-customer-detail-items-add" />
      </HStack></> : null}
    {mode.remove ? <><Spacer modifiers={[frame({ height: 8 })]} /><CustomerAction label={model.a(state.removing ? 'detail.removing' : 'detail.remove_from_system')} action={controls.requestRemove} enabled={!state.removing} id="admin-customer-detail-remove" /></> : null}
  </VStack>;
}
export function CustomerWarehouseEditor({ warehouse, props, controls }: { warehouse: AdminCustomerMaterialWarehouseProps; props: AdminCustomerDetailScreenProps; controls: ReturnType<typeof useAdminCustomerControls> }) {
  return props.renderMaterialWarehouseEditor(useAdminCustomerWarehouseProps(warehouse, controls.lifetimeCurrent, controls.current));
}
export function CustomerInfoChip({ label, icon }: { label: string; icon: 'phone.fill' | 'square.grid.2x2' | 'building.2' | 'bag.fill' }) {
  const { colors } = useBaseTheme();
  return <HStack spacing={6} modifiers={[padding({ horizontal: 10, vertical: 8 }), background(colors.surfaceContainerHighest), cornerRadius(999)]}>
    <Image systemName={icon} size={15} modifiers={[foregroundStyle('secondary')]} /><Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('secondary'), lineLimit(1)]}>{label}</Text>
  </HStack>;
}
/** A native control body in a modal retains the source outside/back dismissal that SwiftUI Alert omits. */
export function CustomerPrompt({ model }: { model: AdminCustomerDetailScreenModel }) {
  const host = useAdminCustomerPromptHost(model), labels = model.promptText!, { colors } = useBaseTheme(); if (!host.visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={() => host.choose(false)}><View style={styles.modal}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => host.choose(false)} />
    <View accessibilityViewIsModal style={[styles.dialogCard, { backgroundColor: colors.surfaceContainerHigh }]}><ScrollView style={styles.dialogScroll}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
      <VStack alignment="leading" spacing={0} modifiers={[padding({ leading: 24, top: 24, trailing: 24, bottom: 20 }), frame({ maxWidth: Infinity })]}>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{labels.title}</Text><Spacer modifiers={[frame({ height: 10 })]} /><Text modifiers={[foregroundStyle('secondary')]}>{labels.body}</Text><Spacer modifiers={[frame({ height: 22 })]} />
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
          <Button onPress={() => host.choose(false)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-customer-detail-remove-cancel')]}><Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{labels.cancel}</Text></Button>
          <Button onPress={() => host.choose(true)} role={labels.destructive ? 'destructive' : undefined} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-customer-detail-remove-confirm')]}><Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{labels.confirm}</Text></Button>
        </HStack>
      </VStack>
    </BaseHost></ScrollView></View>
  </View></Modal>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, modal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.54)' },
  dialogCard: { width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: 28, overflow: 'hidden' }, dialogScroll: { flexGrow: 0, flexShrink: 1 } });
