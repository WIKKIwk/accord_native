import { Checkbox, Host } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { QolipCatalogActionMenu } from './QolipCatalogActionMenu';
import { QolipCatalogCodeDetails } from './QolipCatalogCodeDetails';
import { qolipContainerKey } from './qolipProductContainer';
import { qolipProductMoldKey } from './qolipProductsState';
import { qolipProductPassivePresentation } from './qolipProductPassivePresentation';
import { useQolipProductsScreen } from './useQolipProductsScreen';
import { extensionText } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QolipCatalogIconButton } from './QolipCatalogIconButton';

/** @v2 QolipProductsScreen */
export function QolipProductsScreen() {
  const h = useQolipProductsScreen(), { state: s, controller, t, role } = h, c = useWorkerColors();
  const insets = useSafeAreaInsets();
  if (s.invalid || !role.isCurrent()) return null;
  return <View style={{ flex: 1, paddingTop: insets.top }}>
    {s.selectionMode ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
      <QolipCatalogIconButton disabled={h.busy} label={t('products.selection_cancel')} onPress={h.cancel} icon="close" />
      <Text style={{ color: c.text, flex: 1, fontWeight: '700' }}>{t('products.selected_only', { selected: s.selectedCodes.size })}</Text>
      <QolipCatalogIconButton disabled={h.busy} label={t('products.selection_print')} onPress={() => void h.printSelected()} icon="print" />
      <QolipCatalogIconButton disabled={h.busy} label={t('products.selection_delete')} onPress={() => void h.remove()} icon="delete_outline" />
    </View> : <OrdersHeader search={s.query} searchPlaceholder={t('products.search')} onSearchChange={value => controller.setSearch(value)} onMenu={role.onMenu} onProfile={role.onProfile} />}
    {s.loading ? <ActivityIndicator style={{ margin: 32 }} /> : s.error ? <View style={{ padding: 20 }}><WorkerSheetButton label={t('action.retry')} onPress={() => void controller.reload()} /></View>
      : <FlatList key={s.listRevision} data={s.containers} keyExtractor={qolipContainerKey} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 112 }}
        contentOffset={{ x: 0, y: controller.scrollOffset }} onScroll={event => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          controller.setScrollOffset(contentOffset.y);
          if (!s.pageError && contentSize.height - contentOffset.y - layoutMeasurement.height < 500) void controller.more();
        }} scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void controller.reload()} />}
        ListEmptyComponent={<Text style={{ color: c.muted, padding: 32, textAlign: 'center' }}>{t(s.query.trim() ? 'products.search_empty' : 'products.empty')}</Text>}
        ListFooterComponent={s.loadingMore ? <ActivityIndicator /> : s.pageError ? <WorkerSheetButton label={t('action.retry')} onPress={() => void controller.more()} /> : undefined}
        renderItem={({ item: row, index }) => {
          const key = qolipContainerKey(row), view = qolipProductPassivePresentation(row, s.reworkCodes), expanded = s.expanded === key;
          return <WorkerQueueCard first={index === 0} last={index === s.containers.length - 1} backgroundColor={s.selectedContainers.has(key) ? c.field : c.surface}
            onPress={() => void h.toggleExpanded(row)} onLongPress={() => h.toggleContainer(row)} disabled={h.busy} style={{ alignItems: 'stretch', padding: 0 }}>
            <Pressable onLongPress={() => h.setImageId(view.coverId)} style={{ padding: 8, justifyContent: 'flex-start' }}>
              <WorkerOrderThumbnail session={role.session} orderId={view.coverId} imageId="" active={role.isCurrent()} size={64} backgroundColor={c.field} iconColor={c.icon} />
            </Pressable><View style={{ flex: 1, paddingVertical: 10, paddingRight: 10, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{view.title}</Text>
                {view.hasDetails && <Text style={{ color: c.muted }}>{t(view.inUse ? 'products.count_in_use' : 'products.mold_count', { count: view.count })}</Text>}
                {view.reworkCount > 0 && <Text style={{ color: c.error }}>{h.rw('in_rework_count', { count: view.reworkCount })}</Text>}</View>
                {s.selectionMode === 'containers' ? <Host matchContents><Checkbox value={s.selectedContainers.has(key)} enabled={!h.busy && !view.inUse && !view.reworkCount} onCheckedChange={() => h.toggleContainer(row)} /></Host>
                  : expanded && view.hasDetails && !s.selectionMode ? <Pressable accessibilityLabel={t('products.add')} onPress={() => void h.addChoices(row)}><SymbolView name={{ android: 'add' }} size={24} tintColor={c.icon} /></Pressable> : null}
                {s.selectedContainers.has(key) && <Pressable disabled={!!h.sharing} accessibilityLabel={extensionText('qolipProductPdfText', 'share', h.locale)} onPress={() => void h.share(row)}>
                  {h.sharing === key ? <ActivityIndicator /> : <SymbolView name={{ android: 'share' }} size={24} tintColor={c.icon} />}</Pressable>}
                {s.detailPending.has(key) ? <ActivityIndicator /> : <SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more' }} size={24} tintColor={c.icon} />}
              </View>
              {expanded && (s.detailErrors.has(key) ? <WorkerSheetButton label={t('action.retry')} onPress={() => void controller.ensureDetails(row)} /> : view.sections.map(section => <View key={section.id} style={{ gap: 8, paddingTop: 8 }}>
                <Pressable onPress={() => { if (!section.extension) void h.copy(section.id, true); }}><Text style={{ color: c.muted }}>{section.extension ? extensionText('qolipSharedSetText', 'extensions', h.locale) : `${extensionText('qolipSharedSetText', 'id', h.locale)}: ${section.id}`}</Text></Pressable>
                {section.alternativeIndex !== null && <Text style={{ color: c.muted }}>{`${t('products.alternative_set')} ${section.alternativeIndex}`}</Text>}
                {section.members.map(({ product, inRework, color, subtitle }, memberIndex) => <Pressable key={`${product.qolip_code}:${memberIndex}`}
                  onPress={() => s.selectionMode === 'qolips' ? h.toggleMold(product) : h.setQrProduct(product)} onLongPress={() => h.toggleMold(product)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: s.selectedCodes.has(qolipProductMoldKey(product)) ? c.field : 'transparent', padding: 6, borderRadius: 8 }}>
                  <SymbolView name={{ android: inRework ? 'build' : product.is_in_use ? 'lock_outline' : 'qr_code_2' }} size={18} tintColor={c.icon} />
                  {color && <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderColor: c.muted, borderWidth: 1 }} />}
                  <View style={{ flex: 1 }}><Pressable onPress={() => { if (s.selectionMode === 'qolips') h.toggleMold(product); else void h.copy(product.qolip_code); }}><Text style={{ color: c.text, fontWeight: '700' }}>{product.qolip_code}</Text></Pressable>
                    <Text style={{ color: c.muted }}>{subtitle === 'rework' ? h.rw('open') : subtitle === 'issued' ? t('products.issued') : subtitle === 'size' ? t('products.size_value', { size: product.size }) : ''}</Text></View>
                  {s.selectionMode === 'qolips' ? <Host matchContents><Checkbox value={s.selectedCodes.has(qolipProductMoldKey(product))} enabled={!h.busy && !product.is_in_use && !inRework} onCheckedChange={() => h.toggleMold(product)} /></Host>
                    : !product.is_in_use && !inRework ? <Pressable accessibilityLabel={t('products.edit_title')} onPress={() => void h.edit(product)}><SymbolView name={{ android: 'edit' }} size={20} tintColor={c.icon} /></Pressable> : null}
                </Pressable>)}
              </View>))}
            </View>
          </WorkerQueueCard>;
        }} />}
    {role.dock}
    {h.addProduct && <QolipCatalogActionMenu close={() => h.setAddProduct(null)} actions={[
      { id: 'add', label: h.m('add'), onPress: () => { const product = h.addProduct!; h.setAddProduct(null); void h.addMold(product); } },
      { id: 'choose', label: h.m('choose'), onPress: () => { void h.chooseSet(h.addProduct!); } },
      { id: 'new', label: h.m('new_set'), onPress: () => { const product = h.addProduct!; h.setAddProduct(null); void h.spec(product); } },
    ]} />}
    {h.qrProduct && <WorkerOrderSheet onClose={() => h.setQrProduct(null)} dismissible compact><QolipCatalogCodeDetails product={h.qrProduct} copy={code => { void h.copy(code); }} close={() => h.setQrProduct(null)} cancelAsError /></WorkerOrderSheet>}
    {h.imageId && <WorkerOrderSheet onClose={() => h.setImageId(null)} dismissible><WorkerOrderImage session={role.session} orderId={h.imageId} imageId="" onClose={() => h.setImageId(null)} /></WorkerOrderSheet>}
    {h.editor.content}
  </View>;
}
