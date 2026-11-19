import { AlertDialog, BasicAlertDialog, Button, CircularProgressIndicator, Column, FilterChip, FlowRow, IconButton, OutlinedButton,
  RNHostView, Row, Shape, SnackbarHost, Spacer, Surface, Text, useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, verticalScroll, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { adminUserPrincipalRoleFromJson } from './adminUsersModel';
import { AdminWarehouseAssigneePicker } from './AdminWarehouseAssigneePicker.android';
import type { AdminWarehouseSettingsProps } from './AdminWarehouseSettingsTypes';
import { adminWarehouseSettingsAssignmentKey, adminWarehouseSettingsRoleLabel } from './adminWarehouseSettingsController';
import { dartTrim } from './dartJsonString';
import { useAdminWarehouseSettings } from './useAdminWarehouseSettings';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function Icon({ name, color, iconSize = 24 }: { name: 'person_outline' | 'person_remove' | 'person_add' | 'delete_outline' | 'block' | 'warehouse' | 'expand_more' | 'expand_less'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} /></RNHostView>;
}
type Model = ReturnType<typeof useAdminWarehouseSettings>;
function Confirmation({ model }: { model: Model }) {
  const dialog = model.state.dialog!, labels = model.dialogText!, colors = useMaterialColors(), { width: screenWidth } = useWindowDimensions();
  if (dialog.kind === 'unassign') return <BasicAlertDialog properties={{ usePlatformDefaultWidth: false }} onDismissRequest={() => model.dismiss(dialog.id)}>
    <Surface color={colors.surfaceContainerHigh} shape={shape(28)} border={{ width: 1, color: colors.outlineVariant }} modifiers={[width(Math.min(420, Math.max(0, screenWidth - 48)))]}>
      <Column modifiers={[padding(24, 24, 24, 20), verticalScroll()]}><Text style={{ typography: 'headlineSmall' }}>{labels.title}</Text><Spacer modifiers={[height(10)]} />
        <Text style={{ typography: 'bodyLarge', lineHeight: 23.2 }} color={colors.onSurfaceVariant}>{labels.body}</Text><Spacer modifiers={[height(22)]} />
        <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}><OutlinedButton onClick={() => model.dismiss(dialog.id)} shape={shape(20)} modifiers={[weight(1), height(56)]}><Text>{labels.cancel}</Text></OutlinedButton>
          <Button onClick={() => model.confirm(dialog.id)} shape={shape(20)} colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }} modifiers={[weight(1), height(56), testID('warehouse-settings-confirm')]}><Text>{labels.confirm}</Text></Button></Row>
      </Column>
    </Surface>
  </BasicAlertDialog>;
  return <AlertDialog onDismissRequest={() => model.dismiss(dialog.id)}>
    <AlertDialog.Icon><Icon name={dialog.kind === 'blocked' ? 'block' : 'delete_outline'} color={colors.error} /></AlertDialog.Icon>
    <AlertDialog.Title><Text>{labels.title}</Text></AlertDialog.Title><AlertDialog.Text><Column><Text>{labels.body}</Text>{labels.warning ? <><Spacer modifiers={[height(12)]} /><Text>{labels.warning}</Text></> : null}</Column></AlertDialog.Text>
    <AlertDialog.ConfirmButton><Column modifiers={dialog.kind === 'delete' ? [fillMaxWidth()] : undefined}>
      {labels.cancel ? <><OutlinedButton onClick={() => model.dismiss(dialog.id)} shape={shape(20)} modifiers={[fillMaxWidth(), height(56)]}><Text>{labels.cancel}</Text></OutlinedButton><Spacer modifiers={[height(8)]} /></> : null}
      <Button onClick={() => model.confirm(dialog.id)} shape={shape(20)} colors={dialog.kind === 'delete' ? { containerColor: colors.error, contentColor: colors.onError } : undefined}
        modifiers={[...(dialog.kind === 'delete' ? [fillMaxWidth()] : []), height(56), testID('warehouse-settings-confirm')]}><Text>{labels.confirm}</Text></Button>
    </Column></AlertDialog.ConfirmButton>
  </AlertDialog>;
}
/** @v2 _WarehouseSettingsTab */
export function AdminWarehouseSettingsTab(props: AdminWarehouseSettingsProps) {
  const model = useAdminWarehouseSettings(props), { state, summary, current, a } = model, colors = useMaterialColors(), snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null);
  const picker = state.picker;
  const noticeSerial = state.notice?.serial, notice = model.notice;
  useEffect(() => { if (current && notice && noticeSerial !== shown.current) { shown.current = noticeSerial ?? null; void snackbar.current?.showSnackbar({ message: notice, duration: 'short' }); } }, [current, notice, noticeSerial]);
  if (!current) return null;
  const card = (children: React.ReactNode, danger = false) => <Surface color={danger ? colors.errorContainer : colors.surfaceContainerLowest} shape={shape(12)} modifiers={[fillMaxWidth()]}><Column modifiers={[padding(16, 16, 16, 16)]}>{children}</Column></Surface>;
  const button = (label: string, icon: 'person_add' | 'delete_outline', click: () => void, enabled: boolean, danger = false) => danger
    ? <Button onClick={click} enabled={enabled} colors={{ containerColor: colors.error, contentColor: colors.onError }} shape={shape(20)} modifiers={[fillMaxWidth(), height(56), testID('warehouse-settings-delete')]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><Icon name={icon} color={colors.onError} /><Text>{label}</Text></Row></Button>
    : <OutlinedButton onClick={click} enabled={enabled} shape={shape(20)} modifiers={[fillMaxWidth(), height(56), testID('warehouse-settings-assign')]}><Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center"><Icon name={icon} color={colors.primary} /><Text>{label}</Text></Row></OutlinedButton>;
  const selected = state.summaries.find(row => row.warehouse === state.warehouse)?.warehouse ?? a('warehouse.unselected');
  return <View style={styles.root}><BaseHost style={styles.body}><Column modifiers={[fillMaxSize(), verticalScroll(), padding(4, 4, 4, props.bottomPadding)]}>
    <Column modifiers={[padding(8, 8, 8, 8)]}><FilterChip selected={!!state.warehouse} onClick={model.toggleFilter} elevation={2} modifiers={[testID('warehouse-settings-filter')]}>
      <FilterChip.LeadingIcon><Icon name="warehouse" color={colors.onSurfaceVariant} iconSize={18} /></FilterChip.LeadingIcon><FilterChip.Label><Text>{`${a('label.warehouse')}: ${selected}`}</Text></FilterChip.Label>
      <FilterChip.TrailingIcon><Icon name={props.filterExpanded ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} iconSize={18} /></FilterChip.TrailingIcon></FilterChip>
      {props.filterExpanded ? <><Spacer modifiers={[height(8)]} /><FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>{state.summaries.map(row => <FilterChip key={row.warehouse} selected={row.warehouse === state.warehouse} onClick={() => model.selectWarehouse(row.warehouse)}><FilterChip.Label><Text>{row.warehouse}</Text></FilterChip.Label></FilterChip>)}</FlowRow></> : null}
    </Column>
    {!summary ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}><Text>{a('warehouse.no_selection')}</Text></Column> : <>
      <Spacer modifiers={[height(8)]} />{card(<><Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>{a('warehouse.summary')}</Text><Spacer modifiers={[height(12)]} />
        {([['warehouse.items', summary.product_count], ['warehouse.reserved_count', summary.reserved_count], ['warehouse.assignments', summary.assignment_count]] as const).map(([key, count]) => <Row key={key} modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}><Text modifiers={[weight(1)]}>{a(key)}</Text><Text style={{ fontWeight: 'bold' }}>{String(count)}</Text></Row>)}</>)}
      <Spacer modifiers={[height(8)]} />{card(<><Text style={{ typography: 'titleMedium', fontWeight: 'bold' }}>{a('warehouse.assigned_users')}</Text><Spacer modifiers={[height(8)]} />
        {state.assignmentsLoading ? <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 12, 0, 12)]}><CircularProgressIndicator /></Column> : !state.assignments.length
          ? <Text color={colors.onSurfaceVariant} modifiers={[padding(0, 8, 0, 8)]}>{a('warehouse.no_assignments')}</Text> : state.assignments.map((row, index) => {
            const key = adminWarehouseSettingsAssignmentKey(row); return <Row key={`${key}:${index}`} verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 72 })]}>
              <Icon name="person_outline" color={colors.onSurfaceVariant} /><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
                <Text style={{ typography: 'bodyLarge' }}>{dartTrim(row.display_name) ? row.display_name : row.principal_ref}</Text>
                <Text style={{ typography: 'bodyMedium' }} color={colors.onSurfaceVariant}>{adminWarehouseSettingsRoleLabel(adminUserPrincipalRoleFromJson(row.principal_role))}</Text>
              </Column>{state.removingKey === key ? <CircularProgressIndicator modifiers={[size(24, 24)]} /> : <IconButton onClick={() => model.unassign(row)} enabled={state.removingKey === null}
                modifiers={[size(48, 48), semantics({ contentDescription: a('warehouse.unassign') }), testID(`warehouse-settings-unassign-${key}`)]}><Icon name="person_remove" color={colors.onSurfaceVariant} /></IconButton>}
            </Row>; })}
        <Spacer modifiers={[height(8)]} />{button(a('warehouse.assign_user'), 'person_add', model.assign, !state.assigning)}</>)}
      <Spacer modifiers={[height(8)]} />{card(<><Text color={colors.onErrorContainer} style={{ typography: 'titleMedium', fontWeight: 'bold' }}>{a('warehouse.dangerous_action')}</Text><Spacer modifiers={[height(6)]} />
        <Text color={colors.onErrorContainer}>{a('warehouse.delete_cascade_warning')}</Text><Spacer modifiers={[height(12)]} />{button(a('warehouse.delete_title'), 'delete_outline', model.deleteWarehouse, !state.deleting, true)}</>, true)}
    </>}
  </Column>
    {picker && <AdminWarehouseAssigneePicker key={picker.id} users={model.users} query={picker.query} title={a('warehouse.assign_to')}
      hint={a('warehouse.user_search')} closeLabel={a('action.close')} emptyLabel={model.t('noRecordsYet')} searchTestID="warehouse-settings-assignee-search"
      onSearch={query => model.search(picker.id, query)} onSelect={user => model.select(picker.id, user)} onDismiss={() => model.dismissPicker(picker.id)} />}
    {state.dialog && <Confirmation key={state.dialog.id} model={model} />}
  </BaseHost>
    <View pointerEvents="none" style={styles.notice}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, notice: { position: 'absolute', left: 16, right: 16, bottom: 16 } });
