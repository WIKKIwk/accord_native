import { Button, DisclosureGroup, Grid, HStack, Image, List, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, lineLimit, listRowInsets, listRowSeparator, listStyle, multilineTextAlignment, onLongPressGesture, opacity, padding, refreshable, scrollContentBackground, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { SupplierItem } from '../shared/catalogApi';
import { adminItemCreateFilterGroups, adminItemCreateRow } from './adminItemCreateModel';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Notice({ model, message, retry = false }: { model: AdminItemCreateScreenModel; message: string; retry?: boolean }) {
  const { colors } = useBaseTheme();
  return <VStack spacing={10} modifiers={[frame({ maxWidth: Infinity }), padding({ all: 16 }), background(colors.surface), cornerRadius(8)]}>
    <Text modifiers={[font({ textStyle: 'body' }), multilineTextAlignment('center')]}>{message}</Text>{retry ? <Button label={model.a('item.retry')} onPress={model.reload} modifiers={[buttonStyle('bordered'), frame({ minHeight: 56 }), accessibilityIdentifier('admin-item-list-retry')]} /> : null}
  </VStack>;
}
function Groups({ model }: { model: AdminItemCreateScreenModel }) {
  const { form, list } = model.state, values = ['', ...adminItemCreateFilterGroups(form.groups.value, list.group)], pairs = Array.from({ length: Math.ceil(values.length / 2) }, (_, index) => values.slice(index * 2, index * 2 + 2));
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>{form.groups.loading ? <ProgressView /> : form.groups.error !== null ? <VStack modifiers={[padding({ all: 8 })]}><Notice model={model} message={model.a('item.groups_load_failed')} /></VStack> : <DisclosureGroup label={`${model.a('item.group_label')}: ${list.group || model.a('item.all_groups')}`} isExpanded={list.groupExpanded} onIsExpandedChange={model.toggleGroup}
    modifiers={[padding({ all: 8 }), accessibilityIdentifier('admin-items-group-filter')]}>
    <Grid alignment="leading" horizontalSpacing={8} verticalSpacing={8} modifiers={[frame({ maxWidth: Infinity }), padding({ top: 8 })]}>{pairs.map((pair, index) => <Grid.Row key={index}>{pair.map(group => <Button key={group} label={group || model.a('item.all_groups')} systemImage={group === list.group ? 'checkmark' : undefined} onPress={() => model.group(group)} modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity }), accessibilityIdentifier(group === '' ? 'admin-items-group-filter-all' : `admin-items-group-option-${group}`)]} />)}</Grid.Row>)}</Grid>
  </DisclosureGroup>}</BaseHost>;
}
function ItemRow({ model, item, index }: { model: AdminItemCreateScreenModel; item: SupplierItem; index: number }) {
  const { colors } = useBaseTheme(), state = model.state.list, row = adminItemCreateRow(item), selected = state.selectedCodes.includes(item.code), selectionMode = state.selectedCodes.length > 0;
  const canSelect = model.owner.canSelect && !state.moving, canOpen = selectionMode && model.owner.canSelect || model.owner.needsItemDetail;
  const badge = <Image systemName={selected ? 'checkmark' : 'shippingbox'} size={16} modifiers={[frame({ width: 30, height: 30 }), background(selected ? colors.primary : colors.secondaryContainer), cornerRadius(8), foregroundStyle(selected ? colors.onPrimary : colors.onSecondaryContainer)]} />;
  const labels = <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{row.title}</Text>{row.subtitle ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{row.subtitle}</Text> : null}</VStack>;
  const chevron = canOpen && !selectionMode ? <Image systemName="chevron.right" size={18} modifiers={[foregroundStyle('secondary')]} /> : null;
  const longPress = canSelect ? [onLongPressGesture(() => model.toggleItem(item))] : [];
  const backgroundModifiers = [background(selected ? colors.secondaryContainer : colors.surfaceContainerLowest), cornerRadius(16)];
  const body = <HStack spacing={16} modifiers={[padding({ top: 8, trailing: 10, bottom: 8 }), frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' })]}>{labels}{chevron}</HStack>;
  const full = <HStack spacing={14} modifiers={[padding({ leading: 14, top: 8, trailing: 10, bottom: 8 }), frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' }), ...backgroundModifiers]}>{badge}{labels}{chevron}</HStack>;
  return <VStack modifiers={[listRowInsets({ top: 0, leading: 4, bottom: 2, trailing: 4 }), listRowSeparator('hidden'), accessibilityIdentifier(`admin-item-row-${index}`)]}>
    {canSelect ? <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), ...backgroundModifiers]}>
      <Button onPress={() => model.toggleItem(item)} modifiers={[buttonStyle('plain'), frame({ width: 58, height: 61 }), accessibilityLabel(row.title), accessibilityIdentifier(`admin-item-select-${item.code}`), ...longPress]}>{badge}</Button>
      {canOpen ? <Button onPress={() => model.openItem(item)} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier(`admin-item-open-${index}`), ...longPress]}>{body}</Button> : <VStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), ...longPress]}>{body}</VStack>}
    </HStack> : canOpen ? <Button onPress={() => model.openItem(item)} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier(`admin-item-open-${index}`)]}>{full}</Button> : full}
  </VStack>;
}
function Footer({ model }: { model: AdminItemCreateScreenModel }) {
  const state = model.state.list;
  return <VStack modifiers={[padding({ all: state.loadingMore ? 14 : 12 }), listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }), listRowSeparator('hidden')]}>
    {state.loadingMore ? <ProgressView /> : state.error !== null ? <Button label={model.a('item.load_more')} systemImage="arrow.clockwise" onPress={model.reload} modifiers={[buttonStyle('bordered'), frame({ minHeight: 56 }), accessibilityIdentifier('admin-item-list-load-more')]} /> : <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{model.a('item.scroll_load_more')}</Text>}
  </VStack>;
}
/** @v2 AdminItemsListTab */
export function AdminItemCreateList({ model, bottomPadding }: { model: AdminItemCreateScreenModel; bottomPadding: number | null }) {
  const { height: viewport } = useWindowDimensions(), state = model.state.list, ready = bottomPadding !== null, nativeGeometry = Number(Platform.Version) >= 18;
  const legacy = useRef<FlatList<SupplierItem>>(null), { current, owner } = model;
  useEffect(() => { if (!nativeGeometry && current()) legacy.current?.scrollToOffset({ offset: 0, animated: false }); }, [nativeGeometry, current, owner, state.scrollReset]);
  const geometry = useScrollGeometryChange(value => model.scroll(value.contentHeight - value.contentOffsetY - value.containerHeight));
  const refresh = async () => { if (model.interactive()) await model.owner.controller.list.reload(); };
  const rowModifiers = [listRowInsets({ top: 4, leading: 4, bottom: 0, trailing: 4 }), listRowSeparator('hidden')];
  const footerVisible = state.items.length > 0 && (state.loadingMore || state.error !== null || state.hasMore);
  const empty = <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>{state.initialLoading ? <VStack modifiers={[frame({ maxWidth: Infinity }), frame({ height: viewport * .48 })]}><ProgressView /></VStack> : <Notice model={model} message={model.a(state.error !== null ? 'item.loading_failed' : 'item.empty')} retry={state.error !== null} />}</BaseHost>;
  return <View style={[styles.content, { opacity: ready ? 1 : 0 }]} pointerEvents={ready ? 'auto' : 'none'} accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'} accessibilityState={{ busy: !ready }} testID="admin-item-create-list-layout">
    <Groups model={model} />{state.selectedCodes.length ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><HStack modifiers={[padding({ leading: 12, trailing: 4 })]}><Text modifiers={[font({ textStyle: 'headline' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('bulk_move.selected_count', { count: state.selectedCodes.length })}</Text><Button onPress={model.clearSelection} modifiers={[buttonStyle('plain'), disabled(state.moving), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('bulk_move.clear_selection')), accessibilityIdentifier('admin-items-clear-selection')]}><Image systemName="xmark" size={20} /></Button></HStack></BaseHost> : null}
    {nativeGeometry ? <BaseHost style={styles.content}><List key={state.scrollReset} modifiers={[listStyle('plain'), scrollContentBackground('hidden'), opacity(ready ? 1 : 0), disabled(!ready), accessibilityHidden(!ready), refreshable(refresh), ...(geometry ? [geometry] : [])]}>
      {!state.items.length ? <VStack modifiers={rowModifiers}>{state.initialLoading ? <VStack modifiers={[frame({ maxWidth: Infinity }), frame({ height: viewport * .48 })]}><ProgressView /></VStack> : <Notice model={model} message={model.a(state.error !== null ? 'item.loading_failed' : 'item.empty')} retry={state.error !== null} />}</VStack> : null}
      <List.ForEach data={state.items.map((item, index) => ({ item, index }))} keyExtractor={value => `${value.index}:${value.item.code}`} estimatedItemSize={63}>{({ item: value }) => <ItemRow model={model} item={value.item} index={value.index} />}</List.ForEach>
      {footerVisible ? <Footer model={model} /> : null}
      <Spacer modifiers={[frame({ height: bottomPadding ?? undefined }), listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }), listRowSeparator('hidden')]} />
    </List></BaseHost> : <FlatList ref={legacy} data={state.items} keyExtractor={(item, index) => `${index}:${item.code}`} renderItem={({ item, index }) => <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><ItemRow model={model} item={item} index={index} /></BaseHost>}
      contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: bottomPadding ?? undefined }} ItemSeparatorComponent={() => <View style={styles.gap} />} ListEmptyComponent={empty} ListFooterComponent={footerVisible ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Footer model={model} /></BaseHost> : undefined} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={model.reload} tintColor="transparent" />} onScroll={event => { const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent; model.scroll(contentSize.height - contentOffset.y - layoutMeasurement.height); }} scrollEventThrottle={16} testID="admin-item-create-legacy-list" />}
  </View>;
}
const styles = StyleSheet.create({ content: { flex: 1 }, fullWidth: { width: '100%' }, gap: { height: 2 } });
