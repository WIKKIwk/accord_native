import { BasicAlertDialog, Box, Button, Column, FilledTonalButton, IconButton, ModalBottomSheet, OutlinedButton, RNHostView, Row, Spacer, Surface, useNativeState, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, imePadding, padding, semantics, size, testID, verticalScroll, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { useRef } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { AdminBasicTextField as BasicTextField, AdminOutlinedTextField as OutlinedTextField } from './AdminTextFields.android';
import { WorkerDetailIcon, WorkerDetailLoading, workerDetailAlpha, workerDetailSegmentShape, workerDetailShape } from './AdminWorkerDetailNative.android';
import type { AdminWorkerDetailMaterial } from './adminWorkerDetailAssignmentsApi';
import type { AdminWorkerDetailOverlay, AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';
export type AdminWorkerDetailOverlaysModel = Pick<AdminWorkerDetailScreenModel, 'a' | 't' | 'current' | 'overlays'> & {
  /** Optional original selection/lifetime ticket committed only after the native warehouse picker closes. */
  prepareWarehousePickerClose?: (id: number, confirmed: boolean) => (() => void) | null;
};

function Confirmation({ overlay }: { overlay: AdminWorkerDetailOverlay }) {
  const { editor, id } = overlay, labels = editor.dialogText!, { colors } = useBaseTheme(), { width: screenWidth } = useWindowDimensions();
  return <BasicAlertDialog properties={{ usePlatformDefaultWidth: false }} onDismissRequest={() => editor.dismissDialog(id)}>
    <Surface color={colors.surfaceContainerHigh} border={{ width: 1, color: workerDetailAlpha(colors.outlineVariant, .65) }} shape={workerDetailShape(28)} modifiers={[width(Math.min(420, Math.max(0, screenWidth - 48)))]}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 24, 24, 20)]}><Text style={{ typography: 'headlineSmall' }}>{labels.title}</Text><Spacer modifiers={[height(10)]} />
        <Text style={{ typography: 'bodyLarge', lineHeight: 23.2 }} color={colors.onSurfaceVariant}>{labels.message}</Text><Spacer modifiers={[height(22)]} />
        <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
          <OutlinedButton onClick={() => editor.dismissDialog(id)} shape={workerDetailShape(20)} colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }} modifiers={[weight(1), defaultMinSize({ minHeight: 56 })]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{labels.cancel}</Text></OutlinedButton>
          <Button onClick={() => editor.confirmRemove(id)} shape={workerDetailShape(20)} colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }} modifiers={[weight(1), defaultMinSize({ minHeight: 56 }), testID('admin-worker-detail-editor-remove-confirm')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{labels.confirm}</Text></Button>
        </Row>
      </Column>
    </Surface>
  </BasicAlertDialog>;
}
function Picker({ overlay, model }: { overlay: AdminWorkerDetailOverlay; model: AdminWorkerDetailOverlaysModel }) {
  const { editor, id } = overlay, picker = editor.state.picker!, native = useNativeState(picker.query), { colors, mode } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  const sheet = useRef<ModalBottomSheetRef>(null), hiding = useRef(false), warehouse = picker.kind === 'warehouse';
  const hide = async (action: () => void, confirmed = false) => { if (!editor.canInteractOverlay(id) || hiding.current) return;
    const commit = warehouse && model.prepareWarehousePickerClose ? model.prepareWarehousePickerClose(id, confirmed) : action; if (!commit) return;
    hiding.current = true; try { await sheet.current?.hide(); commit(); } finally { hiding.current = false; } };
  const close = () => { void hide(() => editor.dismissPicker(id)); };
  const materialRow = ({ item, index }: { item: AdminWorkerDetailMaterial; index: number }) => <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
    <Surface color={colors.surfaceContainerHighest} shape={workerDetailSegmentShape(index, editor.materials.length)} modifiers={[fillMaxWidth()]} onClick={() => { void hide(() => editor.selectMaterial(id, item)); }}>
      <Column modifiers={[fillMaxWidth(), padding(18, 16, 18, 16)]} verticalArrangement={{ spacedBy: 6 }}><Text style={{ fontSize: 20, fontWeight: '700' }}>{item.name}</Text><Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{`${item.variants.length} mikron varianti`}</Text></Column>
    </Surface>
  </BaseHost>;
  return <ModalBottomSheet ref={sheet} skipPartiallyExpanded initialFullyExpanded showDragHandle={false} containerColor={colors.surface} onDismissRequest={() => editor.dismissPicker(id)}>
    <Column modifiers={[fillMaxWidth(), height(screenHeight * (warehouse ? .72 : .66)), imePadding(), ...(warehouse ? [] : [padding(12, 12, 12, 24)])]}>
      <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), ...(warehouse ? [padding(0, 10, 0, 0)] : [])]}><Surface color={colors.outlineVariant} shape={workerDetailShape(999)} modifiers={[size(warehouse ? 42 : 36, 4)]} /></Column>
      {!warehouse ? <Spacer modifiers={[height(14)]} /> : null}
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), ...(warehouse ? [padding(16, 14, 8, 8)] : [])]}><Text style={{ fontSize: 20, fontWeight: warehouse ? '800' : '700' }} modifiers={[weight(1)]}>{warehouse ? model.a('warehouse.picker_title') : 'Homashyo tanlang'}</Text>
        <IconButton onClick={close} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') })]}><WorkerDetailIcon name="close" color={colors.onSurfaceVariant} /></IconButton>
      </Row>
      {warehouse ? <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}><OutlinedTextField value={native} onValueChange={value => editor.search(id, value)} singleLine shape={workerDetailShape(16)}
        colors={{ focusedContainerColor: mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest, unfocusedContainerColor: mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest,
          focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant }} textStyle={{ fontSize: 16, fontWeight: '400', color: colors.onSurface }} modifiers={[fillMaxWidth(), testID('admin-material-warehouses-search')]}>
        <OutlinedTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 15, fontWeight: '400' }}>{model.a('warehouse.picker_search')}</Text></OutlinedTextField.Placeholder><OutlinedTextField.LeadingIcon><WorkerDetailIcon name="search" color={colors.onSurface} /></OutlinedTextField.LeadingIcon>
      </OutlinedTextField></Column> : <><Spacer modifiers={[height(14)]} /><Surface color={colors.surfaceContainerHighest} border={{ width: 1, color: workerDetailAlpha(colors.outlineVariant, .56) }} shape={workerDetailShape(999)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 58 })]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(18, 0, 18, 0)]}><WorkerDetailIcon name="search" color={colors.onSurfaceVariant} iconSize={26} />
          <BasicTextField value={native} onValueChange={value => editor.search(id, value)} singleLine keyboardOptions={{ imeAction: 'search' }} textStyle={{ color: colors.onSurface, fontSize: 16 }} modifiers={[weight(1), height(58), testID('admin-worker-detail-material-search')]}>
            <BasicTextField.DecorationBox><Box><BasicTextField.InnerTextField /><BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge' }}>Qidirish</Text></BasicTextField.Placeholder></Box></BasicTextField.DecorationBox>
          </BasicTextField>
        </Row>
      </Surface></>}
      <Spacer modifiers={[height(warehouse ? 10 : 14)]} />
      {warehouse ? <RNHostView modifiers={[fillMaxWidth(), weight(1)]}><FlatList style={styles.list} data={editor.warehouses} keyExtractor={name => name} contentContainerStyle={styles.warehouseList} keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <View style={styles.warehouseGap} />}
        ListEmptyComponent={<BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}><Text>{model.a('warehouse.picker_empty')}</Text></Column></BaseHost>}
        renderItem={({ item: name }) => <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={picker.selected === name ? colors.primaryContainer : colors.surfaceContainerHighest} shape={workerDetailShape(16)} modifiers={[fillMaxWidth(), testID(`admin-material-warehouse-${name.toLowerCase()}`)]}
          onClick={() => editor.selectWarehouse(id, name)}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), padding(16, 8, 16, 8)]}>
            <WorkerDetailIcon name="warehouse" color={colors.onSurfaceVariant} /><Text style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>{name}</Text><WorkerDetailIcon name={picker.selected === name ? 'check_circle' : 'radio_button_unchecked'} color={colors.onSurfaceVariant} />
          </Row></Surface></BaseHost>} /></RNHostView> : picker.loading ? <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxWidth(), weight(1)]}><WorkerDetailLoading /></Column>
        : picker.error ? <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxWidth(), weight(1)]}><Text>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(12)]} /><FilledTonalButton onClick={() => editor.retryMaterial(id)} shape={workerDetailShape(20)} modifiers={[defaultMinSize({ minHeight: 56 })]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.t('retry')}</Text></FilledTonalButton></Column>
          : <RNHostView modifiers={[fillMaxWidth(), weight(1)]}><FlatList style={styles.list} data={editor.materials} keyExtractor={(item, index) => `${item.id}:${index}`} renderItem={materialRow} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
            onScroll={({ nativeEvent: e }) => editor.materialScroll(id, e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height)} ItemSeparatorComponent={() => <View style={styles.materialGap} />}
            ListEmptyComponent={<BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}><Text>{model.t('noRecordsYet')}</Text></Column></BaseHost>}
            ListFooterComponent={picker.loadingMore ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 18, 0, 18)]}><WorkerDetailLoading /></Column></BaseHost> : undefined} /></RNHostView>}
      {warehouse ? <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}><Button onClick={() => { void hide(() => editor.confirmWarehouse(id), true); }} enabled={picker.selected !== null} shape={workerDetailShape(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-material-warehouse-confirm')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><WorkerDetailIcon name="check" color={colors.onPrimary} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('action.confirm')}</Text></Row>
      </Button></Column> : null}
    </Column>
  </ModalBottomSheet>;
}
/** Source editors may overlap while their independent catalog loads complete; IDs retain native window ordering. */
export function WorkerDetailOverlays({ model }: { model: AdminWorkerDetailOverlaysModel }) {
  if (!model.overlays.length || !model.current()) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}><BaseHost style={styles.host}>{model.overlays.map(overlay => overlay.type === 'dialog'
    ? <Confirmation key={overlay.id} overlay={overlay} /> : <Picker key={overlay.id} overlay={overlay} model={model} />)}</BaseHost></View>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, fullWidth: { width: '100%' }, list: { flex: 1 }, warehouseList: { paddingHorizontal: 12, paddingBottom: 16 }, warehouseGap: { height: 6 }, materialGap: { height: 2 } });
