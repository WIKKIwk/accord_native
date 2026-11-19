import { Box, Button, Checkbox, Column, FilledTonalIconButton, IconButton, LazyColumn, LinearProgressIndicator, ModalBottomSheet, OutlinedButton,
  RNHostView, Row, Shape, SnackbarHost, Spacer, Surface, TextButton, useNativeState, type ModalBottomSheetRef, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { AdminScreenHeader } from './AdminTopBar.android';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, toggleable, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useIsFocused } from 'expo-router';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { ORDERS_TAB_BAR_HEIGHT } from '../shared/orders/ordersWorkspaceTypes';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminOutlinedTextField as OutlinedTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminRolesScreenProps } from './AdminRolesTypes';
import { useAdminRoles, type AdminRolesScreenModel } from './useAdminRoles';

const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const passthrough = () => true;
const segmented = (index: number, count: number) => Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6,
  bottomStart: index > 0 && index === count - 1 ? 18 : 6, bottomEnd: index > 0 && index === count - 1 ? 18 : 6 } });
function Icon({ name, color, iconSize = 24 }: { name: AndroidSymbol; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
function Badge({ name }: { name: AndroidSymbol }) {
  const { colors } = useBaseTheme(); return <Surface color={colors.secondaryContainer} shape={rounded(8)} modifiers={[size(30, 30)]}>
    <Box contentAlignment="center" modifiers={[fillMaxSize()]}><Icon name={name} color={colors.onSecondaryContainer} iconSize={16} /></Box>
  </Surface>;
}
/** @v2 _RoleDefinitionTile */
function RoleRow({ row, index, model }: { row: AdminRolesScreenModel['roles'][number]; index: number; model: AdminRolesScreenModel }) {
  const { colors } = useBaseTheme();
  return <Surface color={colors.surfaceContainerLowest} tonalElevation={0} shadowElevation={4} shape={segmented(index, model.roles.length)} modifiers={[fillMaxWidth()]}>
    <Column modifiers={[fillMaxWidth()]}><Surface color="transparent" onClick={() => model.controller.expand(row.role.id)} modifiers={[fillMaxWidth(), testID(`admin-role-card-${row.role.id}`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 8, 4, 8), defaultMinSize({ minHeight: row.expanded ? 0 : 45 })]}>
        <Badge name={row.role.system ? 'admin_panel_settings' : 'verified_user'} /><Spacer modifiers={[size(14, 1)]} />
        <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
          <Text style={{ typography: 'titleMedium', fontWeight: '700' }} maxLines={1} overflow="ellipsis">{row.label}</Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 14.4 }} maxLines={2} overflow="ellipsis">{row.summary}</Text>
        </Column>
        {row.editable ? <IconButton onClick={() => model.controller.openEditor(row.role)} modifiers={[semantics({ contentDescription: model.t('adminEditRole') }), testID(`admin-role-edit-${row.role.id}`)]}>
          <Icon name="edit" color={colors.onSurfaceVariant} /></IconButton> : null}
        <IconButton onClick={() => model.controller.expand(row.role.id)} modifiers={[semantics({ contentDescription: model.t(row.expanded ? 'adminRoleDetailsHide' : 'adminRoleDetailsShow') }), testID(`admin-role-details-${row.role.id}`)]}>
          <Icon name={row.expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} color={colors.onSurfaceVariant} />
        </IconButton>
      </Row>
    </Surface>{row.expanded && row.capabilityText ? <Text style={{ typography: 'bodyMedium' }} modifiers={[fillMaxWidth(), padding(58, 0, 14, 14)]}>{row.capabilityText}</Text> : null}</Column>
  </Surface>;
}
/** @v2 _RoleAssignmentTile */
function AssignmentRow({ row, index, model }: { row: AdminRolesScreenModel['principals'][number]; index: number; model: AdminRolesScreenModel }) {
  const { colors } = useBaseTheme();
  return <Surface color={colors.surfaceContainerLowest} tonalElevation={0} shadowElevation={4} shape={segmented(index, model.principals.length)} modifiers={[fillMaxWidth()]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(14, 8, 12, 8)]}>
      <Badge name={row.principal.icon} /><Spacer modifiers={[size(14, 1)]} /><Column modifiers={[weight(1)]}>
        <Text style={{ typography: 'titleMedium', fontWeight: '700' }} maxLines={1} overflow="ellipsis">{row.principal.name}</Text><Spacer modifiers={[height(4)]} />
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 14.4 }} maxLines={1} overflow="ellipsis">{row.subtitle}</Text><Spacer modifiers={[height(5)]} />
        <Text style={{ typography: 'bodyMedium' }} maxLines={1} overflow="ellipsis">{row.assignedLabel}</Text>
        {row.apparatusText ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[padding(0, 4, 0, 0)]}>{row.apparatusText}</Text> : null}
      </Column><OutlinedButton onClick={() => model.controller.openAssignment(row.principal)} shape={rounded(20)} contentPadding={{ start: 14, end: 14 }}
        modifiers={[height(44), defaultMinSize({ minWidth: 0 }), testID(`admin-role-assignment-${index}`)]}><Text style={{ typography: 'labelLarge' }}>{model.t('archiveSelectDateAction')}</Text></OutlinedButton>
    </Row>
  </Surface>;
}
function CapabilityRow({ code, label, model }: { code: string; label: string; model: AdminRolesScreenModel }) {
  const sheet = model.state.sheet!, { colors } = useBaseTheme(); if (sheet.kind !== 'editor') return null;
  const selected = sheet.capabilities.includes(code), toggle = () => model.controller.toggleCapability(sheet.id, code, !selected);
  return <Surface color="transparent" onClick={toggle} enabled={!sheet.closing} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
    <Column modifiers={[weight(1)]}><Text>{label}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{code}</Text></Column>
    <Checkbox value={selected} enabled={!sheet.closing} onCheckedChange={value => model.controller.toggleCapability(sheet.id, code, value)} modifiers={[testID(`admin-role-capability-${code}`)]} />
  </Row></Surface>;
}
function Scope({ model }: { model: AdminRolesScreenModel }) {
  const sheet = model.state.sheet!; if (sheet.kind !== 'assignment') return null;
  return <Column modifiers={[fillMaxWidth()]}>{sheet.data.apparatus.length ? <><Text style={{ typography: 'labelLarge' }}>{model.a('scope.allowed')}</Text><Spacer modifiers={[height(6)]} />
    {sheet.data.apparatus.map((item, index) => {
      const selected = !!item.id && sheet.selected.includes(item.id), enabled = !!item.id && !sheet.closing;
      return <Row key={`${item.id}:${index}`} verticalAlignment="center" modifiers={[fillMaxWidth(),
        toggleable(selected, () => model.controller.toggleApparatus(sheet.id, item.id, !selected), { role: 'checkbox', enabled }),
        semantics({ contentDescription: item.name }), testID(`admin-role-apparatus-row-${index}`)]}>
        {/* The row owns the single native toggle target, including label and checkbox taps. */}
        <Checkbox value={selected} enabled={enabled} modifiers={[testID(`admin-role-apparatus-${index}`)]} />
        <Text modifiers={[weight(1)]}>{item.name}</Text>
      </Row>;
    })}</> : <Text style={{ typography: 'bodySmall' }}>{model.a('scope.empty')}</Text>}</Column>;
}
/** @v2 _AdminRoleEditorSheet
 * @v2 _RoleAssignmentSheet
 */
function RolesSheet({ model }: { model: AdminRolesScreenModel }) {
  const sheet = model.state.sheet!, native = useRef<ModalBottomSheetRef>(null), hiding = useRef(false), { colors } = useBaseTheme(), { height: screenHeight } = useWindowDimensions();
  const label = useNativeState(sheet.kind === 'editor' ? sheet.label : '');
  useEffect(() => { if (sheet.closing && !hiding.current && native.current) { hiding.current = true; void native.current.hide().then(() => model.controller.nativeDismiss(sheet.id)).catch(() => {}); } }, [sheet.closing, sheet.id, model]);
  return <ModalBottomSheet ref={native} showDragHandle skipPartiallyExpanded containerColor={colors.surface} onDismissRequest={() => model.controller.nativeDismiss(sheet.id)}>
    {sheet.kind === 'editor' ? <Column modifiers={[fillMaxWidth(), height(screenHeight * .82), padding(20, 0, 20, 20)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>{model.t(sheet.role ? 'adminEditRole' : 'adminNewRole')}</Text>
        <FilledTonalIconButton enabled={model.canSaveEditor} onClick={() => model.controller.saveEditor(sheet.id)} modifiers={[semantics({ contentDescription: model.t('save') }), testID('admin-role-save-action')]}>
          <Icon name="check" color={colors.onSurfaceVariant} /></FilledTonalIconButton>
      </Row><Spacer modifiers={[height(16)]} /><OutlinedTextField value={label} onValueChange={value => model.controller.setLabel(sheet.id, value)} enabled={!sheet.closing} modifiers={[fillMaxWidth(), testID('admin-role-name')]}>
        <OutlinedTextField.Label><Text>{model.t('adminRoleNameLabel')}</Text></OutlinedTextField.Label>
      </OutlinedTextField><Spacer modifiers={[height(12)]} /><LazyColumn modifiers={[fillMaxWidth(), weight(1)]}>
        <LazyColumn.Items data={sheet.data.capabilities} keyExtractor={(item, index) => `${item.code}:${index}`} estimatedItemSize={72}>{({ item }) => <CapabilityRow code={item.code} label={model.capabilityLabel(item.code)} model={model} />}</LazyColumn.Items>
      </LazyColumn>
    </Column> : <LazyColumn contentPadding={{ start: 12, end: 12, bottom: 20 }} modifiers={[fillMaxWidth(), height(screenHeight * .5625)]}>
      <Text style={{ typography: 'titleLarge' }}>{model.m('adminRoleForPrincipal', { name: sheet.principal.name })}</Text><Spacer modifiers={[height(12)]} />
      <LazyColumn.Items data={model.options} keyExtractor={(row, index) => `${row.role.id}:${index}`} estimatedItemSize={80}>{({ item: row }) => <Column modifiers={[fillMaxWidth()]}>
        <Surface color="transparent" enabled={row.enabled && !sheet.closing} onClick={() => model.controller.assign(sheet.id, row.role)} modifiers={[fillMaxWidth(), testID(`admin-role-option-${row.role.id}`)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}><Icon name={row.role.system ? 'admin_panel_settings' : 'verified_user'} color={row.enabled ? colors.onSurfaceVariant : colors.outline} /><Spacer modifiers={[size(16, 1)]} />
            <Column modifiers={[weight(1)]}><Text color={row.enabled ? colors.onSurface : colors.outline}>{row.label}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{row.subtitle}</Text></Column>
          </Row>
        </Surface>{row.apparatus ? <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 12)]}><Scope model={model} /><Spacer modifiers={[height(12)]} />
          <Button enabled={row.enabled && !sheet.closing} onClick={() => model.controller.assign(sheet.id, row.role)} shape={rounded(20)} modifiers={[fillMaxWidth(), height(56), testID(`admin-role-apparatus-save-${row.role.id}`)]}><Text style={{ typography: 'labelLarge' }}>{model.t('save')}</Text></Button>
        </Column> : null}
      </Column>}</LazyColumn.Items>
    </LazyColumn>}
  </ModalBottomSheet>;
}

/** @v2 AdminRolesScreen */
export function AdminRolesScreen(props: AdminRolesScreenProps) {
  const model = useAdminRoles(props), { state } = model, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const focused = useIsFocused(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null);
  useEffect(() => { if (model.snackbar && shown.current !== model.snackbar.serial && model.current) { shown.current = model.snackbar.serial; void snackbar.current?.showSnackbar({ message: model.snackbar.message, duration: 'short' }); } }, [model]);
  if (!model.current) return null;
  const tabs = [{ id: 'roles', name: model.t('adminRolesTitle') }, { id: 'assignments', name: model.t('adminRolesAssignTab') }];
  const currentTab = tabs[state.tab].id;
  const listProps = { headerOffset, headerHeight, passthrough, refreshing: state.refreshing,
    topInset: ORDERS_TAB_BAR_HEIGHT + 4, footer: <View style={{ height: insets.bottom + 136 }} />,
    onRefresh: () => model.controller.reload() };
  return <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <AdminScreenHeader title={model.t('adminRolesTitle')} navigation={props.navigation} profileAction={props.profileAction} />{props.topNotice}
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-roles-body-frame">
      {!state.data ? <BaseHost style={styles.screen}>{state.loading ? <Box contentAlignment="center" modifiers={[fillMaxSize()]}><AdminLoadingIndicator /></Box> : <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(24, 40, 24, 40)]}>
        <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center' }}>{model.t('serverDisconnectedRetry')}</Text>
          <TextButton onClick={() => { void model.controller.reload(); }} contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}><Text>{model.t('retry')}</Text></TextButton>
        </Column></Column>}</BaseHost> : <>
          {state.refreshing ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><LinearProgressIndicator modifiers={[fillMaxWidth(), height(2)]} /></BaseHost> : null}
          <OrdersWorkspace session={props.session} tabs={tabs} selected={currentTab} swipeEnabled={focused && !state.sheet}
            onSelect={tab => { if (tab === 'roles' || tab === 'assignments') model.controller.selectTab(tab === 'roles' ? 0 : 1); }}>
            {(tab, pagerGesture) => tab === 'roles' ?
              <OrdersList {...listProps} active={focused && currentTab === tab} pagerGesture={pagerGesture}
                rows={model.roles} rowKey={(row, index) => `${row.role.id}:${index}`}
                renderRow={(row, index) => <BaseHost matchContents={{ vertical: true }} style={styles.listRow}><RoleRow row={row} index={index} model={model} /></BaseHost>}>
                <BaseHost matchContents={{ vertical: true }} style={styles.listRow}><Column modifiers={[fillMaxWidth()]}>
                  <Button onClick={() => model.controller.openEditor()} shape={rounded(20)} modifiers={[fillMaxWidth(), height(56), testID('admin-role-create')]}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><Icon name="add" color={colors.onPrimary} /><Text style={{ typography: 'labelLarge' }}>{model.t('adminNewRole')}</Text></Row></Button><Spacer modifiers={[height(10)]} />
                </Column></BaseHost>
              </OrdersList> :
              <OrdersList {...listProps} active={focused && currentTab === tab} pagerGesture={pagerGesture}
                rows={model.principals} rowKey={(row, index) => `${row.principal.role}:${row.principal.ref}:${index}`}
                renderRow={(row, index) => <BaseHost matchContents={{ vertical: true }} style={styles.listRow}><AssignmentRow row={row} index={index} model={model} /></BaseHost>}>{null}</OrdersList>}
          </OrdersWorkspace>
        </>}
    </AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    {state.sheet ? <BaseHost style={styles.sheet}><RolesSheet key={state.sheet.id} model={model} /></BaseHost> : null}
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16, maxWidth: width - 32 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, fullWidth: { width: '100%' },
  listRow: { width: '100%', paddingHorizontal: 4, paddingBottom: 2 }, sheet: { position: 'absolute', width: '100%' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, notice: { position: 'absolute', left: 16, right: 16 } });
