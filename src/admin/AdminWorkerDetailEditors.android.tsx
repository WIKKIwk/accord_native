import { CircularProgressIndicator, Column, FlowRow, IconButton, InputChip, OutlinedButton, Row, Spacer } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';
import { WorkerDetailIcon, workerDetailShape } from './AdminWorkerDetailNative.android';

/** @v2 AdminWarehouseAssignmentEditor */
export function WorkerWarehouseEditor({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { colors } = useBaseTheme(), { a, state, warehouse } = model;
  return <Column modifiers={[fillMaxWidth()]}><Text style={{ fontSize: 20, fontWeight: '700' }}>{a('warehouse.assigned_title')}</Text><Spacer modifiers={[height(8)]} />
    <Text style={{ typography: 'bodySmall' }} color={state.warehouses.length ? colors.onSurfaceVariant : colors.error}>{a(state.warehouses.length ? 'detail.warehouse_scope' : 'warehouse.none_assigned')}</Text>
    {state.warehouses.length ? <><Spacer modifiers={[height(10)]} /><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
      {state.warehouses.map(name => <InputChip key={name} enabled={warehouse.state.removing === null} colors={{ containerColor: colors.surfaceContainerHigh, labelColor: colors.onSurface }} border={{ width: 1, color: colors.outlineVariant }} modifiers={[testID(`admin-qolipchi-detail-warehouse-${name}`)]}>
        <InputChip.Avatar><WorkerDetailIcon name="warehouse" color={colors.onSurfaceVariant} iconSize={17} /></InputChip.Avatar><InputChip.Label><Text style={{ typography: 'bodyMedium' }}>{name}</Text></InputChip.Label>
        <InputChip.TrailingIcon>{warehouse.state.removing === name ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(16, 16)]} /> : <IconButton enabled={warehouse.state.removing === null}
          onClick={() => warehouse.removeWarehouse(name)} modifiers={[size(18, 18), semantics({ contentDescription: a('warehouse.unassign_title') })]}><WorkerDetailIcon name="close" color={colors.onSurfaceVariant} iconSize={18} /></IconButton>}</InputChip.TrailingIcon>
      </InputChip>)}
    </FlowRow></> : null}<Spacer modifiers={[height(12)]} />
    <OutlinedButton onClick={warehouse.add} enabled={!warehouse.state.adding} colors={{ contentColor: colors.onSurface }} shape={workerDetailShape(14)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 54 }), testID('admin-qolipchi-detail-add-warehouse')]}>
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{warehouse.state.adding ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <WorkerDetailIcon name="add" color={colors.onSurface} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{a(warehouse.state.adding ? 'action.loading' : 'warehouse.add')}</Text></Row>
    </OutlinedButton>
  </Column>;
}
/** @v2 AdminPreparationResponsibilityEditor */
export function WorkerMaterialResponsibilities({ model }: { model: AdminWorkerDetailScreenModel }) {
  const { colors } = useBaseTheme(), { state, material, u } = model, editable = model.responsibilityEnabled;
  return <Column modifiers={[fillMaxWidth()]}><Text style={{ fontSize: 20, fontWeight: '700' }}>{u('Javobgar homashyolar')}</Text><Spacer modifiers={[height(8)]} />
    {editable ? <Text style={{ typography: 'bodySmall' }} color={state.responsibilities.length ? colors.onSurfaceVariant : colors.error}>{u(state.responsibilities.length ? 'Shu homashyolari bor buyurtmalar masterga ko‘rinadi.' : 'Hech qanday homashyo biriktirilmagan — bu master buyurtmalarni ko‘rmaydi.')}</Text> : null}
    {state.responsibilities.length ? <><Spacer modifiers={[height(editable ? 10 : 0)]} /><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
      {state.responsibilities.map((item, index) => <InputChip key={`${item.material_id}:${index}`} enabled={!editable || material.state.removing === null} colors={{ containerColor: colors.surfaceContainerHigh, labelColor: colors.onSurface }} border={{ width: 1, color: colors.outlineVariant }} modifiers={[testID(`${editable ? 'admin-prep-resp-' : 'admin-prep-resp-read-'}${item.material_id}`)]}>
        <InputChip.Avatar><WorkerDetailIcon name="inventory_2" color={colors.onSurfaceVariant} iconSize={17} /></InputChip.Avatar><InputChip.Label><Text style={{ typography: 'bodyMedium' }}>{item.material_name || item.material_id}</Text></InputChip.Label>
        {editable ? <InputChip.TrailingIcon>{material.state.removing === item.material_id ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(16, 16)]} /> : <IconButton enabled={material.state.removing === null}
          onClick={() => material.removeMaterial(item)} modifiers={[size(18, 18), semantics({ contentDescription: u('Biriktirishni olib tashlash') })]}><WorkerDetailIcon name="close" color={colors.onSurfaceVariant} iconSize={18} /></IconButton>}</InputChip.TrailingIcon> : null}
      </InputChip>)}
    </FlowRow></> : !editable ? <Text>{u('Hech qanday homashyo biriktirilmagan.')}</Text> : null}
    {editable ? <><Spacer modifiers={[height(12)]} /><OutlinedButton onClick={material.add} enabled={!material.state.adding} colors={{ contentColor: colors.onSurface }} shape={workerDetailShape(14)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 54 }), testID('admin-prep-resp-add')]}>
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">{material.state.adding ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : <WorkerDetailIcon name="add" color={colors.onSurface} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{u('Homashyo biriktirish')}</Text></Row>
    </OutlinedButton></> : null}
  </Column>;
}
