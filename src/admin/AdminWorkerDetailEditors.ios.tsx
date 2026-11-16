import { Button, HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';

/** @v2 AdminWarehouseAssignmentEditor */
export function WorkerWarehouseEditor({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { colors } = useBaseTheme(), { state, warehouse, a } = model;
  return <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title2' })]}>{a('warehouse.assigned_title')}</Text>
    <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(state.warehouses.length ? colors.onSurfaceVariant : colors.error), padding({ top: 8 })]}>{a(state.warehouses.length ? 'detail.warehouse_scope' : 'warehouse.none_assigned')}</Text>
    {state.warehouses.length ? <VStack alignment="leading" spacing={8} modifiers={[padding({ top: 10 })]}>{state.warehouses.map(name => <HStack key={name} spacing={6}
      modifiers={[padding({ horizontal: 10, vertical: 6 }), background(colors.surfaceContainerHighest), cornerRadius(999), accessibilityIdentifier(`admin-qolipchi-detail-warehouse-${name}`)]}>
      <Image systemName="building.2" size={17} /><Text>{name}</Text>{warehouse.state.removing === name ? <ProgressView modifiers={[frame({ width: 16, height: 16 })]} /> : <Button label={a('warehouse.unassign_title')} systemImage="xmark" onPress={() => warehouse.removeWarehouse(name)}
        modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(warehouse.state.removing !== null), accessibilityLabel(a('warehouse.unassign_title')), frame({ minWidth: 24, minHeight: 24 })]} />}
    </HStack>)}</VStack> : null}
    <Button onPress={warehouse.add} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(warehouse.state.adding), frame({ maxWidth: Infinity, minHeight: 54 }), padding({ top: 12 }), accessibilityIdentifier('admin-qolipchi-detail-add-warehouse')]}>
      <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>{warehouse.state.adding ? <ProgressView /> : <Image systemName="plus" />}<Text>{a(warehouse.state.adding ? 'action.loading' : 'warehouse.add')}</Text></HStack>
    </Button>
  </VStack>;
}
/** @v2 AdminPreparationResponsibilityEditor */
export function WorkerMaterialResponsibilities({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { colors } = useBaseTheme(), { state, material, u } = model, editable = model.responsibilityEnabled;
  return <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title2' })]}>{u('Javobgar homashyolar')}</Text>
    {editable ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(state.responsibilities.length ? colors.onSurfaceVariant : colors.error), padding({ top: 8 })]}>{u(state.responsibilities.length ? 'Shu homashyolari bor buyurtmalar masterga ko‘rinadi.' : 'Hech qanday homashyo biriktirilmagan — bu master buyurtmalarni ko‘rmaydi.')}</Text> : null}
    {state.responsibilities.length ? <VStack alignment="leading" spacing={8} modifiers={[padding({ top: editable ? 10 : 8 })]}>{state.responsibilities.map((item, index) => <HStack key={`${item.material_id}:${index}`} spacing={6}
      modifiers={[padding({ horizontal: 10, vertical: 6 }), background(colors.surfaceContainerHighest), cornerRadius(999), accessibilityIdentifier(`${editable ? 'admin-prep-resp-' : 'admin-prep-resp-read-'}${item.material_id}`)]}>
      <Image systemName="shippingbox" size={17} /><Text>{item.material_name || item.material_id}</Text>
      {editable ? material.state.removing === item.material_id ? <ProgressView modifiers={[frame({ width: 16, height: 16 })]} /> : <Button label={u('Biriktirishni olib tashlash')} systemImage="xmark" onPress={() => material.removeMaterial(item)}
        modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), disabled(material.state.removing !== null), accessibilityLabel(u('Biriktirishni olib tashlash')), frame({ minWidth: 24, minHeight: 24 })]} /> : null}
    </HStack>)}</VStack> : !editable ? <Text modifiers={[padding({ top: 8 })]}>{u('Hech qanday homashyo biriktirilmagan.')}</Text> : null}
    {editable ? <Button onPress={material.add} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(material.state.adding), frame({ maxWidth: Infinity, minHeight: 54 }), padding({ top: 12 }), accessibilityIdentifier('admin-prep-resp-add')]}>
      <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>{material.state.adding ? <ProgressView /> : <Image systemName="plus" />}<Text>{u('Homashyo biriktirish')}</Text></HStack>
    </Button> : null}
  </VStack>;
}
