import { BasicAlertDialog, CircularProgressIndicator, FilterChip, Host, LinearProgressIndicator, RNHostView, Row, Shape, SnackbarHost, Surface, Text as ComposeText, TextButton, useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import PagerView, { type PagerViewRef } from '@expo/ui/community/pager-view';
import { useEffect, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localizedGetter } from '../shared/localization';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { AdminCreateMenu } from './AdminCreateMenu.android';
import { ItemGroupsDialogContent } from './ItemGroupsDialogContent';
import { ItemGroupsPickerSheet } from './ItemGroupsPickerSheet.android';
import type { ItemGroupsTreeNode } from './itemGroupsModel';
import { useItemGroupsRoute, type ItemGroupsRouteModel, type ItemGroupsRouteProps } from './useItemGroupsRoute';

const withAlpha = (color: string, alpha: number) => `${color.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
function Loading() { return <Host matchContents><CircularProgressIndicator /></Host>; }
function TreeRow({ node, model, depth = 0 }: { node: ItemGroupsTreeNode; model: ItemGroupsRouteModel; depth?: number }) {
  const colors = useMaterialColors(), { state, controller, t } = model, children = node.children.length > 0, expanded = state.expanded.has(node.entry.name);
  return <View style={[styles.node, { borderColor: depth ? withAlpha(colors.outlineVariant, 0.55) : colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="center"
      modifiers={[fillMaxWidth(), ...(children ? [combinedClickable({ onClick: () => controller.toggle(node.entry.name) })] : []), padding(4, 4, 4, 4)]}>
      <RNHostView matchContents><View style={[styles.nodeIcon, { backgroundColor: children ? colors.primaryContainer : colors.surfaceContainerHighest }]}>
        <SymbolView name={{ android: children ? 'folder' : 'label' }} size={20} tintColor={children ? colors.onPrimaryContainer : colors.onSurfaceVariant} /></View></RNHostView>
      <ComposeText maxLines={1} overflow="ellipsis" style={{ fontSize: 16, fontWeight: '800' }} modifiers={[weight(1), padding(10, 0, 0, 0)]}>{node.entry.item_group_name || node.entry.name}</ComposeText>
      <TextButton onClick={() => controller.selectGroup(node.entry.name)}><ComposeText>{t('item_group.show')}</ComposeText></TextButton>
      <RNHostView matchContents><View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: children ? colors.primaryContainer : colors.surfaceContainerHighest }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: children ? colors.onPrimaryContainer : colors.onSurfaceVariant }}>{children ? t('item_group.children_count', { count: node.children.length }) : t('item_group.leaf')}</Text>
      </View></RNHostView>
      {children ? <RNHostView matchContents><View style={{ marginStart: 6 }}><SymbolView name={{ android: expanded ? 'expand_more' : 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></View></RNHostView> : null}
    </Row></Host>
    {children && expanded ? <View style={[styles.children, { borderLeftColor: withAlpha(colors.primary, 0.42) }]}>{node.children.map((child, index) => <View key={child.entry.name} style={index ? { marginTop: 8 } : undefined}><TreeRow node={child} model={model} depth={depth + 1} /></View>)}</View> : null}
  </View>;
}
/** @v2 AdminItemGroupCreateScreen */
export function ItemGroupsRoute(props: ItemGroupsRouteProps) {
  const model = useItemGroupsRoute(props), { state, controller, t, roots, displayGroups, focused, current } = model, colors = useMaterialColors(), insets = useSafeAreaInsets();
  const pager = useRef<PagerViewRef>(null);
  useEffect(() => { if (focused && current()) pager.current?.setPage(state.tab === 'tree' ? 0 : 1); }, [focused, current, state.tab]);
  const snackbar = useRef<SnackbarHostRef>(null), { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  useEffect(() => { if (state.notice && !state.notice.success) void snackbar.current?.showSnackbar({ message: t(state.notice.key, state.notice.values), duration: 'short' }); }, [state.notice, model.locale, t]);
  const actions = useMemo(() => [
    { id: 'item-group-create', label: t('item_group.add'), icon: { ios: 'folder.badge.plus' as const, android: 'create_new_folder' as const }, onPress: () => { void controller.open('create'); } },
    { id: 'item-group-move', label: t('item_group.move_parent'), icon: { ios: 'folder' as const, android: 'drive_file_move' as const }, onPress: () => { void controller.open('move'); } },
  ], [controller, t]);
  if (!state.valid || !model.current()) return null;
  const chipColors = { containerColor: colors.surfaceContainerLowest, labelColor: colors.onSurface, iconColor: colors.onSurfaceVariant,
    selectedContainerColor: colors.secondaryContainer, selectedLabelColor: colors.onSecondaryContainer, selectedLeadingIconColor: colors.onSecondaryContainer, selectedTrailingIconColor: colors.onSecondaryContainer };
  const itemsHeader = <>
    <Text style={{ fontSize: 22, color: colors.onSurface }}>{t('item_group.items_title')}</Text><Text style={[styles.description, { color: colors.onSurfaceVariant, marginTop: 6, marginBottom: 14 }]}>{t('item_group.items_description')}</Text>
    {state.parentsPhase === 'loading' ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><LinearProgressIndicator modifiers={[fillMaxWidth()]} /></Host> : state.parentsPhase === 'error' ?
      <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.load_failed')}</Text> : displayGroups.length ? <>
        <Host matchContents style={{ alignSelf: 'flex-start' }}><FilterChip selected={!!state.selectedGroup} elevation={2} border={{ color: 'transparent' }} colors={chipColors} onClick={() => controller.toggleFilter()}>
          <FilterChip.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'inventory_2' }} size={18} tintColor={state.selectedGroup ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></RNHostView></FilterChip.LeadingIcon>
          <FilterChip.Label><ComposeText style={{ fontSize: 14, fontWeight: '500' }}>{`${t('item_group.group')}: ${state.selectedGroup || t('item_group.not_selected')}`}</ComposeText></FilterChip.Label>
          <FilterChip.TrailingIcon><RNHostView matchContents><SymbolView name={{ android: state.filterExpanded ? 'expand_less' : 'expand_more' }} size={18} tintColor={state.selectedGroup ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></RNHostView></FilterChip.TrailingIcon>
        </FilterChip></Host>
        {state.filterExpanded ? <View style={styles.filters}>{displayGroups.map(group => <Host matchContents key={group}><FilterChip selected={group === state.selectedGroup} elevation={2} border={{ color: 'transparent' }} colors={chipColors} onClick={() => controller.selectGroup(group)}>
          {group === state.selectedGroup ? <FilterChip.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'check' }} size={18} tintColor={colors.onSecondaryContainer} /></RNHostView></FilterChip.LeadingIcon> : null}
          <FilterChip.Label><ComposeText style={{ fontSize: 14, fontWeight: '500' }}>{group}</ComposeText></FilterChip.Label></FilterChip></Host>)}</View> : null}
      </> : <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.not_found')}</Text>}
  </>;
  const selectedItems = !state.selectedGroup ? <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.tree_show_hint')}</Text> : state.itemsLoading ? <View style={styles.loading}><Loading /></View> : state.itemsError && !state.items.length ? <View style={styles.noticeText}>
    <Text style={{ textAlign: 'center', color: colors.onSurface }}>{t('item_group.items_load_failed')}</Text><View style={{ marginTop: 10 }}><WorkerSheetButton variant="outlined" label={t('action.retry')} onPress={() => { void controller.loadItems(true); }} /></View>
  </View> : <View style={[styles.selectedItems, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
    <View style={styles.itemHeader}><SymbolView name={{ android: 'inventory_2' }} size={24} tintColor={colors.primary} /><Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.onSurface }}>{state.selectedGroup}</Text>
      <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}><Text style={{ fontSize: 11, fontWeight: '800', color: colors.onPrimaryContainer }}>{t('item_group.item_count', { count: state.items.length })}</Text></View></View>
    {!state.items.length ? <Text style={{ paddingHorizontal: 12, paddingBottom: 12, color: colors.onSurface }}>{t('item_group.no_items')}</Text> : state.items.map((item, index) => <View key={`${index}:${item.code}`}>
      <View style={styles.item}><View style={[styles.nodeIcon, { backgroundColor: colors.surfaceContainerHighest }]}><SymbolView name={{ android: 'category' }} size={18} tintColor={colors.onSurfaceVariant} /></View>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.itemTitle, { color: colors.onSurface }]}>{item.name.trim() ? item.name : item.code}</Text>
          {item.code.trim() || item.uom.trim() ? <Text numberOfLines={1} style={[styles.description, { color: colors.onSurfaceVariant }]}>{[item.code.trim(), item.uom.trim()].filter(Boolean).join(' • ')}</Text> : null}</View></View>
      {index !== state.items.length - 1 ? <View style={{ height: 1, marginHorizontal: 12, backgroundColor: withAlpha(colors.outlineVariant, 0.6) }} /> : null}
    </View>)}
    {state.loadingMore ? <View style={{ padding: 14, alignItems: 'center' }}><Loading /></View> : state.itemsError ? <View style={{ padding: 12 }}><WorkerSheetButton variant="outlined" label={t('item_group.load_more')} onPress={() => { void controller.loadItems(true); }} /></View> : state.hasMore ? <Text style={[styles.description, { padding: 12, color: colors.onSurfaceVariant }]}>{t('item_group.scroll_hint')}</Text> : null}
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <RoleHeader title={t('item_group.title')} navigation={props.navigation ?? undefined} />
    {props.topNotice}
    {state.notice?.success && !props.showTopNotice ? <View pointerEvents="none" accessibilityRole="alert" style={{ backgroundColor: '#E6F4EA', paddingHorizontal: 16, paddingVertical: 12 }}><Text style={{ color: '#173A24', fontSize: 14 }}>{t(state.notice.key, state.notice.values)}</Text></View> : null}
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceContainer, borderBottomColor: colors.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }}>
      {(['tree', 'items'] as const).map(tab => <View key={tab} style={{ flex: 1, borderBottomWidth: 2, borderBottomColor: state.tab === tab ? colors.primary : 'transparent' }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><TextButton onClick={() => controller.setTab(tab)} modifiers={[fillMaxWidth(), height(38)]}>
          <ComposeText color={state.tab === tab ? colors.primary : colors.onSurfaceVariant} style={{ fontSize: 14, fontWeight: '400' }}>{t(`item_group.${tab}_tab`)}</ComposeText>
        </TextButton></Host>
      </View>)}
    </View>
    <PagerView ref={pager} style={{ flex: 1 }} initialPage={0} offscreenPageLimit={1} scrollEnabled={model.focused && !state.dialog}
      onPageSelected={event => { if (event.nativeEvent.position === 0 || event.nativeEvent.position === 1) controller.setTab(event.nativeEvent.position === 0 ? 'tree' : 'items'); }}>
      <View key="tree" style={{ flex: 1 }}>{state.treePhase === 'loading' ? <View style={styles.center}><Loading /></View> : state.treePhase === 'error' ?
      <View style={styles.center}><Text style={{ color: colors.onSurfaceVariant }}>{t('item_group.tree_load_failed')}</Text></View> :
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 4, paddingBottom: insets.bottom + 116 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void controller.reload(); }} />}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Surface color={colors.surfaceContainerLowest} shadowElevation={4} tonalElevation={0} shape={rounded(18)} modifiers={[fillMaxWidth()]}>
          <RNHostView matchContents><View style={{ padding: 14 }}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>{t('item_group.tree_title')}</Text>
            <Text style={[styles.description, { marginTop: 6, marginBottom: 14, color: colors.onSurface }]}>{t('item_group.tree_description')}</Text>
            {!roots.length ? <Text style={styles.empty}>{t('item_group.tree_empty')}</Text> : roots.map((node, index) => <View key={node.entry.name} style={index ? { marginTop: 10 } : undefined}><TreeRow node={node} model={model} /></View>)}
          </View></RNHostView></Surface></Host>
      </ScrollView>}</View>
      <View key="items" style={{ flex: 1 }}><ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: insets.bottom + 240 }}
        refreshControl={<RefreshControl refreshing={state.itemsLoading} onRefresh={() => { void controller.loadItems(true); }} />}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          if (contentSize.height - contentOffset.y - layoutMeasurement.height <= 420) void controller.loadItems(false); }} scrollEventThrottle={100}>
        {itemsHeader}<View style={{ marginTop: 14 }}>{selectedItems}</View>
      </ScrollView></View>
    </PagerView>
    {props.footer}
    <AdminCreateMenu actions={actions} isCurrent={model.current} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={t('action.close')}
      visible={!state.dialog && model.focused} bottomOffset={insets.bottom + 94} />
    {state.dialog && model.focused ? <Host style={{ position: 'absolute', width: '100%' }}><BasicAlertDialog onDismissRequest={() => controller.closeDialog(state.dialog!.id)} properties={{ usePlatformDefaultWidth: false, dismissOnBackPress: !state.picker, dismissOnClickOutside: !state.picker }}>
      <RNHostView matchContents><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: viewportHeight * 0.76, width: Math.min(viewportWidth - 40, 440), flexGrow: 0 }}>
        <ItemGroupsDialogContent dialog={state.dialog} model={model} />
      </ScrollView></RNHostView></BasicAlertDialog></Host> : null}
    {state.picker && model.focused ? <ItemGroupsPickerSheet key={state.picker.id} model={model} /> : null}
    <Host matchContents style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}><SnackbarHost ref={snackbar} /></Host>
  </View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  node: { borderWidth: 1, borderRadius: 8, padding: 8 }, nodeIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  children: { marginTop: 10, marginStart: 17, borderLeftWidth: 2, paddingStart: 10 }, description: { fontSize: 12 }, loading: { padding: 24, alignItems: 'center' }, noticeText: { padding: 16, textAlign: 'center' },
  selectedItems: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' }, badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  itemHeader: { padding: 12, gap: 8, flexDirection: 'row', alignItems: 'center' }, filters: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { fontSize: 16, fontWeight: '800' }, empty: { padding: 24, textAlign: 'center' } });
