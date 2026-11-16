import { Box, Column, ModalBottomSheet, RNHostView, Row, Shape, Spacer, Surface, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { themeController } from '../shared/themeRuntime';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import type { AdminWarehouseItemRollRow } from './adminWarehouseItemRollsModel';
import type { AdminWarehouseItemRollsProviderModel } from './useAdminWarehouseItemRollsProvider';
import { dartTrim } from './dartJsonString';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function RowCard({ row, model }: { row: AdminWarehouseItemRollRow; model: AdminWarehouseItemRollsProviderModel }) {
  const { colors } = useBaseTheme();
  return <BaseHost style={{ width: '100%', height: 61 }}><Surface onClick={() => model.showDetails(row.roll)} color={colors.surfaceContainerLowest} shadowElevation={themeController.variant === 'white' ? 1 : 0}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: row.index === 0 ? 18 : 6, topEnd: row.index === 0 ? 18 : 6, bottomStart: row.index > 0 && row.index === row.count - 1 ? 18 : 6, bottomEnd: row.index > 0 && row.index === row.count - 1 ? 18 : 6 } })}
    modifiers={[fillMaxWidth(), height(61), testID(`warehouse-item-roll-${row.key}`)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(14, 8, 10, 8)]}>
      <Surface color={colors.secondaryContainer} shape={shape(8)} modifiers={[size(30, 30)]}><Box contentAlignment="center" modifiers={[fillMaxSize()]}><RNHostView matchContents><SymbolView name={{ android: 'receipt_long' }} size={16} tintColor={colors.onSecondaryContainer} /></RNHostView></Box></Surface>
      <Spacer modifiers={[size(14, 1)]} /><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
        <Text maxLines={1} overflow="ellipsis" style={{ fontSize: 16, fontWeight: '700' }}>{row.title}</Text><Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ fontSize: 12, lineHeight: 12.6 }}>{row.subtitle}</Text>
      </Column><Spacer modifiers={[size(16, 1)]} /><RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={22} tintColor={colors.onSurfaceVariant} /></RNHostView>
    </Row>
  </Surface></BaseHost>;
}
function RollDetails({ model }: { model: AdminWarehouseItemRollsProviderModel }) {
  const { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions(), details = model.presentation?.details, row = details ? model.rows.find(value => value.roll === details.roll) : null;
  if (!details || !row) return null;
  return <ModalBottomSheet key={details.id} showDragHandle skipPartiallyExpanded initialFullyExpanded containerColor={colors.surface} onDismissRequest={() => model.dismissDetails(details.id, true)}>
    <RNHostView matchContents><ScrollView style={{ maxHeight: screenHeight * .72, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
      <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
        <Text style={{ typography: 'headlineSmall', fontWeight: '800' }}>{row.title}</Text><Spacer modifiers={[height(16)]} />
        {row.details.map((line, index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[width(72)]}>{line.label}</Text><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{adminWarehouseMainDetailValue(line.value)}</Text>
        </Row>)}
      </Column></BaseHost>
    </ScrollView></RNHostView>
  </ModalBottomSheet>;
}
/** @v2 _WarehouseItemRollsSheet + _WarehouseItemRollRow */
export function AdminWarehouseItemRollsSheet({ model }: { model: AdminWarehouseItemRollsProviderModel }) {
  const { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions(), insets = useSafeAreaInsets(), value = model.presentation;
  if (!model.active || !value) return null;
  const title = dartTrim(value.item.name) ? value.item.name : value.item.code;
  return <BaseHost style={styles.host}><ModalBottomSheet key={value.id} skipPartiallyExpanded initialFullyExpanded showDragHandle={false} containerColor={colors.surface} scrimColor="rgba(0,0,0,.32)" onDismissRequest={model.close}>
    <Column modifiers={[fillMaxWidth(), height((screenHeight - insets.top) * .86), padding(16, 12, 16, 8)]}>
      <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxWidth(), height(8)]}><Surface color={colors.outlineVariant} shape={shape(999)} modifiers={[size(42, 4)]} /></Column><Spacer modifiers={[height(12)]} />
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{model.a('warehouse.rolls')}</Text><Spacer modifiers={[height(4)]} />
      <Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium' }}>{title}</Text><Spacer modifiers={[height(12)]} />
      {value.phase === 'loading' ? <Box contentAlignment="center" modifiers={[fillMaxWidth(), weight(1)]}><AdminLoadingIndicator /></Box> : value.phase === 'error' || !model.rows.length ? <Box contentAlignment="center" modifiers={[fillMaxWidth(), weight(1)]}>
        <Text style={{ typography: 'bodyMedium', textAlign: 'center' }}>{model.a(value.phase === 'error' ? 'warehouse.rolls_load_failed' : 'warehouse.no_rolls')}</Text>
      </Box> : <RNHostView modifiers={[fillMaxWidth(), weight(1)]}><FlatList style={{ flex: 1 }} data={model.rows} keyExtractor={row => row.key} renderItem={({ item }) => <RowCard row={item} model={model} />} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} contentContainerStyle={{ paddingBottom: 12 }} /></RNHostView>}
    </Column>
    {value.details ? <RollDetails model={model} /> : null}
  </ModalBottomSheet></BaseHost>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' } });
