import { Card, Checkbox, CircularProgressIndicator, Column, IconButton, LazyColumn, ModalBottomSheet, OutlinedButton, Button, RNHostView, Row, Spacer, Surface, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminApparatus } from '../apparatusApi';
import { roundedCustomer } from './AdminCustomerDetailNative.android';
import type { AdminCustomerApparatusProps } from './AdminCustomerDetailScreenTypes';
import { useAdminCustomerApparatus, type AdminCustomerApparatusModel } from './useAdminCustomerApparatus';

function ApparatusIcon({ name }: { name: 'precision_manufacturing' | 'hourglass_top' | 'chevron_right' | 'refresh' | 'close' }) {
  const { colors } = useBaseTheme(); return <RNHostView matchContents><SymbolView name={{ android: name }} size={24} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>;
}
function ScopeRow({ item, selected, model, sheetId }: { item: AdminApparatus; selected: readonly string[]; model: AdminCustomerApparatusModel; sheetId?: number }) {
  const checked = !!item.id && selected.includes(item.id);
  return <Surface color="transparent" enabled={!!item.id} onClick={() => model.toggle(item.id, !checked, sheetId)} modifiers={[fillMaxWidth(), testID(`admin-customer-apparatus-${item.id}`)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 48 })]}><Checkbox value={checked} enabled={!!item.id} onCheckedChange={value => model.toggle(item.id, value, sheetId)} />
      <Spacer modifiers={[size(16, 1)]} /><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{item.name}</Text>
    </Row>
  </Surface>;
}
function Picker({ model, sheetId }: { model: AdminCustomerApparatusModel; sheetId?: number }) {
  const source = sheetId === undefined ? model.state : model.state.sheet!;
  return !source.apparatus.length ? <Text style={{ typography: 'bodySmall' }}>{model.a('scope.empty')}</Text> : <Column modifiers={[fillMaxWidth()]}>
    <Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('scope.allowed')}</Text><Spacer modifiers={[height(6)]} />
    {source.apparatus.map((item, index) => <ScopeRow key={`${item.id}:${index}`} item={item} selected={source.selected} model={model} sheetId={sheetId} />)}
  </Column>;
}
function MaterialSheet({ model }: { model: AdminCustomerApparatusModel }) {
  const sheet = model.state.sheet!, native = useRef<ModalBottomSheetRef>(null), hiding = useRef(false), { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  useEffect(() => { if (sheet.closing && !hiding.current) { hiding.current = true; void Promise.resolve(native.current?.hide()).finally(() => model.nativeDismiss(sheet.id)); } }, [sheet.closing, sheet.id, model]);
  return <ModalBottomSheet ref={native} skipPartiallyExpanded showDragHandle containerColor={colors.surface} onDismissRequest={() => model.nativeDismiss(sheet.id)}>
    <Column modifiers={[fillMaxWidth(), height(screenHeight * .82)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 10, 8, 8)]}><Text style={{ fontSize: 20, fontWeight: '800' }} modifiers={[weight(1)]}>{model.a('scope.material_supplier_title')}</Text>
        <IconButton enabled={!sheet.saving} onClick={() => model.closeSheet(sheet.id)} modifiers={[size(48, 48), testID('admin-material-apparatus-close')]}><ApparatusIcon name="close" /></IconButton>
      </Row>
      <LazyColumn contentPadding={{ start: 16, end: 16, bottom: 16 }} modifiers={[fillMaxWidth(), weight(1)]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('scope.material_description')}</Text><Spacer modifiers={[height(16)]} />
        {sheet.apparatus.length ? <><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('scope.allowed')}</Text><Spacer modifiers={[height(6)]} />
          <LazyColumn.Items data={sheet.apparatus} keyExtractor={(item, index) => `${item.id}:${index}`} estimatedItemSize={48}>{({ item }) => <ScopeRow item={item} selected={sheet.selected} model={model} sheetId={sheet.id} />}</LazyColumn.Items></> : <Text style={{ typography: 'bodySmall' }}>{model.a('scope.empty')}</Text>}
      </LazyColumn><Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}><Button enabled={!sheet.saving} onClick={() => model.saveSheet(sheet.id)} shape={roundedCustomer(20)} modifiers={[fillMaxWidth(), height(56), testID('admin-material-apparatus-save')]}>
        <Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(sheet.saving ? 'action.saving' : 'scope.save_action')}</Text>
      </Button></Column>
    </Column>
  </ModalBottomSheet>;
}
// @v2 AdminAparatchiApparatusCard
export function AdminCustomerApparatusCard(props: AdminCustomerApparatusProps) {
  const model = useAdminCustomerApparatus(props), { state } = model, { colors } = useBaseTheme(); if (!model.current() || !state.valid) return null;
  if (!state.loading && state.error == null && !model.visible) return null;
  const button = (retry: boolean) => <OutlinedButton enabled={retry || !state.saving} onClick={retry ? model.retry : model.save} colors={{ contentColor: colors.onSurface }} shape={roundedCustomer(20)} modifiers={[fillMaxWidth(), height(56), testID(retry ? 'admin-customer-apparatus-retry' : 'admin-customer-apparatus-save')]}>
    <Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(retry ? 'action.retry' : state.saving ? 'action.saving' : 'scope.save_action')}</Text>
  </OutlinedButton>;
  return <View><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
    {model.material ? <Card><Surface color="transparent" onClick={!state.loading && state.error == null ? model.openSheet : undefined} modifiers={[fillMaxWidth(), testID('admin-material-apparatus-field')]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 8, 16, 8), defaultMinSize({ minHeight: 72 })]}><ApparatusIcon name="precision_manufacturing" /><Spacer modifiers={[size(16, 1)]} />
        <Column modifiers={[weight(1)]}><Text style={{ typography: 'bodyLarge' }}>{model.a('scope.material_supplier_title')}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{model.a(state.loading ? 'action.loading' : state.error != null ? 'scope.load_failed' : state.selected.length ? 'scope.selected_count' : 'scope.none_selected', { count: state.selected.length })}</Text></Column>
        {state.error != null ? <IconButton onClick={model.retry} modifiers={[size(48, 48), testID('admin-material-apparatus-retry'), semantics({ contentDescription: model.a('action.retry') })]}><ApparatusIcon name="refresh" /></IconButton> : <ApparatusIcon name={state.loading ? 'hourglass_top' : 'chevron_right'} />}
      </Row>
    </Surface></Card> : <Card><Column modifiers={[fillMaxWidth(), padding(20, 20, 20, 20)]}>
      {state.loading ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><CircularProgressIndicator modifiers={[size(36, 36)]} /></Column> : state.error != null ? <>
        <Text style={{ typography: 'titleMedium' }}>{model.a('scope.load_failed')}</Text><Spacer modifiers={[height(8)]} />{button(true)}
      </> : <><Text style={{ typography: 'titleMedium' }}>{model.a('scope.operator_title')}</Text><Spacer modifiers={[height(4)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('scope.operator_description')}</Text>
        <Spacer modifiers={[height(12)]} /><Picker model={model} /><Spacer modifiers={[height(12)]} /><Button enabled={!state.saving} onClick={model.save} shape={roundedCustomer(20)} modifiers={[fillMaxWidth(), height(56), testID('admin-customer-apparatus-save')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(state.saving ? 'action.saving' : 'scope.save_action')}</Text></Button>
      </>}
    </Column></Card>}
    {state.sheet ? <MaterialSheet key={state.sheet.id} model={model} /> : null}
  </BaseHost></View>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' } });
