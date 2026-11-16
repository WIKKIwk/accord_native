import { CircularProgressIndicator, Column, FlowRow, IconButton, InputChip, OutlinedButton, Row, Spacer } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { WorkerDetailOverlays } from './AdminWorkerDetailOverlays.android';
import { CustomerIcon, roundedCustomer } from './AdminCustomerDetailNative.android';
import type { AdminCustomerMaterialWarehouseProps } from './AdminCustomerDetailScreenTypes';
import { useAdminCustomerMaterialWarehouse } from './useAdminCustomerMaterialWarehouse';

// @v2 AdminWarehouseAssignmentEditor
export function AdminCustomerMaterialWarehouseEditor(props: AdminCustomerMaterialWarehouseProps) {
  const model = useAdminCustomerMaterialWarehouse(props), { state, editor, a } = model, { colors } = useBaseTheme(); if (!model.current()) return null;
  return <View><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
    <Text style={{ fontSize: 20, fontWeight: '700' }}>{a('warehouse.assigned_title')}</Text><Spacer modifiers={[height(8)]} />
    <Text style={{ typography: 'bodySmall' }} color={props.assignedWarehouses.length ? colors.onSurfaceVariant : colors.error}>{props.assignedWarehouses.length ? props.assignedMessage : a('warehouse.none_assigned')}</Text>
    {props.assignedWarehouses.length ? <><Spacer modifiers={[height(10)]} /><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
      {props.assignedWarehouses.map((name, index) => <InputChip key={`${name}:${index}`} enabled={state.removing === null} colors={{ containerColor: colors.surfaceContainerHigh, labelColor: colors.onSurface }} border={{ width: 1, color: colors.outlineVariant }} modifiers={[testID(`${props.chipKeyPrefix}${name}`)]}>
        <InputChip.Avatar><CustomerIcon name="warehouse" color={colors.onSurfaceVariant} iconSize={17} /></InputChip.Avatar><InputChip.Label><Text style={{ typography: 'bodyMedium' }}>{name}</Text></InputChip.Label>
        <InputChip.TrailingIcon>{state.removing === name ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(16, 16)]} /> : <IconButton enabled={state.removing === null} onClick={() => editor.removeWarehouse(name)} modifiers={[size(18, 18)]}><CustomerIcon name="close" color={colors.onSurfaceVariant} iconSize={18} /></IconButton>}</InputChip.TrailingIcon>
      </InputChip>)}
    </FlowRow></> : null}<Spacer modifiers={[height(12)]} />
    <OutlinedButton onClick={editor.add} enabled={!state.adding} colors={{ contentColor: colors.onSurface }} shape={roundedCustomer(props.buttonRadius)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 54 }), testID(props.addButtonKey)]}>
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{state.adding ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <CustomerIcon name="add" color={colors.onSurface} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{a(state.adding ? 'action.loading' : 'warehouse.add')}</Text></Row>
    </OutlinedButton>
  </Column></BaseHost><WorkerDetailOverlays model={model} /></View>;
}
