import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { BaseHost } from '../components/BaseHost.android';
import { BasicAlertDialog, CircularProgressIndicator, FilterChip, LinearProgressIndicator, RNHostView, Row, Shape, SnackbarHost, Surface, TextButton, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { ORDERS_TAB_BAR_HEIGHT } from '../shared/orders/ordersWorkspaceTypes';
import { AdminScreenHeader } from './AdminTopBar.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminCreateMenu } from './AdminCreateMenu.android';
import { AdminText as ComposeText } from './AdminTypography.android';
import { ItemGroupsDialogContent } from './ItemGroupsDialogContent';
import { ItemGroupsPickerSheet } from './ItemGroupsPickerSheet.android';
import type { ItemGroupsTreeNode } from './itemGroupsModel';
import { useItemGroupsRoute, type ItemGroupsRouteModel, type ItemGroupsRouteProps } from './useItemGroupsRoute';

const withAlpha = (color: string, alpha: number) => `${color.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const passthrough = () => true;
function Loading() { return <BaseHost matchContents><CircularProgressIndicator /></BaseHost>; }
function TreeRow({ node, model, depth = 0 }: { node: ItemGroupsTreeNode; model: ItemGroupsRouteModel; depth?: number }) {
  const colors = useBaseTheme().colors, { state, controller, t } = model, children = node.children.length > 0, expanded = state.expanded.has(node.entry.name);
  return <View style={[styles.node, { borderColor: depth ? withAlpha(colors.outlineVariant, 0.55) : colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="center"
      modifiers={[fillMaxWidth(), ...(children ? [combinedClickable({ onClick: () => controller.toggle(node.entry.name) })] : []), padding(4, 4, 4, 4)]}>
      <RNHostView matchContents><View style={[styles.nodeIcon, { backgroundColor: children ? colors.primaryContainer : colors.surfaceContainerHighest }]}>
        <SymbolView name={{ android: children ? 'folder' : 'label' }} size={20} tintColor={children ? colors.onPrimaryContainer : colors.onSurfaceVariant} /></View></RNHostView>
      <ComposeText maxLines={1} overflow="ellipsis" style={{ fontSize: 16, fontWeight: '800' }} modifiers={[weight(1), padding(10, 0, 0, 0)]}>{node.entry.item_group_name || node.entry.name}</ComposeText>
      <TextButton onClick={() => controller.selectGroup(node.entry.name)}><ComposeText>{t('item_group.show')}</ComposeText></TextButton>
      <RNHostView matchContents><View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: children ? colors.primaryContainer : colors.surfaceContainerHighest }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: children ? colors.onPrimaryContainer : colors.onSurfaceVariant }}>{children ? t('item_group.children_count', { count: node.children.length }) : t('item_group.leaf')}</Text>
      </View></RNHostView>
      {children ? <RNHostView matchContents><View style={{ marginStart: 6 }}><SymbolView name={{ android: expanded ? 'expand_more' : 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></View></RNHostView> : null}
    </Row></BaseHost>
    {children && expanded ? <View style={[styles.children, { borderLeftColor: withAlpha(colors.primary, 0.42) }]}>{node.children.map((child, index) => <View key={child.entry.name} style={index ? { marginTop: 8 } : undefined}><TreeRow node={child} model={model} depth={depth + 1} /></View>)}</View> : null}
  </View>;
}
/** @v2 AdminItemGroupCreateScreen */
export function ItemGroupsRoute(props: ItemGroupsRouteProps) {
  const model = useItemGroupsRoute(props), { state, controller, t, roots, displayGroups, focused } = model, { colors, chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const tabs = useMemo(() => (['tree', 'items'] as const).map(id => ({ id, name: t(`item_group.${id}_tab`) })), [t]);
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
    {state.parentsPhase === 'loading' ? <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><LinearProgressIndicator modifiers={[fillMaxWidth()]} /></BaseHost> : state.parentsPhase === 'error' ?
      <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.load_failed')}</Text> : displayGroups.length ? <>
        <BaseHost matchContents style={{ alignSelf: 'flex-start' }}><FilterChip selected={!!state.selectedGroup} elevation={2} border={{ color: 'transparent' }} colors={chipColors} onClick={() => controller.toggleFilter()}>
          <FilterChip.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'inventory_2' }} size={18} tintColor={state.selectedGroup ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></RNHostView></FilterChip.LeadingIcon>
          <FilterChip.Label><ComposeText style={{ fontSize: 14, fontWeight: '500' }}>{`${t('item_group.group')}: ${state.selectedGroup || t('item_group.not_selected')}`}</ComposeText></FilterChip.Label>
          <FilterChip.TrailingIcon><RNHostView matchContents><SymbolView name={{ android: state.filterExpanded ? 'expand_less' : 'expand_more' }} size={18} tintColor={state.selectedGroup ? colors.onSecondaryContainer : colors.onSurfaceVariant} /></RNHostView></FilterChip.TrailingIcon>
        </FilterChip></BaseHost>
        {state.filterExpanded ? <View style={styles.filters}>{displayGroups.map(group => <BaseHost matchContents key={group}><FilterChip selected={group === state.selectedGroup} elevation={2} border={{ color: 'transparent' }} colors={chipColors} onClick={() => controller.selectGroup(group)}>
          {group === state.selectedGroup ? <FilterChip.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'check' }} size={18} tintColor={colors.onSecondaryContainer} /></RNHostView></FilterChip.LeadingIcon> : null}
          <FilterChip.Label><ComposeText style={{ fontSize: 14, fontWeight: '500' }}>{group}</ComposeText></FilterChip.Label></FilterChip></BaseHost>)}</View> : null}
      </> : <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.not_found')}</Text>}
  </>;
  const showsItemsCard = Boolean(state.selectedGroup && !state.itemsLoading && (!state.itemsError || state.items.length));
  const itemSurface = { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant };
  const selectedItemsHeader = !state.selectedGroup ? <Text style={[styles.noticeText, { color: colors.onSurface }]}>{t('item_group.tree_show_hint')}</Text> : state.itemsLoading ? <View style={styles.loading}><Loading /></View> : !showsItemsCard ? <View style={styles.noticeText}>
    <Text style={{ textAlign: 'center', color: colors.onSurface }}>{t('item_group.items_load_failed')}</Text><View style={{ marginTop: 10 }}><WorkerSheetButton variant="outlined" label={t('action.retry')} onPress={() => { void controller.loadItems(true); }} /></View>
  </View> : <View style={[styles.itemHeader, styles.itemSurface, styles.itemSurfaceTop, itemSurface]}>
    <SymbolView name={{ android: 'inventory_2' }} size={24} tintColor={colors.primary} /><Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.onSurface }}>{state.selectedGroup}</Text>
    <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}><Text style={{ fontSize: 11, fontWeight: '800', color: colors.onPrimaryContainer }}>{t('item_group.item_count', { count: state.items.length })}</Text></View>
  </View>;
  const itemsFooter = showsItemsCard ? <View style={[styles.itemSurface, styles.itemSurfaceBottom, itemSurface]}>
    {!state.items.length ? <Text style={{ paddingHorizontal: 12, paddingBottom: 12, color: colors.onSurface }}>{t('item_group.no_items')}</Text> : null}
    {state.loadingMore ? <View style={{ padding: 14, alignItems: 'center' }}><Loading /></View> : state.itemsError ? <View style={{ padding: 12 }}><WorkerSheetButton variant="outlined" label={t('item_group.load_more')} onPress={() => { void controller.loadItems(true); }} /></View> : state.hasMore ? <Text style={[styles.description, { padding: 12, color: colors.onSurfaceVariant }]}>{t('item_group.scroll_hint')}</Text> : null}
  </View> : null;
  return <View style={{ flex: 1, backgroundColor: chromeBackground, paddingTop: insets.top }}>
    <AdminScreenHeader title={t('item_group.title')} navigation={props.navigation} profileAction={props.profileAction} />
    {props.topNotice}
    {state.notice?.success && !props.showTopNotice ? <View pointerEvents="none" accessibilityRole="alert" style={{ backgroundColor: colors.primaryContainer, paddingHorizontal: 16, paddingVertical: 12 }}><Text style={{ color: colors.onPrimaryContainer, fontSize: 14 }}>{t(state.notice.key, state.notice.values)}</Text></View> : null}
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-item-groups-body-frame">
    <OrdersWorkspace session={props.session} tabs={tabs} selected={state.tab} swipeEnabled={focused && !state.dialog}
      onSelect={tab => { if (tab === 'tree' || tab === 'items') controller.setTab(tab); }}>
      {(tab, pagerGesture) => tab === 'tree' ?
        state.treePhase !== 'ready' ? <View style={[styles.center, { marginTop: ORDERS_TAB_BAR_HEIGHT }]}>{state.treePhase === 'loading' ? <Loading /> :
          <Text style={{ color: colors.onSurfaceVariant }}>{t('item_group.tree_load_failed')}</Text>}</View> :
          <OrdersList active={focused && state.tab === tab} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight}
            topInset={ORDERS_TAB_BAR_HEIGHT} passthrough={passthrough} onRefresh={() => controller.reload()}
            footer={<View style={{ height: insets.bottom + 116 }} />}>
            <View style={{ padding: 4 }}><BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Surface color={colors.surfaceContainerLowest} shadowElevation={4} tonalElevation={0} shape={rounded(18)} modifiers={[fillMaxWidth()]}>
              <RNHostView matchContents><View style={{ padding: 14 }}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>{t('item_group.tree_title')}</Text>
                <Text style={[styles.description, { marginTop: 6, marginBottom: 14, color: colors.onSurface }]}>{t('item_group.tree_description')}</Text>
                {!roots.length ? <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>{t('item_group.tree_empty')}</Text> : roots.map((node, index) => <View key={node.entry.name} style={index ? { marginTop: 10 } : undefined}><TreeRow node={node} model={model} /></View>)}
              </View></RNHostView></Surface></BaseHost></View>
          </OrdersList> :
        <OrdersList active={focused && state.tab === tab} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight}
          topInset={ORDERS_TAB_BAR_HEIGHT} passthrough={passthrough} onRefresh={() => controller.loadItems(true)} onScrollMetrics={controller.itemsScrolled}
          rows={showsItemsCard ? state.items : undefined} rowKey={(item, index) => `${index}:${item.code}`}
          renderRow={(item, index) => <View style={[styles.itemSurface, itemSurface]}>
            <View style={styles.item}><View style={[styles.nodeIcon, { backgroundColor: colors.surfaceContainerHighest }]}><SymbolView name={{ android: 'category' }} size={18} tintColor={colors.onSurfaceVariant} /></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.itemTitle, { color: colors.onSurface }]}>{item.name.trim() ? item.name : item.code}</Text>
                {item.code.trim() || item.uom.trim() ? <Text numberOfLines={1} style={[styles.description, { color: colors.onSurfaceVariant }]}>{[item.code.trim(), item.uom.trim()].filter(Boolean).join(' • ')}</Text> : null}</View></View>
            {index !== state.items.length - 1 ? <View style={{ height: 1, marginHorizontal: 12, backgroundColor: withAlpha(colors.outlineVariant, 0.6) }} /> : null}
          </View>}
          footer={<>{itemsFooter}<View style={{ height: insets.bottom + 240 }} /></>}>
          <View style={styles.itemsHeader}>{itemsHeader}</View>
          {selectedItemsHeader}
        </OrdersList>}
    </OrdersWorkspace>
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    <AdminCreateMenu actions={actions} isCurrent={model.current} openLabel={localizedGetter('adminCreateTitle', model.locale)} closeLabel={t('action.close')}
      visible={!state.dialog && model.focused} bottomOffset={insets.bottom + 94} />
    {state.dialog && model.focused ? <BaseHost style={{ position: 'absolute', width: '100%' }}><BasicAlertDialog onDismissRequest={() => controller.closeDialog(state.dialog!.id)} properties={{ usePlatformDefaultWidth: false, dismissOnBackPress: !state.picker, dismissOnClickOutside: !state.picker }}>
      <RNHostView matchContents><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: viewportHeight * 0.76, width: Math.min(viewportWidth - 40, 440), flexGrow: 0 }}>
        <ItemGroupsDialogContent dialog={state.dialog} model={model} />
      </ScrollView></RNHostView></BasicAlertDialog></BaseHost> : null}
    {state.picker && model.focused ? <ItemGroupsPickerSheet key={state.picker.id} model={model} /> : null}
    <BaseHost matchContents style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}><SnackbarHost ref={snackbar} /></BaseHost>
  </View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  node: { borderWidth: 1, borderRadius: 8, padding: 8 }, nodeIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  children: { marginTop: 10, marginStart: 17, borderLeftWidth: 2, paddingStart: 10 }, description: { fontSize: 12 }, loading: { padding: 24, alignItems: 'center' }, noticeText: { padding: 16, textAlign: 'center' },
  itemsHeader: { paddingTop: 16, marginHorizontal: 12, marginBottom: 14 },
  itemSurface: { marginHorizontal: 12, borderLeftWidth: 1, borderRightWidth: 1 },
  itemSurfaceTop: { borderTopWidth: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  itemSurfaceBottom: { borderBottomWidth: 1, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  itemHeader: { padding: 12, gap: 8, flexDirection: 'row', alignItems: 'center' }, filters: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { fontSize: 16, fontWeight: '800' }, empty: { padding: 24, textAlign: 'center' } });
