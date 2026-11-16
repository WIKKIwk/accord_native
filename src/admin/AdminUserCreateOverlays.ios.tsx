import { BottomSheet, Button, Group, HStack, Image, RNHostView, Spacer, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, padding, presentationDragIndicator, textFieldStyle, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminUserCreateChoiceEnabled } from './adminUserCreateModel';
import type { AdminUserCreateScreenModel } from './useAdminUserCreate';

/** Source Copy does not dismiss; a UIKit modal hosts native controls rather than auto-dismissing UIAlert actions. */
function IssuedCode({ model }: { model: AdminUserCreateScreenModel }) {
  const value = model.state.issuedCode, { colors } = useBaseTheme(); if (!value) return null;
  return <Modal transparent visible={!value.closing} animationType="fade" presentationStyle="overFullScreen" onRequestClose={() => model.dismissCode(value.id)} onDismiss={() => model.completeCode(value.id)}>
    <View style={styles.dialogBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => model.dismissCode(value.id)} accessibilityRole="button" accessibilityLabel={model.a('action.close')} />
      <BaseHost matchContents={{ vertical: true }} style={styles.dialog}><VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 24, vertical: 20 }), background(colors.surfaceContainerHigh), cornerRadius(28)]}>
        <Text modifiers={[font({ textStyle: 'title2' }), padding({ bottom: 16 })]}>{model.a('user.code')}</Text><Text modifiers={[font({ textStyle: 'body' }), textSelection(true)]}>{value.value}</Text><Spacer modifiers={[frame({ height: 12 })]} /><Text>{model.a('profile.code_copy_hint')}</Text><Spacer modifiers={[frame({ height: 20 })]} />
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' })]}><Spacer /><Button label={model.copyLabel} onPress={() => model.copyIssued(value.id)} modifiers={[buttonStyle('plain'), frame({ minHeight: 44 }), accessibilityIdentifier('admin-user-create-issued-copy')]} />
          <Button label={model.a('action.close')} onPress={() => model.dismissCode(value.id)} modifiers={[buttonStyle('plain'), frame({ minHeight: 44 }), accessibilityIdentifier('admin-user-create-issued-close')]} /></HStack>
      </VStack></BaseHost>
    </View>
  </Modal>;
}
function RolePicker({ model }: { model: AdminUserCreateScreenModel }) {
  const picker = model.state.picker!, query = useNativeState(picker.query), { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  return <BottomSheet isPresented={!picker.closing} fitToContents onIsPresentedChange={visible => { if (!visible) model.dismissPicker(picker.id); }} onDismiss={() => model.completePicker(picker.id)}>
    <Group modifiers={[presentationDragIndicator('visible')]}><RNHostView matchContents={{ vertical: true }}><View style={{ maxHeight: screenHeight * .66, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <HStack><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('user.role_select')}</Text><Button onPress={() => model.dismissPicker(picker.id)} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.close')), accessibilityIdentifier('admin-user-create-picker-close')]}><Image systemName="xmark" size={20} /></Button></HStack>
        <Spacer modifiers={[frame({ height: 14 })]} /><TextField text={query} placeholder={model.a('user.role_search')} onTextChange={value => model.pickerSearch(picker.id, value)} modifiers={[textFieldStyle('roundedBorder'), accessibilityIdentifier('admin-user-create-role-search')]} /><Spacer modifiers={[frame({ height: 14 })]} />
      </VStack></BaseHost>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        {model.pickerRows.length ? model.pickerRows.map(row => {
          const enabled = adminUserCreateChoiceEnabled(row.choice);
          return <Button key={row.index} onPress={enabled ? () => model.chooseRole(picker.id, row.choice) : undefined} modifiers={[buttonStyle('plain'), disabled(!enabled), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier(`admin-user-create-role-option-${row.index}`)]}>
            <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 18, vertical: 16 }), background(colors.surfaceContainerHighest), cornerRadius(16)]}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{row.title}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.subtitle}</Text></VStack>
          </Button>;
        }) : <Text modifiers={[foregroundStyle('secondary'), padding({ vertical: 24 }), frame({ maxWidth: Infinity })]}>{model.t('noRecordsYet')}</Text>}
      </VStack></BaseHost></ScrollView>
    </View></RNHostView></Group>
  </BottomSheet>;
}
function GroupBody({ model }: { model: AdminUserCreateScreenModel }) {
  const picker = model.state.picker!, { colors } = useBaseTheme();
  return <><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <HStack><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('user.select_item_groups')}</Text><Button onPress={() => model.dismissPicker(picker.id)} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.close')), accessibilityIdentifier('admin-user-create-picker-close')]}><Image systemName="xmark" size={20} /></Button></HStack><Spacer modifiers={[frame({ height: 8 })]} />
  </VStack></BaseHost><ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    {model.state.groups.map(group => <Toggle key={group} label={group} isOn={picker.selected.includes(group)} onIsOnChange={value => model.toggleGroup(picker.id, group, value)} modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ maxWidth: Infinity, minHeight: 56 }), background(colors.surfaceContainerHighest), cornerRadius(16), accessibilityIdentifier(`admin-user-create-group-${group}`)]} />)}
  </VStack></BaseHost></ScrollView><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack modifiers={[padding({ top: 12 }), frame({ maxWidth: Infinity })]}><Button label={model.a('action.select')} onPress={() => model.confirmGroups(picker.id)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!picker.selected.length), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-user-create-groups-confirm')]} /></VStack></BaseHost></>;
}
function GroupDialog({ model }: { model: AdminUserCreateScreenModel }) {
  const picker = model.state.picker!, { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  return <Modal transparent visible={!picker.closing} animationType="fade" presentationStyle="overFullScreen" allowSwipeDismissal={false} onRequestClose={() => model.dismissPicker(picker.id)} onDismiss={() => model.completePicker(picker.id)}>
    <View style={styles.groupBackdrop}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={model.a('action.close')} onPress={() => model.dismissPicker(picker.id)} />
      <View style={[styles.groupPanel, { backgroundColor: colors.surface }]}><SafeAreaView edges={['left', 'right']}><View style={{ maxHeight: screenHeight * .66, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 }}><GroupBody model={model} /></View></SafeAreaView></View>
    </View>
  </Modal>;
}
export function AdminUserCreateOverlays({ model }: { model: AdminUserCreateScreenModel }) {
  if (!model.current()) return null;
  return <>{model.state.picker ? model.state.picker.kind === 'groups' ? <GroupDialog key={model.state.picker.id} model={model} /> : <BaseHost style={styles.host}><RolePicker key={model.state.picker.id} model={model} /></BaseHost> : null}
    {model.state.issuedCode ? <IssuedCode key={model.state.issuedCode.id} model={model} /> : null}</>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, host: { position: 'absolute', width: '100%' }, dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, dialog: { width: '100%', maxWidth: 360 }, groupBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)', justifyContent: 'flex-end' }, groupPanel: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' } });
