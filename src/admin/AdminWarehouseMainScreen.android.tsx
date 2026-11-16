import { BasicTextField, Box, Column, FilledTonalIconButton, FilterChip, FlowRow, IconButton, ModalBottomSheet, OutlinedButton, RNHostView, Row, Shape, Spacer, Surface, Text, TextButton, useNativeState, type BasicTextFieldRef } from '@expo/ui/jetpack-compose';
import PagerView, { type PagerViewRef } from '@expo/ui/community/pager-view';
import { defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { themeController } from '../shared/themeRuntime';
import { AdminCreateMenu } from './AdminCreateMenu.android';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminWarehouseCreateDialog } from './AdminWarehouseCreateDialog.android';
import { adminWarehouseMainEntries, type AdminWarehouseMainEntry } from './AdminWarehouseMainEntries';
import { adminWarehouseMainDetailValue, type AdminWarehouseMainRow } from './AdminWarehouseMainRows';
import type { AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';
import { AdminWarehouseSettingsTab } from './AdminWarehouseSettingsTab.android';
import { useAdminWarehouseMain, type AdminWarehouseMainModel } from './useAdminWarehouseMain';

const shape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const blend = (outline: string, surface: string) => `#${[1, 3, 5].map(offset => Math.round(parseInt(outline.slice(offset, offset + 2), 16) * .08 + parseInt(surface.slice(offset, offset + 2), 16) * .92).toString(16).padStart(2, '0')).join('')}FF`;
type IconName = 'arrow_back' | 'close' | 'warehouse' | 'expand_less' | 'expand_more' | 'check' | 'inventory_2' | 'category' | 'grid_view' | 'lock_outline' | 'chevron_right' | 'qr_code_2' | 'edit' | 'refresh';
function Icon({ name, color, iconSize = 24 }: { name: IconName; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
export function WarehouseLoadingIndicator({ small = false }: { small?: boolean }) {
  return <AdminLoadingIndicator size={small ? 48 : 64} glyphSize={small ? 28 : 38} />;
}
function HeaderSlot({ visible, slotWidth, children }: { visible: boolean; slotWidth: number; children: ReactNode }) {
  const extent = useSharedValue(visible ? slotWidth : 0), opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => { extent.value = withTiming(visible ? slotWidth : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); opacity.value = withTiming(visible ? 1 : 0, { duration: 120, easing: Easing.out(Easing.cubic) }); }, [visible, slotWidth, extent, opacity]);
  const motion = useAnimatedStyle(() => ({ width: extent.value, opacity: opacity.value }));
  return <Animated.View style={[styles.headerSlot, motion]} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
    <View style={{ width: slotWidth, height: 60, justifyContent: 'center' }}>{children}</View>
  </Animated.View>;
}
function SearchHeader({ model, props }: { model: AdminWarehouseMainModel; props: AdminWarehouseMainScreenProps }) {
  const { colors } = useBaseTheme(), { presentation, current } = model, text = useNativeState(model.state.search), field = useRef<BasicTextFieldRef>(null);
  // Only programmatic fills write back; a reported keystroke must never echo over newer native text.
  useEffect(() => { if (current()) void field.current?.setText(presentation.fillText); }, [presentation.fillVersion, presentation.fillText, current]);
  useEffect(() => { if (!presentation.searchFocused) void field.current?.blur(); }, [presentation.searchFocused]);
  const close = () => { if (model.interactive()) { void field.current?.blur(); model.closeSearch(); } };
  return <View style={styles.header}>
    <HeaderSlot visible={!presentation.searchFocused} slotWidth={44}><BaseHost matchContents><IconButton onClick={model.back} modifiers={[size(38, 48), semantics({ contentDescription: props.backLabel }), testID('warehouse-back')]}><Icon name="arrow_back" color={colors.onSurfaceVariant} /></IconButton></BaseHost></HeaderSlot>
    <BaseHost style={styles.searchField}><Surface color={blend(colors.outlineVariant, colors.surfaceContainerLow)} shape={shape(999)} modifiers={[fillMaxWidth(), height(58)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(18, 0, 0, 0)]}>
        <BasicTextField ref={field} value={text} singleLine onValueChange={model.setSearch} onFocusChanged={model.setSearchFocused}
          keyboardOptions={{ imeAction: 'search', capitalization: 'none', autoCorrectEnabled: false }} keyboardActions={{ onSearch: close }}
          textStyle={{ color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '400', lineHeight: 16.8 }} modifiers={[weight(1), height(58), semantics({ contentDescription: model.searchHint }), testID('warehouse-search')]}>
          <BasicTextField.DecorationBox><Box contentAlignment="centerStart" modifiers={[fillMaxSize()]}><BasicTextField.InnerTextField />
            <BasicTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 14, fontWeight: '400', textAlign: 'center' }} modifiers={[fillMaxWidth()]}>{presentation.searchFocused ? '' : model.searchHint}</Text></BasicTextField.Placeholder>
          </Box></BasicTextField.DecorationBox>
        </BasicTextField>
        {presentation.searchFocused || model.hasSearchText ? <IconButton onClick={presentation.searchFocused ? close : model.clearSearch}
          modifiers={[size(48, 48), semantics({ contentDescription: model.a(presentation.searchFocused ? 'action.close' : 'action.clear') }), testID('warehouse-search-close')]}><Icon name="close" color={colors.onSurfaceVariant} /></IconButton> : <Spacer modifiers={[size(18, 1)]} />}
      </Row>
    </Surface></BaseHost>
    <HeaderSlot visible={!presentation.searchFocused} slotWidth={58}>{model.profile()}</HeaderSlot>
  </View>;
}
function Tabs({ options, selected, select, id }: { options: readonly { value: string; label: string }[]; selected: string; select: (value: string) => void; id: string }) {
  const { colors } = useBaseTheme();
  return <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceContainer, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant }}>
    {options.map(option => <View key={option.value} style={{ flex: 1, borderBottomWidth: 2, borderBottomColor: option.value === selected ? colors.primary : 'transparent' }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><TextButton onClick={() => select(option.value)} modifiers={[fillMaxWidth(), height(38), testID(`${id}-${option.value}`)]}>
        <Text color={option.value === selected ? colors.primary : colors.onSurfaceVariant} style={{ fontSize: 14, fontWeight: '400' }}>{option.label}</Text>
      </TextButton></BaseHost>
    </View>)}
  </View>;
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
  return <BaseHost style={{ height: 61, width: '100%' }}><Surface onClick={() => model.openRow(row)} color={colors.surfaceContainerLowest} shadowElevation={themeController.variant === 'white' ? 1 : 0}
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
function ProductList({ model, bottomPadding, tab }: { model: AdminWarehouseMainModel; bottomPadding: number; tab: 'available' | 'reserved' }) {
  const { state, products } = model, list = useRef<FlatList<AdminWarehouseMainEntry>>(null), active = state.stockTab === tab;
  const entries = useMemo(() => adminWarehouseMainEntries({ ...state, stockTab: tab }, products.qolip, model.availableGroups, model.reservedGroups), [state, tab, products.qolip, model.availableGroups, model.reservedGroups]);
  useEffect(() => { if (tab === 'available') list.current?.scrollToOffset({ offset: 0, animated: false }); }, [state.scrollReset, tab]);
  const selected = !!state.summary.sections.length && !!state.warehouse;
  return <FlatList ref={list} key={tab === 'reserved' ? `${state.warehouse}:${products.hasReserved}` : 'available'} data={entries} keyExtractor={entry => entry.key} renderItem={({ item }) => <Entry entry={item} model={model} />} keyboardShouldPersistTaps="handled" scrollEnabled={active && model.focused && !model.dialog}
    contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: bottomPadding }}
    ListHeaderComponent={<>{selected ? <Tabs id="warehouse-stock-tab" options={[{ value: 'available', label: model.a('warehouse.available', { count: products.availableCount }) }, ...(products.hasReserved ? [{ value: 'reserved', label: model.a('warehouse.reserved', { count: products.reservedCount }) }] : [])]}
      selected={state.stockTab} select={value => { if (value === 'available' || value === 'reserved') model.setStockTab(value); }} /> : null}<WarehouseFilter model={model} /></>}
    onScroll={event => { const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent; if (active && tab === 'available' && contentSize.height - contentOffset.y - layoutMeasurement.height <= 420) void model.loadMore(); }} scrollEventThrottle={100} />;
}
function Products({ model, bottomPadding }: { model: AdminWarehouseMainModel; bottomPadding: number }) {
  return <View style={styles.body}>{(['available', 'reserved'] as const).map(tab => <View key={tab} style={{ flex: 1, display: model.state.stockTab === tab ? 'flex' : 'none' }}>
    <ProductList model={model} bottomPadding={bottomPadding} tab={tab} />
  </View>)}</View>;
}
function Details({ model }: { model: AdminWarehouseMainModel }) {
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
  </ModalBottomSheet></BaseHost>;
}
/** @v2 AdminWarehousesScreen */
export function AdminWarehouseMainScreen(props: AdminWarehouseMainScreenProps) {
  const model = useAdminWarehouseMain(props), { colors } = useBaseTheme(), insets = useSafeAreaInsets(), { width: viewportWidth } = useWindowDimensions(), pager = useRef<PagerViewRef>(null), { interactive, state } = model;
  useEffect(() => { if (interactive()) pager.current?.setPage(state.pageTab === 'products' ? 0 : 1); }, [state.pageTab, interactive]);
  if (!model.valid) return null;
  const bottomPadding = insets.bottom + model.bottomPaddingOffset, tabs = model.scope === 'werka' ? [] : [
    { value: 'products', label: model.scope === 'material' ? model.a('warehouse.tabs_warehouses') : 'Mahsulotlar' }, { value: 'settings', label: model.scope === 'material' ? model.a('warehouse.tabs_states') : 'Sozlamalar' }];
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <View style={{ backgroundColor: colors.surfaceContainerHigh }}><SearchHeader model={model} props={props} /></View>
    <View style={[styles.contentFrame, { backgroundColor: colors.surfaceContainerLow, borderBottomLeftRadius: props.footer == null ? 0 : 18, borderBottomRightRadius: props.footer == null ? 0 : 18 }]}>
    {model.summaryScreen === 'loading' ? <View style={styles.center}><BaseHost matchContents><WarehouseLoadingIndicator /></BaseHost></View> : model.summaryScreen === 'error' ? <ScrollView style={styles.body} contentContainerStyle={styles.retry}>
      <BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(Math.max(viewportWidth * .88, 280), 360), maxWidth: '100%' }}><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
        <TextButton onClick={() => { void model.reload(); }} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }}
          modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 }), testID('warehouse-retry')]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text></TextButton>
      </Column></BaseHost>
    </ScrollView> : <>
      {tabs.length ? <Tabs id="warehouse-main-tab" options={tabs} selected={model.state.pageTab} select={value => { if (value === 'products' || value === 'settings') model.setPageTab(value); }} /> : null}
      {model.scope === 'werka' ? <Products model={model} bottomPadding={bottomPadding} /> : <PagerView ref={pager} style={styles.body} initialPage={0} offscreenPageLimit={1} scrollEnabled={model.focused && !model.dialog}
        onPageSelected={event => { if (event.nativeEvent.position === 0 || event.nativeEvent.position === 1) model.setPageTab(event.nativeEvent.position === 0 ? 'products' : 'settings'); }}>
        <View key="products" style={styles.body}><Products model={model} bottomPadding={bottomPadding} /></View>
        <View key="settings" style={styles.body}>{model.scope === 'material' ? model.materialStates : <AdminWarehouseSettingsTab {...model.settings} bottomPadding={bottomPadding} />}</View>
      </PagerView>}
    </>}
    </View>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    {model.scope === 'admin' ? <AdminCreateMenu actions={model.actions} isCurrent={model.interactive} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={model.a('action.close')} visible={model.focused && !model.dialog} bottomOffset={insets.bottom + 94} /> : null}
    {model.dialog?.kind === 'create' ? <AdminWarehouseCreateDialog key={model.dialog.id} session={props.session} witness={props.witness} isCurrent={model.dialogCurrent} onSaved={model.created} onClose={model.closeDialog} /> : null}
    {model.dialog?.kind === 'details' ? <Details key={model.dialog.id} model={model} /> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, contentFrame: { flex: 1, marginHorizontal: 6, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' }, fullWidth: { width: '100%' }, header: { height: 63, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 3 },
  headerSlot: { height: 60, overflow: 'hidden' }, searchField: { flex: 1, minWidth: 0, height: 58, transform: [{ translateY: -1 }] }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
