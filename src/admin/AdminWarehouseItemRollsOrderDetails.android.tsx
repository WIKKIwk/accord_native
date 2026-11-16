import { Box, Column, OutlinedButton, RNHostView, Row, Shape, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight, width, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import { useAdminWarehouseItemRollsOrder, type AdminWarehouseItemRollsOrderProps } from './useAdminWarehouseItemRollsOrder';

/** @v2 _WarehouseReservationOrderDetails; Root Main supplies this genuine guarded renderer. */
export function AdminWarehouseReservedOrderDetails(props: AdminWarehouseItemRollsOrderProps) {
  const model = useAdminWarehouseItemRollsOrder(props), { colors } = useBaseTheme(); if (!model.current) return null;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
    {model.state.phase === 'idle' || model.state.phase === 'loading' ? <Box contentAlignment="center" modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}><AdminLoadingIndicator size={24} /></Box> : model.state.phase === 'error' ?
      <OutlinedButton onClick={model.retry} colors={{ contentColor: colors.onSurface }} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 } })} modifiers={[fillMaxWidth(), padding(0, 0, 0, 12), height(56), testID('warehouse-reserved-order-retry')]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><RNHostView matchContents><SymbolView name={{ android: 'refresh' }} size={18} tintColor={colors.onSurface} /></RNHostView><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('warehouse.reserved_order_load_failed')}</Text></Row></OutlinedButton> :
      model.lines.map((line, index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[width(72)]}>{line.label}</Text><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{adminWarehouseMainDetailValue(line.value)}</Text>
      </Row>)}
  </Column></BaseHost>;
}
