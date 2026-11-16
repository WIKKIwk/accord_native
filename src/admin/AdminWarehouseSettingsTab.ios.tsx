import { BottomSheet, Button, Form, Group, HStack, Image, List, ProgressView, Section, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle,
  listRowBackground, listRowSeparator, padding, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { adminUserPrincipalRoleFromJson, adminUserRoleLabel } from './adminUsersModel';
import type { AdminWarehouseSettingsProps } from './AdminWarehouseSettingsTypes';
import { adminWarehouseSettingsAssignmentKey, adminWarehouseSettingsRoleLabel } from './adminWarehouseSettingsController';
import { dartTrim } from './dartJsonString';
import { useAdminWarehouseSettings } from './useAdminWarehouseSettings';

type Model = ReturnType<typeof useAdminWarehouseSettings>;
function Picker({ model }: { model: Model }) {
  const picker = model.state.picker!, query = useNativeState(picker.query), { colors } = useBaseTheme();
  return <Group modifiers={[presentationDetents([{ fraction: .66 }]), presentationDragIndicator('visible')]}><VStack alignment="leading" spacing={14} modifiers={[padding({ horizontal: 12, top: 12, bottom: 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
    <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.a('warehouse.assign_to')}</Text><Spacer /><Button label={model.a('action.close')} systemImage="xmark" onPress={() => model.dismissPicker(picker.id)}
      modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.a('action.close'))]} /></HStack>
    <HStack spacing={12} modifiers={[padding({ horizontal: 18 }), frame({ minHeight: 58 }), background(colors.surfaceContainerHighest), cornerRadius(30)]}><Image systemName="magnifyingglass" size={26} />
      <TextField text={query} placeholder={model.a('warehouse.user_search')} onTextChange={value => model.search(picker.id, value)} modifiers={[accessibilityIdentifier('warehouse-settings-assignee-search')]} /></HStack>
    <List>{!model.users.length ? <Text>{model.t('noRecordsYet')}</Text> : model.users.map((user, index) => <Button key={`${user.kind}:${user.id}:${index}`} onPress={() => model.select(picker.id, user)} modifiers={[buttonStyle('plain'), listRowSeparator('hidden')]}>
      <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 8 })]}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{user.name}</Text>
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{adminUserRoleLabel(user)}</Text></VStack>
    </Button>)}</List>
  </VStack></Group>;
}
function Confirmation({ model }: { model: Model }) {
  const dialog = model.state.dialog!, labels = model.dialogText!, { colors } = useBaseTheme();
  const action = <Button onPress={() => model.confirm(dialog.id)} role={dialog.kind === 'delete' ? 'destructive' : undefined}
    modifiers={[buttonStyle('borderedProminent'), controlSize('large'), accessibilityIdentifier('warehouse-settings-confirm')]}><Text modifiers={[frame({ maxWidth: Infinity, minHeight: 40 })]}>{labels.confirm}</Text></Button>;
  const cancel = labels.cancel ? <Button label={labels.cancel} onPress={() => model.dismiss(dialog.id)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 })]} /> : null;
  return <Modal transparent visible animationType="fade" onRequestClose={() => model.dismiss(dialog.id)}><View style={styles.modal}>
    <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={() => model.dismiss(dialog.id)} />
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]}><BaseHost matchContents={{ vertical: true }} style={styles.host}>
      <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 24 })]}>
        {dialog.kind !== 'unassign' ? <Image systemName={dialog.kind === 'blocked' ? 'nosign' : 'trash'} size={28} modifiers={[foregroundStyle(colors.error)]} /> : null}
        <Text modifiers={[font({ textStyle: 'title2' })]}>{labels.title}</Text><Text>{labels.body}</Text>{labels.warning ? <Text>{labels.warning}</Text> : null}
        {labels.vertical ? <VStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>{cancel}{action}</VStack>
          : <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>{cancel}{action}</HStack>}
      </VStack>
    </BaseHost></View>
  </View></Modal>;
}
/** @v2 _WarehouseSettingsTab */
export function AdminWarehouseSettingsTab(props: AdminWarehouseSettingsProps) {
  const model = useAdminWarehouseSettings(props), { state, summary, current, a } = model, { colors } = useBaseTheme();
  if (!current) return null;
  const selected = state.summaries.find(row => row.warehouse === state.warehouse)?.warehouse ?? a('warehouse.unselected');
  return <View style={styles.root}><BaseHost style={styles.body}>
    <BottomSheet isPresented={state.picker !== null} onIsPresentedChange={presented => { if (!presented && state.picker) model.dismissPicker(state.picker.id); }} anchor={<Form>
      <Section><VStack alignment="leading" spacing={8}><Button label={`${a('label.warehouse')}: ${selected}`} systemImage="building.2" onPress={model.toggleFilter}
        modifiers={[buttonStyle('bordered'), accessibilityIdentifier('warehouse-settings-filter')]} />
        {props.filterExpanded ? state.summaries.map(row => <Button key={row.warehouse} label={row.warehouse} onPress={() => model.selectWarehouse(row.warehouse)} modifiers={[buttonStyle(row.warehouse === state.warehouse ? 'borderedProminent' : 'bordered')]} />) : null}
      </VStack></Section>
      {!summary ? <Section><Text>{a('warehouse.no_selection')}</Text></Section> : <>
        <Section header={<Text>{a('warehouse.summary')}</Text>}>{([['warehouse.items', summary.product_count], ['warehouse.reserved_count', summary.reserved_count], ['warehouse.assignments', summary.assignment_count]] as const).map(([key, count]) =>
          <HStack key={key}><Text>{a(key)}</Text><Spacer /><Text modifiers={[font({ weight: 'bold' })]}>{String(count)}</Text></HStack>)}</Section>
        <Section header={<Text>{a('warehouse.assigned_users')}</Text>}>
          {state.assignmentsLoading ? <ProgressView /> : !state.assignments.length ? <Text modifiers={[foregroundStyle('secondary')]}>{a('warehouse.no_assignments')}</Text> : state.assignments.map((row, index) => {
            const key = adminWarehouseSettingsAssignmentKey(row); return <HStack key={`${key}:${index}`} spacing={12}><Image systemName="person" /><VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text>{dartTrim(row.display_name) ? row.display_name : row.principal_ref}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{adminWarehouseSettingsRoleLabel(adminUserPrincipalRoleFromJson(row.principal_role))}</Text>
            </VStack>{state.removingKey === key ? <ProgressView /> : <Button label={a('warehouse.unassign')} systemImage="person.badge.minus" onPress={() => model.unassign(row)} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(state.removingKey !== null),
              accessibilityLabel(a('warehouse.unassign')), accessibilityIdentifier(`warehouse-settings-unassign-${key}`), frame({ minWidth: 44, minHeight: 44 })]} />}</HStack>; })}
          <Button label={a('warehouse.assign_user')} systemImage="person.badge.plus" onPress={model.assign} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(state.assigning), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('warehouse-settings-assign')]} />
        </Section>
        <Section header={<Text modifiers={[foregroundStyle(colors.error)]}>{a('warehouse.dangerous_action')}</Text>}><Text>{a('warehouse.delete_cascade_warning')}</Text>
          <Button label={a('warehouse.delete_title')} role="destructive" systemImage="trash" onPress={model.deleteWarehouse} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(state.deleting), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('warehouse-settings-delete')]} />
        </Section>
      </>}<Spacer modifiers={[frame({ height: props.bottomPadding }), listRowBackground('transparent'), listRowSeparator('hidden')]} />
    </Form>}>{state.picker ? <Picker key={state.picker.id} model={model} /> : null}</BottomSheet>
  </BaseHost>{state.dialog ? <Confirmation key={state.dialog.id} model={model} /> : null}{model.notice ? <PreparationNotice message={model.notice} /> : null}</View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, host: { width: '100%' }, modal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,.32)' },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, overflow: 'hidden' } });
