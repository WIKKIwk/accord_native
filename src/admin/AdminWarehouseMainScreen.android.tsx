import { BasicTextField, Box, Column, FilledTonalIconButton, FilterChip, FlowRow, IconButton, ModalBottomSheet, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, TextButton, useNativeState, type BasicTextFieldRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { RoleHeaderRow, RoleHeaderSearchField } from '../shared/navigation/RoleHeaderRow';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { ORDERS_TAB_BAR_HEIGHT } from '../shared/orders/ordersWorkspaceTypes';
import { useAdminShellTheme } from './useAdminShellTheme';
import { localizedGetter } from '../shared/localization';
import { AdminCreateMenu } from './AdminCreateMenu.android';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text } from './AdminTypography.android';
import { AdminWarehouseCreateDialog } from './AdminWarehouseCreateDialog.android';
import { adminWarehouseMainEntries, type AdminWarehouseMainEntry } from './AdminWarehouseMainEntries';
import { adminWarehouseMainDetailValue, type AdminWarehouseMainRow } from './AdminWarehouseMainRows';
import type { AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';
import { AdminWarehouseSettingsTab } from './AdminWarehouseSettingsTab.android';
import { useAdminWarehouseMain, type AdminWarehouseMainModel } from './useAdminWarehouseMain';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const passthrough = () => true;
type IconName = 'arrow_back' | 'close' | 'warehouse' | 'expand_less' | 'expand_more' | 'check' | 'inventory_2' | 'category' | 'grid_view' | 'lock_outline' | 'chevron_right' | 'qr_code_2' | 'edit' | 'refresh';
function Icon({ name, color, iconSize = 24 }: { name: IconName; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
export function WarehouseLoadingIndicator({ small = false }: { small?: boolean }) {
  return <AdminLoadingIndicator size={small ? 48 : 64} glyphSize={small ? 28 : 38} />;
}
function SearchHeader({ model, props }: { model: AdminWarehouseMainModel; props: AdminWarehouseMainScreenProps }) {
  const { colors } = useBaseTheme(), { presentation, current } = model, text = useNativeState(model.state.search), field = useRef<BasicTextFieldRef>(null);
  // Only programmatic fills write back; a reported keystroke must never echo over newer native text.
  useEffect(() => { if (current()) void field.current?.setText(presentation.fillText); }, [presentation.fillVersion, presentation.fillText, current]);
  useEffect(() => { if (!presentation.searchFocused) void field.current?.blur(); }, [presentation.searchFocused]);
  const close = () => { if (model.interactive()) { void field.current?.blur(); model.closeSearch(); } };
  return <RoleHeaderRow>
    {!presentation.searchFocused && <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back} tintColor={colors.onSurfaceVariant} testID="warehouse-back" />}
    <RoleHeaderSearchField focused={presentation.searchFocused}>
      <BaseHost style={styles.searchField}><Row verticalAlignment="center" modifiers={[fillMaxSize()]}>
        <BasicTextField ref={field} value={text} singleLine onValueChange={model.setSearch} onFocusChanged={model.setSearchFocused}
          keyboardOptions={{ imeAction: 'search', capitalization: 'none', autoCorrectEnabled: false }} keyboardActions={{ onSearch: close }}
          textStyle={{ color: colors.onSurfaceVariant, fontSize: 15, textAlign: 'left' }} modifiers={[weight(1), height(56), semantics({ contentDescription: model.searchHint }), testID('warehouse-search')]}>
          <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}><BasicTextField.InnerTextField />
            <BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 14, fontWeight: '400', textAlign: 'left' }} modifiers={[fillMaxWidth()]}>{presentation.searchFocused ? '' : model.searchHint}</Text></BasicTextField.Placeholder>
          </Box></BasicTextField.DecorationBox>
        </BasicTextField>
        {presentation.searchFocused || model.hasSearchText ? <IconButton onClick={presentation.searchFocused ? close : model.clearSearch}
          modifiers={[size(48, 48), semantics({ contentDescription: model.a(presentation.searchFocused ? 'action.close' : 'action.clear') }), testID('warehouse-search-close')]}><Icon name="close" color={colors.onSurfaceVariant} /></IconButton> : null}
      </Row></BaseHost>
    </RoleHeaderSearchField>
    {!presentation.searchFocused && model.profile()}
  </RoleHeaderRow>;
}
function FilterChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const turn = useSharedValue(expanded ? 180 : 0);
  useEffect(() => { turn.value = withTiming(expanded ? 180 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [expanded, turn]);
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <RNHostView matchContents><Animated.View style={[{ width: 18, height: 18 }, motion]}><SymbolView name={{ android: 'expand_more' }} size={18} tintColor={color} importantForAccessibility="no" /></Animated.View></RNHostView>;
}
function WarehouseFilter({ model }: { model: AdminWarehouseMainModel }) {
  const { colors } = useBaseTheme(), { state } = model, selected = !!state.warehouse;
  const chipColors = { containerColor: colors.surfaceContainerLowest, labelColor: colors.onSurface, selectedContainerColor: colors.secondaryContainer, selectedLabelColor: colors.onSecondaryContainer };
  return <Animated.View layout={LinearTransition.duration(180).easing(Easing.out(Easing.cubic))} style={{ width: '100%', overflow: 'hidden' }}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}>
    <FilterChip selected={selected} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }} onClick={model.toggleFilter} modifiers={[testID('warehouse-filter')]}>
      <FilterChip.LeadingIcon><Icon name="warehouse" iconSize={18} color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></FilterChip.LeadingIcon>
      <FilterChip.Label><Text style={{ fontSize: 14, fontWeight: '500' }}>{`${model.a('label.warehouse')}: ${model.filterNames.find(name => name === state.warehouse) ?? model.a('warehouse.unselected')}`}</Text></FilterChip.Label>
      <FilterChip.TrailingIcon><FilterChevron expanded={state.filterExpanded} color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></FilterChip.TrailingIcon>
    </FilterChip>
    {state.filterExpanded ? <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
      {model.filterNames.map((name, index) => <FilterChip key={`${index}:${name}`} selected={name === state.warehouse} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }} onClick={() => model.selectWarehouse(name)} modifiers={[testID(`warehouse-filter-option-${index}`)]}>
        {name === state.warehouse ? <FilterChip.LeadingIcon><Icon name="check" iconSize={18} color={colors.onSecondaryContainer} /></FilterChip.LeadingIcon> : null}
        <FilterChip.Label><Text style={{ fontSize: 14, fontWeight: '500' }}>{name}</Text></FilterChip.Label>
      </FilterChip>)}
    </FlowRow> : null}
  </Column></BaseHost></Animated.View>;
}
function SummaryRow({ row, index, count, model }: { row: AdminWarehouseMainRow; index: number; count: number; model: AdminWarehouseMainModel }) {
  const { colors } = useBaseTheme(), icon: IconName = row.icon === 'item' ? 'inventory_2' : row.icon === 'qolip' ? 'grid_view' : row.icon === 'reservation' ? 'lock_outline' : 'category';
  return <BaseHost style={{ height: 61, width: '100%' }}><Surface onClick={() => model.openRow(row)} color={colors.surfaceContainerLowest}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6, bottomStart: index > 0 && index === count - 1 ? 18 : 6, bottomEnd: index > 0 && index === count - 1 ? 18 : 6 } })}
    modifiers={[fillMaxWidth(), height(61), testID(`warehouse-row-${row.id}`)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(14, 8, 10, 8)]}>
      <Surface color={colors.secondaryContainer} shape={shape(8)} modifiers={[size(30, 30)]}><Box contentAlignment="center" modifiers={[fillMaxSize()]}><Icon name={icon} iconSize={16} color={colors.onSecondaryContainer} /></Box></Surface>
      <Spacer modifiers={[size(14, 1)]} /><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
        <Text maxLines={1} overflow="ellipsis" style={{ fontSize: 16, fontWeight: '700' }}>{row.title}</Text>
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ fontSize: 12, lineHeight: 12.6 }}>{row.subtitle}</Text>
      </Column><Spacer modifiers={[size(16, 1)]} /><Icon name="chevron_right" iconSize={22} color={colors.onSurfaceVariant} />
    </Row>
  </Surface></BaseHost>;
}
function Entry({ entry, model }: { entry: AdminWarehouseMainEntry; model: AdminWarehouseMainModel }) {
  const { colors } = useBaseTheme();
  return <View style={{ paddingTop: entry.gap }}>{entry.kind === 'row' ? <SummaryRow row={entry.row} index={entry.index} count={entry.count} model={model} /> : <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
    <Column horizontalAlignment="center" modifiers={[fillMaxWidth(), ...(entry.kind === 'hint' ? [padding(12, 0, 12, 12)] : [])]}>
      {entry.kind === 'loading' ? <WarehouseLoadingIndicator small={entry.small} /> : entry.kind === 'retry' ? <OutlinedButton onClick={() => { void (entry.more ? model.loadMore() : model.retryItems()); }} shape={shape(20)} modifiers={[defaultMinSize({ minHeight: 56 }), testID(entry.more ? 'warehouse-load-more' : 'warehouse-retry-items')]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><Icon name="refresh" color={colors.primary} iconSize={18} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(entry.more ? 'action.load_more' : 'action.retry')}</Text></Row>
      </OutlinedButton> : <Text color={entry.kind === 'hint' ? colors.onSurfaceVariant : colors.onSurface} style={{ typography: entry.kind === 'hint' ? 'bodySmall' : 'bodyMedium', textAlign: 'center' }}>{model.a(entry.textKey)}</Text>}
    </Column>
  </BaseHost>}</View>;
}
function ProductList({ model, bottomPadding, tab, pagerGesture, headerOffset, headerHeight, showStockTabs }: {
  model: AdminWarehouseMainModel; bottomPadding: number; tab: 'available' | 'reserved'; pagerGesture?: PanGesture;
  headerOffset: SharedValue<number>; headerHeight: SharedValue<number>; showStockTabs: boolean;
}) {
  const { state, products } = model;
  const active = state.pageTab === 'products' && state.stockTab === tab && model.focused && !model.dialog;
  const entries = useMemo(() => adminWarehouseMainEntries({ ...state, stockTab: tab }, products.qolip, model.availableGroups, model.reservedGroups), [state, tab, products.qolip, model.availableGroups, model.reservedGroups]);
  return <View style={styles.productList}><OrdersList rows={entries} rowKey={entry => entry.key}
    renderRow={entry => <Entry entry={entry} model={model} />} passthrough={passthrough} keyboardShouldPersistTaps="handled"
    active={active} scrollEnabled={active} scrollResetKey={tab === 'available' ? state.scrollReset : undefined} pagerGesture={pagerGesture}
    headerOffset={headerOffset} headerHeight={headerHeight} headerFollowsContent={showStockTabs}
    topInset={4 + (showStockTabs ? ORDERS_TAB_BAR_HEIGHT : 0)} onScrollMetrics={tab === 'available' ? model.onItemsScroll : undefined}
    footer={<View style={{ height: bottomPadding }} />}>
    <WarehouseFilter model={model} />
  </OrdersList></View>;
}
function Products({ model, bottomPadding, session, pagerGesture }: { model: AdminWarehouseMainModel; bottomPadding: number; session: AdminWarehouseMainScreenProps['session']; pagerGesture?: PanGesture }) {
  const { state, products } = model, headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const showStockTabs = !!state.summary.sections.length && !!state.warehouse;
  useEffect(() => {
    headerHeight.set(showStockTabs ? ORDERS_TAB_BAR_HEIGHT : 0);
    headerOffset.set(0);
  }, [showStockTabs, headerHeight, headerOffset]);
  const listProps = { model, bottomPadding, pagerGesture, headerOffset, headerHeight, showStockTabs };
  if (!showStockTabs) return <ProductList {...listProps} tab="available" />;
  const tabs = [{ id: 'available', name: model.a('warehouse.available', { count: products.availableCount }) }];
  if (products.hasReserved) tabs.push({ id: 'reserved', name: model.a('warehouse.reserved', { count: products.reservedCount }) });
  return <OrdersWorkspace session={session} tabs={tabs} selected={state.stockTab} swipeEnabled={false} headerOffset={headerOffset}
    onSelect={tab => { if (tab === 'available' || tab === 'reserved') model.setStockTab(tab); }}>
    {tab => <ProductList {...listProps} key={tab === 'reserved' ? state.warehouse : 'available'} tab={tab === 'reserved' ? 'reserved' : 'available'} />}
  </OrdersWorkspace>;
}
function Details({ model, renderActionSurface }: { model: AdminWarehouseMainModel; renderActionSurface?: AdminWarehouseMainScreenProps['renderDetailActionSurface'] }) {
  const { colors } = useBaseTheme(), { height: viewportHeight } = useWindowDimensions(), dialog = model.dialog;
  if (dialog?.kind !== 'details') return null; const { row } = dialog;
  return <BaseHost style={{ position: 'absolute', width: '100%' }}><ModalBottomSheet showDragHandle skipPartiallyExpanded initialFullyExpanded onDismissRequest={model.closeDialog} containerColor={colors.surface} scrimColor="rgba(0,0,0,.32)">
    <RNHostView matchContents><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: viewportHeight * .72, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Text style={{ typography: 'headlineSmall', fontWeight: '800' }}>{row.title}</Text><Spacer modifiers={[height(16)]} /></BaseHost>
      {model.detailOrder}
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
        {row.details.map((line, index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[width(72)]}>{line.label}</Text><Text style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{adminWarehouseMainDetailValue(line.value)}</Text>
        </Row>)}
        {'canQr' in row && row.canQr || row.kind === 'raw' && row.canEdit ? <Row horizontalArrangement="end" verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
          {'canQr' in row && row.canQr ? <FilledTonalIconButton onClick={() => model.runDetailAction(dialog.id, 'qr')} modifiers={[size(48, 48), semantics({ contentDescription: model.a('warehouse.qr_view') }), testID('warehouse-details-qr')]}><Icon name="qr_code_2" color={colors.onSecondaryContainer} /></FilledTonalIconButton> : null}
          {row.kind === 'raw' && row.canEdit ? <>{row.canQr ? <Spacer modifiers={[size(8, 1)]} /> : null}<FilledTonalIconButton onClick={() => model.runDetailAction(dialog.id, 'edit')} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.edit') }), testID('warehouse-details-edit')]}><Icon name="edit" color={colors.onSecondaryContainer} /></FilledTonalIconButton></> : null}
        </Row> : null}
      </Column></BaseHost>
    </ScrollView></RNHostView>
    {renderActionSurface?.()}
  </ModalBottomSheet></BaseHost>;
}
/** @v2 AdminWarehousesScreen */
export function AdminWarehouseMainScreen(props: AdminWarehouseMainScreenProps) {
  const model = useAdminWarehouseMain(props), { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets(), { width: viewportWidth } = useWindowDimensions(), { state } = model;
  if (!model.valid) return null;
  const bottomPadding = insets.bottom + model.bottomPaddingOffset, tabs = model.scope === 'werka' ? [] : [
    { id: 'products', name: model.scope === 'material' ? model.a('warehouse.tabs_warehouses') : 'Mahsulotlar' }, { id: 'settings', name: model.scope === 'material' ? model.a('warehouse.tabs_states') : 'Sozlamalar' }];
  return <View style={[styles.screen, { backgroundColor: chromeBackground, paddingTop: insets.top }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-header-safe-area"><View style={{ backgroundColor: chromeBackground }}><SearchHeader model={model} props={props} /></View></SafeAreaView>
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-warehouse-main-body-frame">
    {model.summaryScreen === 'loading' ? <View style={styles.center}><BaseHost matchContents><WarehouseLoadingIndicator /></BaseHost></View> : model.summaryScreen === 'error' ? <ScrollView style={styles.body} contentContainerStyle={styles.retry}>
      <BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(Math.max(viewportWidth * .88, 280), 360), maxWidth: '100%' }}><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
        <TextButton onClick={() => { void model.reload(); }} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }}
          modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('warehouse-retry')]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text></TextButton>
      </Column></BaseHost>
    </ScrollView> : model.scope === 'werka' ? <Products model={model} bottomPadding={bottomPadding} session={props.session} /> :
      <OrdersWorkspace session={props.session} tabs={tabs} selected={state.pageTab} swipeEnabled={model.focused && !model.dialog}
        onSelect={tab => { if (tab === 'products' || tab === 'settings') model.setPageTab(tab); }}>
        {(tab, pagerGesture) => <View style={styles.productPage}>{tab === 'products' ?
          <Products model={model} bottomPadding={bottomPadding} session={props.session} pagerGesture={pagerGesture} /> :
          model.scope === 'material' ? model.materialStates : <AdminWarehouseSettingsTab {...model.settings} bottomPadding={bottomPadding} />}
        </View>}
      </OrdersWorkspace>}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    {model.scope === 'admin' ? <AdminCreateMenu actions={model.actions} isCurrent={model.interactive} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={model.a('action.close')} visible={model.focused && !model.dialog} bottomOffset={insets.bottom + 94} /> : null}
    {model.dialog?.kind === 'create' ? <AdminWarehouseCreateDialog key={model.dialog.id} session={props.session} witness={props.witness} isCurrent={model.dialogCurrent} onSaved={model.created} onClose={model.closeDialog} /> : null}
    {model.dialog?.kind === 'details' ? <Details key={model.dialog.id} model={model} renderActionSurface={props.renderDetailActionSurface} /> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, productPage: { flex: 1, marginTop: ORDERS_TAB_BAR_HEIGHT }, productList: { flex: 1, marginHorizontal: 4 }, searchField: { flex: 1, minWidth: 0, height: 56 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
