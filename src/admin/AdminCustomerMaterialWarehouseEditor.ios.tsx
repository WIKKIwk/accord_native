import { Button, HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerDetailOverlays } from './AdminWorkerDetailOverlays.ios';
import type { AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { useAdminCustomerMaterialWarehouse } from './useAdminCustomerMaterialWarehouse';

// @v2 AdminWarehouseAssignmentEditor
export function AdminCustomerMaterialWarehouseEditor(props: AdminCustomerMaterialWarehouseProps) {
  const model = useAdminCustomerMaterialWarehouse(props), { state, editor, a } = model, { colors } = useBaseTheme(); if (!model.current()) return null;
  return <View><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title3' })]}>{a('warehouse.assigned_title')}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(props.assignedWarehouses.length ? colors.onSurfaceVariant : colors.error), padding({ top: 8 })]}>{props.assignedWarehouses.length ? props.assignedMessage : a('warehouse.none_assigned')}</Text>
    {props.assignedWarehouses.length ? <VStack alignment="leading" spacing={8} modifiers={[padding({ top: 10 })]}>{props.assignedWarehouses.map((name, index) => <HStack key={`${name}:${index}`} spacing={6} modifiers={[padding({ horizontal: 10, vertical: 6 }), background(colors.surfaceContainerHighest), cornerRadius(999), accessibilityIdentifier(`${props.chipKeyPrefix}${name}`)]}>
      <Image systemName="building.2" size={17} /><Text>{name}</Text>{state.removing === name ? <ProgressView modifiers={[frame({ width: 16, height: 16 })]} /> : <Button onPress={() => editor.removeWarehouse(name)} modifiers={[buttonStyle('plain'), disabled(state.removing !== null), frame({ minWidth: 24, minHeight: 24 })]}><Image systemName="xmark" size={18} /></Button>}
    </HStack>)}</VStack> : null}
    <Button onPress={editor.add} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(state.adding), frame({ maxWidth: Infinity, minHeight: 54 }), padding({ top: 12 }), accessibilityIdentifier(props.addButtonKey)]}>
      <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>{state.adding ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="plus" size={24} />}<Text>{a(state.adding ? 'action.loading' : 'warehouse.add')}</Text></HStack>
    </Button>
  </VStack></BaseHost><WorkerDetailOverlays model={model} /></View>;
}
