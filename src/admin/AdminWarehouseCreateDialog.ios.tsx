import { BottomSheet, Button, Group, HStack, Image, List, ProgressView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle, listRowSeparator, onSubmit,
  padding, presentationDetents, presentationDragIndicator, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { adminUserRoleLabel } from './adminUsersModel';
import type { AdminWarehouseCreateProps } from './AdminWarehouseCreateTypes';
import { useAdminWarehouseCreate } from './useAdminWarehouseCreate';

function NameField({ label, value, change, save }: { label: string; value: string; change: (text: string) => void; save: () => void }) {
  const text = useNativeState(value);
  return <VStack alignment="leading" spacing={6}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{label}</Text>
    <TextField text={text} placeholder={label} onTextChange={change} modifiers={[textFieldStyle('roundedBorder'), submitLabel('done'), onSubmit(save), accessibilityIdentifier('admin-warehouse-create-name')]} />
  </VStack>;
}
function AssigneePicker({ model }: { model: ReturnType<typeof useAdminWarehouseCreate> }) {
  const { state, controller, a, t, users } = model, picker = state.picker!, query = useNativeState(picker.query), { colors } = useBaseTheme();
  return <Group modifiers={[presentationDetents([{ fraction: .66 }]), presentationDragIndicator('visible')]}>
    <VStack alignment="leading" spacing={14} modifiers={[padding({ horizontal: 12, top: 12, bottom: 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
      <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{a('warehouse.assign_to')}</Text><Spacer />
        <Button label={a('action.close')} systemImage="xmark" onPress={() => controller.dismissPicker(picker.id)} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(a('action.close'))]} />
      </HStack>
      <HStack spacing={12} modifiers={[padding({ horizontal: 18 }), frame({ minHeight: 58 }), background(colors.surfaceContainerHighest), cornerRadius(30)]}>
        <Image systemName="magnifyingglass" size={26} /><TextField text={query} placeholder={a('warehouse.user_search')} onTextChange={text => controller.searchPicker(picker.id, text)} modifiers={[accessibilityIdentifier('admin-warehouse-assignee-search')]} />
      </HStack>
      <List>{!users.length ? <Text>{t('noRecordsYet')}</Text> : users.map((user, index) => <Button key={`${user.kind}:${user.id}:${index}`} onPress={() => controller.selectUser(picker.id, user)}
        modifiers={[buttonStyle('plain'), listRowSeparator('hidden')]}>
        <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 6, vertical: 8 })]}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{user.name}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{adminUserRoleLabel(user)}</Text>
        </VStack>
      </Button>)}</List>
    </VStack>
  </Group>;
}

/** @v2 _WarehouseCreateCard
 * Native SwiftUI fields, controls and picker adapt the same dialog and steps to iOS. */
export function AdminWarehouseCreateDialog(props: AdminWarehouseCreateProps) {
  const model = useAdminWarehouseCreate(props), { controller, state, a } = model, { colors } = useBaseTheme();
  if (!model.current) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={() => controller.dismissDialog()}>
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={() => controller.dismissDialog()} />
      <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}><BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 })]}>
          <HStack><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{a('warehouse.create')}</Text><Spacer />
            <Button label={a('action.close')} systemImage="xmark" onPress={() => controller.closeButton()}
              modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(state.saving), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(a('action.close'))]} />
          </HStack>
          <NameField key={state.fillVersion} label={a('warehouse.name')} value={state.name} change={value => controller.changeName(value)} save={model.save} />
          <BottomSheet isPresented={state.picker !== null} onIsPresentedChange={presented => { if (!presented && state.picker) controller.dismissPicker(state.picker.id); }}
            anchor={<Button onPress={() => { void controller.openPicker(); }} modifiers={[buttonStyle('plain'), accessibilityIdentifier('admin-warehouse-create-assignee')]}>
              <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 12 }), background(colors.surface), cornerRadius(12)]}>
                <Image systemName="person.crop.badge.magnifyingglass" /><VStack alignment="leading" spacing={4}>
                  <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{a('warehouse.assign_to')}</Text>
                  <Text modifiers={[font({ weight: state.selected ? 'bold' : 'regular' })]}>{state.selected?.name ?? a(state.loadingUsers ? 'action.loading' : 'warehouse.pick_user')}</Text>
                  {state.selected ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{adminUserRoleLabel(state.selected)}</Text> : null}
                </VStack><Spacer />{state.loadingUsers ? <ProgressView /> : <Image systemName="chevron.down" size={16} />}
              </HStack>
            </Button>}>
            {state.picker ? <AssigneePicker key={state.picker.id} model={model} /> : null}
          </BottomSheet>
          <Button onPress={model.save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(state.saving), accessibilityIdentifier('admin-warehouse-create-save')]}>
            <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 40 })]}>{state.saving ? <ProgressView /> : <Image systemName="link" size={18} />}<Text>{a('warehouse.assign')}</Text></HStack>
          </Button>
        </VStack>
      </BaseHost></View>
      {state.notice ? <PreparationNotice message={a(state.notice.key)} /> : null}
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.32)' },
  card: { width: '100%', maxWidth: 440, borderRadius: 18, overflow: 'hidden', boxShadow: '0px 6px 12px rgba(0,0,0,.18)' }, host: { width: '100%' } });
