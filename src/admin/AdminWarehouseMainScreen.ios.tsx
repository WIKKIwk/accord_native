import { BottomSheet, Button, DisclosureGroup, Grid, Group, HStack, Image, List, Picker, ProgressView, RNHostView, ScrollView as SwiftScrollView, Spacer, TabView, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, hidden, lineLimit, listRowBackground, listRowInsets, listRowSeparator, listStyle, multilineTextAlignment, onAppear, padding, pickerStyle, presentationDetents, presentationDragIndicator, scrollContentBackground, scrollDisabled, tabViewStyle, tag, useScrollGeometryChange, zIndex } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, PlatformColor, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { localizedGetter } from '../shared/localization';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { AdminCreateMenu } from './AdminCreateMenu.ios';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminWarehouseCreateDialog } from './AdminWarehouseCreateDialog.ios';
import { adminWarehouseMainEntries, type AdminWarehouseMainEntry } from './AdminWarehouseMainEntries';
import { adminWarehouseMainDetailValue, type AdminWarehouseMainRow } from './AdminWarehouseMainRows';
import type { AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';
import { AdminWarehouseSettingsTab } from './AdminWarehouseSettingsTab.ios';
import { useAdminWarehouseMain, type AdminWarehouseMainModel } from './useAdminWarehouseMain';

function WarehouseFilter({ model }: { model: AdminWarehouseMainModel }) {
  const names = model.filterNames, pairs = Array.from({ length: Math.ceil(names.length / 2) }, (_, index) => names.slice(index * 2, index * 2 + 2));
  return <DisclosureGroup label={`${model.a('label.warehouse')}: ${names.find(name => name === model.state.warehouse) ?? model.a('warehouse.unselected')}`} isExpanded={model.state.filterExpanded} onIsExpandedChange={model.toggleFilter}
    modifiers={[padding({ horizontal: 8, vertical: 8 }), accessibilityIdentifier('warehouse-filter')]}>
    <Grid alignment="leading" horizontalSpacing={8} verticalSpacing={8} modifiers={[padding({ top: 8 }), frame({ maxWidth: Infinity })]}>
      {pairs.map((pair, index) => <Grid.Row key={index}>{pair.map((name, position) => <Button key={`${position}:${name}`} label={name} systemImage={name === model.state.warehouse ? 'checkmark' : undefined}
        onPress={() => model.selectWarehouse(name)} modifiers={[buttonStyle(name === model.state.warehouse ? 'borderedProminent' : 'bordered'), frame({ maxWidth: Infinity }), accessibilityIdentifier(`warehouse-filter-option-${index * 2 + position}`)]} />)}</Grid.Row>)}
    </Grid>
  </DisclosureGroup>;
}
function StockTabs({ model }: { model: AdminWarehouseMainModel }) {
  return <Picker label="" selection={model.state.stockTab} onSelectionChange={value => { if (value === 'available' || value === 'reserved') model.setStockTab(value); }} modifiers={[pickerStyle('segmented'), accessibilityIdentifier('warehouse-stock-tabs')]}>
    <Text modifiers={[tag('available')]}>{model.a('warehouse.available', { count: model.products.availableCount })}</Text>
    {model.products.hasReserved ? <Text modifiers={[tag('reserved')]}>{model.a('warehouse.reserved', { count: model.products.reservedCount })}</Text> : null}
  </Picker>;
}
function SummaryRow({ row, model }: { row: AdminWarehouseMainRow; model: AdminWarehouseMainModel }) {
  const { colors } = useBaseTheme(), icon = row.icon === 'item' ? 'shippingbox' : row.icon === 'qolip' ? 'square.grid.2x2' : row.icon === 'reservation' ? 'lock' : 'square.stack.3d.up';
  return <Button onPress={() => model.openRow(row)} modifiers={[buttonStyle('plain'), accessibilityIdentifier(`warehouse-row-${row.id}`)]}>
    <HStack spacing={14} modifiers={[frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' }), padding({ leading: 14, trailing: 10, vertical: 8 })]}>
      <Image systemName={icon} size={16} modifiers={[frame({ width: 30, height: 30 }), background(colors.secondaryContainer), cornerRadius(8), foregroundStyle(colors.onSecondaryContainer)]} />
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{row.title}</Text>
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{row.subtitle}</Text>
      </VStack><Image systemName="chevron.right" size={14} modifiers={[foregroundStyle('secondary')]} />
    </HStack>
  </Button>;
}
function Entry({ entry, model, last, active }: { entry: AdminWarehouseMainEntry; model: AdminWarehouseMainModel; last: boolean; active: boolean }) {
  return <VStack alignment={entry.kind === 'row' ? 'leading' : 'center'} spacing={0} modifiers={[frame({ maxWidth: Infinity }), padding({ top: entry.gap }), listRowSeparator('hidden'), listRowInsets({ leading: 4, trailing: 4, top: 0, bottom: 0 }),
    ...(last && Number(Platform.Version) < 18 ? [onAppear(() => { if (active && !model.state.itemsError) void model.loadMore(); })] : [])]}>
    {entry.kind === 'row' ? <SummaryRow row={entry.row} model={model} /> : entry.kind === 'loading' ? <ProgressView /> : entry.kind === 'retry' ? <Button label={model.a(entry.more ? 'action.load_more' : 'action.retry')} systemImage="arrow.clockwise"
      onPress={() => { void (entry.more ? model.loadMore() : model.retryItems()); }} modifiers={[buttonStyle('bordered'), accessibilityIdentifier(entry.more ? 'warehouse-load-more' : 'warehouse-retry-items')]} /> :
      <Text modifiers={[font({ textStyle: entry.kind === 'hint' ? 'caption' : 'body' }), multilineTextAlignment('center'), ...(entry.kind === 'hint' ? [foregroundStyle('secondary'), padding({ horizontal: 12, bottom: 12 })] : [])]}>{model.a(entry.textKey)}</Text>}
  </VStack>;
}
function ProductList({ model, bottomPadding, tab }: { model: AdminWarehouseMainModel; bottomPadding: number; tab: 'available' | 'reserved' }) {
  const { state } = model, active = state.stockTab === tab, entries = useMemo(() => adminWarehouseMainEntries({ ...state, stockTab: tab }, model.products.qolip, model.availableGroups, model.reservedGroups), [state, tab, model.products.qolip, model.availableGroups, model.reservedGroups]);
  const geometry = useScrollGeometryChange(value => { if (active && tab === 'available' && value.contentHeight - value.contentOffsetY - value.containerHeight <= 420) void model.loadMore(); });
  return <List key={tab === 'available' ? state.scrollReset : `${state.warehouse}:${model.products.hasReserved}`} modifiers={[listStyle('plain'), scrollContentBackground('hidden'), hidden(!active), zIndex(active ? 1 : 0), disabled(!active), scrollDisabled(!active), accessibilityHidden(!active), ...(geometry ? [geometry] : [])]}>
    {state.summary.sections.length && state.warehouse ? <VStack modifiers={[listRowSeparator('hidden'), listRowInsets({ leading: 4, trailing: 4, top: 4, bottom: 0 })]}><StockTabs model={model} /></VStack> : null}
    <VStack modifiers={[listRowSeparator('hidden'), listRowInsets({ leading: 4, trailing: 4, top: 0, bottom: 0 })]}><WarehouseFilter model={model} /></VStack>
    <List.ForEach data={entries} keyExtractor={entry => entry.key} estimatedItemSize={63}>{({ item: entry }) => <Entry entry={entry} model={model} active={active && tab === 'available'} last={entry.key === entries[entries.length - 1]?.key} />}</List.ForEach>
    <Spacer modifiers={[frame({ height: bottomPadding }), listRowSeparator('hidden'), listRowBackground('transparent')]} />
  </List>;
}
function Products({ model, bottomPadding }: { model: AdminWarehouseMainModel; bottomPadding: number }) {
  return <ZStack><ProductList model={model} bottomPadding={bottomPadding} tab="available" />
    <ProductList model={model} bottomPadding={bottomPadding} tab="reserved" />
  </ZStack>;
}
function Details({ model, renderActionSurface }: { model: AdminWarehouseMainModel; renderActionSurface?: AdminWarehouseMainScreenProps['renderDetailActionSurface'] }) {
  const dialog = model.dialog, [presented, setPresented] = useState(true);
  if (dialog?.kind !== 'details') return null; const { row } = dialog;
  return <BaseHost style={{ position: 'absolute', width: '100%' }}><BottomSheet isPresented={presented} onIsPresentedChange={value => { if (!value) { model.beginDismissDialog(); setPresented(false); } }} onDismiss={model.closeDialog}>
    <Group modifiers={[presentationDetents([{ fraction: .72 }]), presentationDragIndicator('visible')]}><SwiftScrollView>
      <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 20, top: 4, bottom: 24 })]}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), padding({ bottom: 16 })]}>{row.title}</Text>
        {model.detailOrder ? <RNHostView matchContents={{ vertical: true }}><View>{model.detailOrder}</View></RNHostView> : null}
        {row.details.map((line, index) => <HStack key={index} alignment="top" spacing={0} modifiers={[padding({ bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), frame({ width: 72, alignment: 'leading' })]}>{line.label}</Text>
          <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{adminWarehouseMainDetailValue(line.value)}</Text>
        </HStack>)}
        {'canQr' in row && row.canQr || row.kind === 'raw' && row.canEdit ? <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' }), padding({ top: 8 })]}>
          <Spacer />{'canQr' in row && row.canQr ? <Button onPress={() => model.runDetailAction(dialog.id, 'qr')} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.a('warehouse.qr_view')), accessibilityIdentifier('warehouse-details-qr')]}><Image systemName="qrcode" /></Button> : null}
          {row.kind === 'raw' && row.canEdit ? <Button onPress={() => model.runDetailAction(dialog.id, 'edit')} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.a('action.edit')), accessibilityIdentifier('warehouse-details-edit')]}><Image systemName="pencil" /></Button> : null}
        </HStack> : null}
      </VStack>
    </SwiftScrollView>{renderActionSurface?.()}</Group>
  </BottomSheet></BaseHost>;
}
/** @v2 AdminWarehousesScreen */
export function AdminWarehouseMainScreen(props: AdminWarehouseMainScreenProps) {
  const model = useAdminWarehouseMain(props), search = useRef<SearchBarCommands>(null), cancelled = useRef<{ current: () => boolean; text: string } | null>(null), lastTyped = useRef<{ current: () => boolean; text: string } | null>(null), insets = useSafeAreaInsets(), { colors } = useBaseTheme();
  const { presentation } = model, fillVersion = presentation.fillVersion, fillText = presentation.fillText, accountCurrent = model.current;
  useEffect(() => { if (accountCurrent()) { cancelled.current = null; lastTyped.current = null; search.current?.setText(fillText); } }, [fillVersion, fillText, accountCurrent]);
  useEffect(() => { if (!presentation.searchFocused) search.current?.blur(); }, [presentation.searchFocused]);
  const cancelSearch = () => {
    if (!model.interactive()) return;
    const typed = lastTyped.current, text = typed?.current() ? typed.text : model.state.search;
    cancelled.current = { current: model.interactive, text }; model.closeSearch(); search.current?.setText(text);
  };
  const changeSearch = (text: string) => {
    const ticket = cancelled.current; cancelled.current = null;
    // UIKit sends an empty text event after Cancel. V2's focus-close retains its query.
    if (ticket && text === '') { if (ticket.current()) search.current?.setText(ticket.text); return; }
    if (model.interactive()) lastTyped.current = { current: model.interactive, text }; model.setSearch(text);
  };
  if (!model.valid) return null;
  const bottomPadding = insets.bottom + model.bottomPaddingOffset, tabs = model.scope === 'werka' ? [] : [
    { value: 'products', label: model.scope === 'material' ? model.a('warehouse.tabs_warehouses') : 'Mahsulotlar' }, { value: 'settings', label: model.scope === 'material' ? model.a('warehouse.tabs_states') : 'Sozlamalar' }];
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh }]}>
    <Stack.Screen options={{ headerShown: true, title: '', headerLargeTitle: false, headerShadowVisible: false, headerBackVisible: false,
      headerLeft: presentation.searchFocused ? undefined : () => <RoleHeaderButton icon="back" label={props.backLabel} onPress={model.back} tintColor={PlatformColor('label')} />,
      headerRight: presentation.searchFocused ? undefined : model.profile,
      headerSearchBarOptions: { ref: search, placeholder: model.searchHint, hideWhenScrolling: false, hideNavigationBar: false, obscureBackground: false, autoCapitalize: 'none', cancelButtonText: model.a('action.close'),
        onChangeText: event => changeSearch(event.nativeEvent.text), onFocus: () => model.setSearchFocused(true), onBlur: () => model.setSearchFocused(false), onCancelButtonPress: cancelSearch, onSearchButtonPress: model.closeSearch } }} />
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-warehouse-main-body-frame">
    {model.summaryScreen !== 'content' ? <View style={model.summaryScreen === 'loading' ? styles.center : styles.retry}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
      <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity })]}>{model.summaryScreen === 'loading' ? <ProgressView /> : <><Text modifiers={[font({ textStyle: 'body' }), foregroundStyle('secondary'), multilineTextAlignment('center')]}>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={() => { void model.reload(); }} modifiers={[accessibilityIdentifier('warehouse-retry')]} /></>}</VStack>
    </BaseHost></View> : <>
      {tabs.length ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Picker label="" selection={model.state.pageTab} onSelectionChange={value => { if (value === 'products' || value === 'settings') model.setPageTab(value); }} modifiers={[pickerStyle('segmented'), padding({ horizontal: 12, bottom: 4 }), accessibilityIdentifier('warehouse-main-tabs')]}>
        {tabs.map(tab => <Text key={tab.value} modifiers={[tag(tab.value)]}>{tab.label}</Text>)}
      </Picker></BaseHost> : null}
      <BaseHost style={styles.body}>{model.scope === 'werka' ? <Products model={model} bottomPadding={bottomPadding} /> : <TabView selection={model.state.pageTab} onSelectionChange={value => { if (value === 'products' || value === 'settings') model.setPageTab(value); }}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), tabViewStyle({ type: 'page', indexDisplayMode: 'never' }), disabled(!model.focused || !!model.dialog)]}>
        <TabView.Tab value="products"><Products model={model} bottomPadding={bottomPadding} /></TabView.Tab>
        <TabView.Tab value="settings"><RNHostView><View style={styles.body}>{model.scope === 'material' ? model.materialStates : <AdminWarehouseSettingsTab {...model.settings} bottomPadding={bottomPadding} />}</View></RNHostView></TabView.Tab>
      </TabView>}</BaseHost>
    </>}
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    {model.scope === 'admin' ? <AdminCreateMenu actions={model.actions} isCurrent={model.interactive} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={model.a('action.close')} visible={model.focused && !model.dialog} bottomOffset={insets.bottom + 94} /> : null}
    {model.dialog?.kind === 'create' ? <AdminWarehouseCreateDialog key={model.dialog.id} session={props.session} witness={props.witness} isCurrent={model.dialogCurrent} onSaved={model.created} onClose={model.closeDialog} /> : null}
    {model.dialog?.kind === 'details' ? <Details key={model.dialog.id} model={model} renderActionSurface={props.renderDetailActionSurface} /> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, retry: { flex: 1, paddingHorizontal: 24, paddingVertical: 40 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
