import { Button, HStack, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import { useAdminWarehouseItemRollsOrder, type AdminWarehouseItemRollsOrderProps } from './useAdminWarehouseItemRollsOrder';

/** @v2 _WarehouseReservationOrderDetails */
export function AdminWarehouseReservedOrderDetails(props: AdminWarehouseItemRollsOrderProps) {
  const model = useAdminWarehouseItemRollsOrder(props); if (!model.current) return null;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    {model.state.phase === 'idle' || model.state.phase === 'loading' ? <ProgressView modifiers={[frame({ maxWidth: Infinity }), padding({ bottom: 12 })]} /> : model.state.phase === 'error' ?
      <Button label={model.a('warehouse.reserved_order_load_failed')} systemImage="arrow.clockwise" onPress={model.retry} modifiers={[buttonStyle('bordered'), padding({ bottom: 12 }), accessibilityIdentifier('warehouse-reserved-order-retry')]} /> :
      model.lines.map((line, index) => <HStack key={index} alignment="top" spacing={0} modifiers={[padding({ bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), frame({ width: 72, alignment: 'leading' })]}>{line.label}</Text><Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{adminWarehouseMainDetailValue(line.value)}</Text>
      </HStack>)}
  </VStack></BaseHost>;
}
