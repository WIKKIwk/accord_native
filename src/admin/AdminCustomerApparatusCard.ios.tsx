import { BottomSheet, Button, Group, HStack, Image, List, ProgressView, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle,
  listRowBackground, listRowInsets, listRowSeparator, listStyle, padding, presentationDetents, presentationDragIndicator, scrollContentBackground } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminApparatus } from '../apparatusApi';
import type { AdminCustomerApparatusProps } from './AdminCustomerDetailScreenTypes';
import { useAdminCustomerApparatus, type AdminCustomerApparatusModel } from './useAdminCustomerApparatus';

function ScopeRow({ item, selected, model, sheetId }: { item: AdminApparatus; selected: readonly string[]; model: AdminCustomerApparatusModel; sheetId?: number }) {
  return <Toggle label={item.name} isOn={!!item.id && selected.includes(item.id)} onIsOnChange={value => model.toggle(item.id, value, sheetId)}
    modifiers={[disabled(!item.id), frame({ minHeight: 44 }), accessibilityIdentifier(`admin-customer-apparatus-${item.id}`)]} />;
}
function Picker({ model }: { model: AdminCustomerApparatusModel }) {
  return !model.state.apparatus.length ? <Text modifiers={[font({ textStyle: 'caption' })]}>{model.a('scope.empty')}</Text> : <VStack alignment="leading" spacing={6}>
    <Text modifiers={[font({ textStyle: 'headline' })]}>{model.a('scope.allowed')}</Text>{model.state.apparatus.map((item, index) => <ScopeRow key={`${item.id}:${index}`} item={item} selected={model.state.selected} model={model} />)}
  </VStack>;
}
function MaterialSheet({ model }: { model: AdminCustomerApparatusModel }) {
  const sheet = model.state.sheet!;
  return <BottomSheet isPresented={!sheet.closing} onIsPresentedChange={visible => { if (!visible && !sheet.closing) model.nativeDismiss(sheet.id); }} onDismiss={() => model.nativeDismiss(sheet.id)}>
    <Group modifiers={[presentationDetents([{ fraction: .82 }]), presentationDragIndicator('visible')]}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
      <HStack modifiers={[padding({ leading: 16, top: 10, trailing: 8, bottom: 8 })]}><Text modifiers={[font({ textStyle: 'title3', weight: 'heavy' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('scope.material_supplier_title')}</Text>
        <Button label={model.a('action.close')} systemImage="xmark" onPress={() => model.closeSheet(sheet.id)} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(sheet.saving), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-material-apparatus-close')]} />
      </HStack><List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), listRowSeparator('hidden'), listRowBackground('clear')]}>{model.a('scope.material_description')}</Text>
        {sheet.apparatus.length ? <><Text modifiers={[font({ textStyle: 'headline' }), listRowSeparator('hidden'), listRowBackground('clear')]}>{model.a('scope.allowed')}</Text>
          <List.ForEach data={sheet.apparatus} keyExtractor={(item, index) => `${item.id}:${index}`}>{({ item }) => <VStack modifiers={[listRowSeparator('hidden'), listRowBackground('clear'), listRowInsets({ leading: 16, trailing: 16, top: 0, bottom: 0 })]}><ScopeRow item={item} selected={sheet.selected} model={model} sheetId={sheet.id} /></VStack>}</List.ForEach></> : <Text>{model.a('scope.empty')}</Text>}
      </List><Button onPress={() => model.saveSheet(sheet.id)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(sheet.saving), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ leading: 16, top: 8, trailing: 16, bottom: 16 }), accessibilityIdentifier('admin-material-apparatus-save')]}>
        <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a(sheet.saving ? 'action.saving' : 'scope.save_action')}</Text>
      </Button>
    </VStack></Group>
  </BottomSheet>;
}
function MaterialField({ model }: { model: AdminCustomerApparatusModel }) {
  const { state } = model;
  const content = <HStack spacing={16} modifiers={[padding({ horizontal: 16, vertical: 8 }), frame({ minHeight: 72, maxWidth: Infinity })]}>
    <Image systemName="gearshape.2" size={24} /><VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text>{model.a('scope.material_supplier_title')}</Text><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{model.a(state.loading ? 'action.loading' : state.error != null ? 'scope.load_failed' : state.selected.length ? 'scope.selected_count' : 'scope.none_selected', { count: state.selected.length })}</Text>
    </VStack>{state.loading ? <Image systemName="hourglass" size={24} /> : state.error != null ? <Button label={model.a('action.retry')} systemImage="arrow.clockwise" onPress={model.retry} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ width: 44, height: 44 }), accessibilityIdentifier('admin-material-apparatus-retry')]} /> : <Image systemName="chevron.right" size={22} />}
  </HStack>;
  return state.loading || state.error != null ? content : <Button onPress={model.openSheet} modifiers={[buttonStyle('plain'), accessibilityIdentifier('admin-material-apparatus-field')]}>{content}</Button>;
}
// @v2 AdminAparatchiApparatusCard
export function AdminCustomerApparatusCard(props: AdminCustomerApparatusProps) {
  const model = useAdminCustomerApparatus(props), { state } = model, { colors } = useBaseTheme(); if (!model.current() || !state.valid) return null;
  if (!state.loading && state.error == null && !model.visible) return null;
  return <View><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(colors.surfaceContainerLow), cornerRadius(12)]}>
    {model.material ? <MaterialField model={model} /> : <VStack alignment="leading" spacing={0} modifiers={[padding({ all: 20 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      {state.loading ? <VStack modifiers={[frame({ maxWidth: Infinity })]}><ProgressView /></VStack> : state.error != null ? <><Text modifiers={[font({ textStyle: 'headline' })]}>{model.a('scope.load_failed')}</Text>
        <Button label={model.a('action.retry')} onPress={model.retry} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minHeight: 56, maxWidth: Infinity }), padding({ top: 8 }), accessibilityIdentifier('admin-customer-apparatus-retry')]} />
      </> : <><Text modifiers={[font({ textStyle: 'headline' })]}>{model.a('scope.operator_title')}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), padding({ top: 4 })]}>{model.a('scope.operator_description')}</Text>
        <VStack modifiers={[padding({ top: 12, bottom: 12 }), frame({ maxWidth: Infinity })]}><Picker model={model} /></VStack>
        <Button onPress={model.save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(state.saving), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-customer-apparatus-save')]}><Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a(state.saving ? 'action.saving' : 'scope.save_action')}</Text></Button>
      </>}
    </VStack>}
    {state.sheet ? <MaterialSheet key={state.sheet.id} model={model} /> : null}
  </VStack></BaseHost></View>;
}
