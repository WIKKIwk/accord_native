import { Box, Column, FilterChip, FlowRow, IconButton, LinearProgressIndicator, OutlinedButton, Row, Shape, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { themeController } from '../shared/themeRuntime';
import type { SupplierItem } from '../shared/catalogApi';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminText as Text } from './AdminTypography.android';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import { adminItemCreateFilterGroups, adminItemCreateRow } from './adminItemCreateModel';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Notice({ model, message, retry = false }: { model: AdminItemCreateScreenModel; message: string; retry?: boolean }) {
  const { colors } = useBaseTheme();
  return <Surface color={colors.surface} border={{ width: 1, color: colors.outlineVariant }} shape={itemCreateRounded(8)} modifiers={[fillMaxWidth()]}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>
    <Text style={{ typography: 'bodyMedium', textAlign: 'center' }}>{message}</Text>{retry ? <><Spacer modifiers={[height(10)]} /><OutlinedButton onClick={model.reload} colors={{ contentColor: colors.onSurface }} shape={itemCreateRounded(20)} modifiers={[height(56), testID('admin-item-list-retry')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('item.retry')}</Text></OutlinedButton></> : null}
  </Column></Surface>;
}
function Groups({ model }: { model: AdminItemCreateScreenModel }) {
  const { colors } = useBaseTheme(), { form, list } = model.state, chosen = list.group || model.a('item.all_groups'), groups = adminItemCreateFilterGroups(form.groups.value, list.group);
  const chipColors = { containerColor: colors.surfaceContainerLowest, labelColor: colors.onSurface, selectedContainerColor: colors.secondaryContainer, selectedLabelColor: colors.onSecondaryContainer };
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>{form.groups.loading ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : form.groups.error !== null ? <Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}><Notice model={model} message={model.a('item.groups_load_failed')} /></Column> : <Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}>
    <FilterChip selected={!!list.group} onClick={model.toggleGroup} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }} modifiers={[testID('admin-items-group-filter')]}>
      <FilterChip.LeadingIcon><ItemCreateIcon name="inventory_2" color={list.group ? colors.onSecondaryContainer : colors.onSurfaceVariant} size={18} /></FilterChip.LeadingIcon>
      <FilterChip.Label><Text style={{ typography: 'labelLarge', fontWeight: '500' }}>{`${model.a('item.group_label')}: ${chosen}`}</Text></FilterChip.Label>
      <FilterChip.TrailingIcon><ItemCreateIcon name={list.groupExpanded ? 'expand_less' : 'expand_more'} color={list.group ? colors.onSecondaryContainer : colors.onSurfaceVariant} size={18} /></FilterChip.TrailingIcon>
    </FilterChip>
    {list.groupExpanded ? <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
      {['', ...groups].map((group, index) => <FilterChip key={`${group}:${index}`} selected={group === list.group} onClick={() => model.group(group)} colors={chipColors} elevation={2} border={{ width: 0, color: 'transparent' }} modifiers={[testID(index === 0 ? 'admin-items-group-filter-all' : `admin-items-group-option-${group}`)]}>
        {group === list.group ? <FilterChip.LeadingIcon><ItemCreateIcon name="check" color={colors.onSecondaryContainer} size={18} /></FilterChip.LeadingIcon> : null}
        <FilterChip.Label><Text style={{ typography: 'labelLarge', fontWeight: '500' }}>{group || model.a('item.all_groups')}</Text></FilterChip.Label>
      </FilterChip>)}
    </FlowRow> : null}
  </Column>}</BaseHost>;
}
function ItemRow({ model, item, index }: { model: AdminItemCreateScreenModel; item: SupplierItem; index: number }) {
  const { colors } = useBaseTheme(), list = model.state.list, selected = list.selectedCodes.includes(item.code), selectionMode = list.selectedCodes.length > 0, row = adminItemCreateRow(item);
  const canSelect = model.owner.canSelect && !list.moving, canOpen = selectionMode && model.owner.canSelect || model.owner.needsItemDetail;
  const radius = Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6,
    bottomStart: index > 0 && index === list.items.length - 1 ? 18 : 6, bottomEnd: index > 0 && index === list.items.length - 1 ? 18 : 6 } });
  return <BaseHost style={styles.row}><Surface color={selected ? colors.secondaryContainer : colors.surfaceContainerLowest} shape={radius} shadowElevation={themeController.variant === 'white' ? 1 : 0}
    modifiers={[fillMaxWidth(), height(61), testID(`admin-item-row-${index}`), ...(canOpen || canSelect ? [combinedClickable({ onClick: canOpen ? () => model.openItem(item) : undefined, onLongClick: canSelect ? () => model.toggleItem(item) : undefined })] : [])]}>
    <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(14, 8, 10, 8)]}>
      <Surface onClick={canSelect ? () => model.toggleItem(item) : undefined} selected={selected} color={selected ? colors.primary : colors.secondaryContainer} shape={itemCreateRounded(8)} modifiers={[size(30, 30), semantics({ contentDescription: row.title }), testID(`admin-item-select-${item.code}`)]}>
        <Box contentAlignment="center" modifiers={[fillMaxSize()]}><ItemCreateIcon name={selected ? 'check' : 'inventory_2'} color={selected ? colors.onPrimary : colors.onSecondaryContainer} size={16} /></Box>
      </Surface><Spacer modifiers={[size(14, 1)]} /><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurface} style={{ typography: 'titleMedium', fontWeight: '700' }}>{row.title}</Text>{row.subtitle ? <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 12.6 }}>{row.subtitle}</Text> : null}
      </Column>{canOpen && !selectionMode ? <><Spacer modifiers={[size(16, 1)]} /><ItemCreateIcon name="chevron_right" color={colors.onSurfaceVariant} size={22} /></> : null}
    </Row>
  </Surface></BaseHost>;
}
/** @v2 AdminItemsListTab */
export function AdminItemCreateList({ model, bottomPadding }: { model: AdminItemCreateScreenModel; bottomPadding: number | null }) {
  const { colors } = useBaseTheme(), { height: viewport } = useWindowDimensions(), list = useRef<FlatList<SupplierItem>>(null), state = model.state.list, ready = bottomPadding !== null;
  const { current, owner } = model;
  useEffect(() => { if (current()) list.current?.scrollToOffset({ offset: 0, animated: false }); }, [state.scrollReset, owner, current]);
  const empty = state.initialLoading ? <View style={{ height: viewport * .48, alignItems: 'center', justifyContent: 'center' }}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> : <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Notice model={model} message={model.a(state.error !== null ? 'item.loading_failed' : 'item.empty')} retry={state.error !== null} /></BaseHost>;
  const footer = state.items.length && (state.loadingMore || state.error !== null || state.hasMore) ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column horizontalAlignment="center" modifiers={[fillMaxWidth(), padding(state.loadingMore ? 14 : 12, state.loadingMore ? 14 : 12, state.loadingMore ? 14 : 12, state.loadingMore ? 14 : 12)]}>
    {state.loadingMore ? <AdminLoadingIndicator size={48} glyphSize={28} /> : state.error !== null ? <OutlinedButton onClick={model.reload} colors={{ contentColor: colors.onSurface }} shape={itemCreateRounded(20)} modifiers={[height(56), testID('admin-item-list-load-more')]}><Row verticalAlignment="center"><ItemCreateIcon name="refresh" color={colors.onSurface} /><Spacer modifiers={[size(8, 1)]} /><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('item.load_more')}</Text></Row></OutlinedButton> : state.hasMore ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.a('item.scroll_load_more')}</Text> : null}
  </Column></BaseHost> : undefined;
  return <View style={[styles.content, { opacity: ready ? 1 : 0 }]} pointerEvents={ready ? 'auto' : 'none'} accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'} accessibilityState={{ busy: !ready }} testID="admin-item-create-list-layout">
    <Groups model={model} />{state.selectedCodes.length ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(12, 0, 4, 0)]}><Text style={{ typography: 'labelLarge' }} modifiers={[weight(1)]}>{model.a('bulk_move.selected_count', { count: state.selectedCodes.length })}</Text>
      <IconButton enabled={!state.moving} onClick={model.clearSelection} modifiers={[semantics({ contentDescription: model.a('bulk_move.clear_selection') }), testID('admin-items-clear-selection')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton></Row></BaseHost> : null}
    <FlatList ref={list} data={state.items} keyExtractor={(item, index) => `${index}:${item.code}`} renderItem={({ item, index }) => <ItemRow model={model} item={item} index={index} />} ItemSeparatorComponent={() => <View style={styles.gap} />}
      contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: bottomPadding ?? undefined }} ListEmptyComponent={empty} ListFooterComponent={footer} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={model.reload} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}
      onScroll={event => { const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent; model.scroll(contentSize.height - contentOffset.y - layoutMeasurement.height); }} scrollEventThrottle={16} />
  </View>;
}
const styles = StyleSheet.create({ content: { flex: 1 }, fullWidth: { width: '100%' }, row: { width: '100%', height: 61 }, gap: { height: 2 } });
