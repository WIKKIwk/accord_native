import { Column, HorizontalDivider, LinearProgressIndicator, OutlinedButton, Row, Spacer, Surface, TextButton, Button } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { AdminItemDetailHeader } from './AdminItemDetailHeader.android';
import { ItemDetailIcon, ItemDetailRow, ItemDetailSection, ItemDetailSpinner, itemDetailDisabled, itemDetailRounded } from './AdminItemDetailNative.android';
import type { AdminItemDetailReadModel } from './AdminItemDetailReadOwner';
import { useAdminItemDetailComboProductName, useAdminItemDetailComboRead, type AdminItemDetailComboReadModel } from './AdminItemDetailComboRead';
import { adminItemDetailComboImageUrl, adminItemDetailComboSize, type AdminItemDetailComboProduct } from './adminItemDetailComboPresentation';
import { adminItemDetailFinishedImageUrl } from './adminItemDetailImagePresentation';

function Customers({ model }: { model: AdminItemDetailReadModel }) {
  const { colors } = useBaseTheme(), value = model.presentation!;
  if (!value.customers.length) return <ItemDetailRow row={{ label: value.customerLabel, value: value.unassigned }} />;
  return <Row verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 10, 0, 10)]}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(4)]}>{value.customerLabel}</Text><Spacer modifiers={[size(14, 1)]} />
    <Column horizontalAlignment="end" modifiers={[weight(6)]}>{value.customers.map((customer, index) => <Column key={index} horizontalAlignment="end" modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
      <Text style={{ typography: 'bodyLarge', fontWeight: '600', textAlign: 'end' }}>{customer.name}</Text>{customer.subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', textAlign: 'end' }}>{customer.subtitle}</Text> : null}
    </Column>)}</Column>
  </Row>;
}
function Product({ combo, product, index, model }: { combo: AdminItemDetailComboReadModel; product: AdminItemDetailComboProduct; index: number; model: AdminItemDetailReadModel }) {
  const { colors } = useBaseTheme(), name = useAdminItemDetailComboProductName(combo, product);
  if (!name || name.phase === 'invalidated') return null;
  return <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 10, 0, 10), testID(`admin-combo-component-${index}`)]}>
    <Surface color={colors.secondaryContainer} shape={itemDetailRounded(11)} modifiers={[size(34, 34)]}><Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(34, 34)]}><Text color={colors.onSecondaryContainer} style={{ typography: 'labelLarge', fontWeight: '700' }}>{String(index + 1)}</Text></Row></Surface>
    <Spacer modifiers={[size(12, 1)]} /><Column modifiers={[weight(1)]}><Text style={{ typography: 'bodyLarge', fontWeight: '600' }}>{name.name ?? (name.phase === 'loading' ? model.t('loading') : model.a('calculate.combo_product_unnamed'))}</Text><Spacer modifiers={[height(3)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{adminItemDetailComboSize(product)}</Text></Column>
  </Row>;
}
function Information({ model, combo = false }: { model: AdminItemDetailReadModel; combo?: boolean }) {
  const value = model.presentation!;
  return <ItemDetailSection title={model.a('detail.main_info')}>
    {!combo && value.finishedGroup ? <ItemDetailRow row={value.finishedGroup} /> : null}<ItemDetailRow row={value.uom} /><HorizontalDivider thickness={1} />
    {value.dates.map((row, index) => <ItemDetailRow key={index} row={row} />)}<HorizontalDivider thickness={1} /><Customers model={model} />
  </ItemDetailSection>;
}
function Combo({ model }: { model: AdminItemDetailReadModel }) {
  const combo = useAdminItemDetailComboRead(model.context, model.state.detail!.code), { colors } = useBaseTheme(), { state } = combo;
  if (state.phase === 'invalidated') return null;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} imageUrl={adminItemDetailComboImageUrl(state.imageEntry)} /><View style={styles.gap} />
    <ItemDetailSection title={model.a('calculate.combo_components')}>
      {state.phase === 'loading' ? <Column modifiers={[fillMaxWidth(), padding(0, 12, 0, 12)]}><LinearProgressIndicator modifiers={[fillMaxWidth()]} /></Column>
        : state.phase === 'unavailable' || state.phase === 'error' ? <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 10)]}><TextButton enabled={state.phase !== 'unavailable'} onClick={combo.retry}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><ItemDetailIcon name="refresh" color={state.phase === 'unavailable' ? itemDetailDisabled(colors.onSurface) : colors.primary} iconSize={18} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('calculate.combo_load_failed')}</Text></Row></TextButton></Column>
          : !state.entry?.template.products.length ? <Text modifiers={[padding(0, 10, 0, 10)]}>{model.a('calculate.combo_products_empty')}</Text>
            : state.entry.template.products.map((product, index) => <Column key={index} modifiers={[fillMaxWidth()]}>{index ? <HorizontalDivider thickness={1} /> : null}<Product combo={combo} product={product} index={index} model={model} /></Column>)}
    </ItemDetailSection><View style={styles.gap} /><Information model={model} combo />
  </ScrollView>;
}
export function AdminItemDetailBody({ model }: { model: AdminItemDetailReadModel }) {
  const { colors } = useBaseTheme(), value = model.presentation; if (!value || !model.state.detail) return null;
  if (value.kind === 'combo') return <Combo model={model} />;
  if (value.kind === 'finished') return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} imageUrl={adminItemDetailFinishedImageUrl(model.context.session.baseUrl, model.state.detail)} /><View style={styles.gap} /><Information model={model} /></ScrollView>;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} /><View style={styles.gap} /><ItemDetailSection title={model.a('detail.main_info')}>
    {value.ordinaryRows.map((row, index) => <ItemDetailRow key={index} row={row} />)}
    <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 10)]}><OutlinedButton enabled={value.groupEnabled} onClick={() => model.dispatch('group')} colors={{ contentColor: colors.onSurface }} shape={itemDetailRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-detail-change-group')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{value.groupBusy ? <ItemDetailSpinner /> : <ItemDetailIcon name="account_tree" color={value.groupEnabled ? colors.onSurface : itemDetailDisabled(colors.onSurface)} iconSize={18} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{value.groupLabel}</Text></Row></OutlinedButton></Column>
    <ItemDetailRow row={value.uom} />
  </ItemDetailSection><View style={styles.gap} /><ItemDetailSection title={model.a('detail.system_info')}>{value.dates.map((row, index) => <ItemDetailRow key={index} row={row} />)}</ItemDetailSection><View style={styles.gap} />
    <ItemDetailSection title={model.a('detail.item_delete_title')}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[padding(0, 0, 0, 12)]}>{model.a('detail.delete_description')}</Text>
      <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 10)]}><Surface shape={itemDetailRounded(20)} color="transparent" border={{ width: 1, color: colors.error }} modifiers={[fillMaxWidth()]}>
        <Button enabled={value.deleteEnabled} onClick={() => model.dispatch('delete')} colors={{ containerColor: 'transparent', disabledContainerColor: 'transparent', contentColor: colors.error }} shape={itemDetailRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-detail-delete')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>{value.deleteBusy ? <ItemDetailSpinner /> : <ItemDetailIcon name="delete_forever" color={value.deleteEnabled ? colors.error : itemDetailDisabled(colors.onSurface)} iconSize={18} />}<Text style={{ fontSize: 16, fontWeight: '500' }}>{value.deleteLabel}</Text></Row></Button>
      </Surface></Column>
    </ItemDetailSection>
  </ScrollView>;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, list: { paddingLeft: 8, paddingTop: 8, paddingRight: 8, paddingBottom: 120 }, gap: { height: 10 } });
