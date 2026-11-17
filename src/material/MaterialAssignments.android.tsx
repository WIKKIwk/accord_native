import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { RawSplitScanner } from '../homashyo/RawSplitScanner';
import { useNativeSheet } from '../nativeSheet';
import { PreparationDialogs, usePreparationDialogs } from '../preparation/PreparationUI.android';
import { adminTopNoticeColors } from '../admin/adminTopNoticeModel';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { OrdersList } from '../shared/orders/OrdersList';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import type { RawMaterialAssignmentCandidate } from '../shared/rawMaterialAssignmentApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { useMaterialContext } from './MaterialContext';
import { useMaterialAssignments } from './useMaterialAssignments';
import { useMaterialAssignmentPicker } from './useMaterialAssignmentPicker';

type Model = ReturnType<typeof useMaterialAssignments>;
/** @v2 AdminRawMaterialAssignmentScreen */
export function MaterialAssignments() { return <PreparationDialogs><AssignmentScreen /></PreparationDialogs>; }

/** @v2 AdminRawMaterialAssignmentPanel */
function AssignmentScreen() {
  const model = useMaterialAssignments(), { controller, state, t } = model, { session } = useMaterialContext();
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer(), dialogs = usePreparationDialogs();
  const sheet = useNativeSheet(), [scanning, setScanning] = useState(false);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const choose = (options: readonly string[]) => dialogs.choose(t('raw_material.choose_apparatus'),
    options.map(value => ({ value, label: model.apparatusLabel(value) })), t('raw_material.choose_apparatus_message'));
  const unlink = (row: AdminRawMaterialAssignment) => controller.unlink(row, () => dialogs.confirm(t('raw_material.unlink_title'),
    model.unlinkConfirmationMessage(row), t('raw_material.unassign'), t('action.cancel')));
  useEffect(() => () => { sheet.close(); }, [sheet]);
  const openOrder = () => {
    if (!controller.current() || state.saving || !state.orders.length) return;
    sheet.open(<MaterialAssignmentOrderPicker model={model} close={sheet.close} />,
      { dismissible: true, heightFraction: 0.72 });
  };
  const openCandidate = (candidate: RawMaterialAssignmentCandidate) => {
    if (state.saving || state.assigningBarcode || !controller.current()) return;
    let selected = false;
    sheet.open(<MaterialDetails title={candidate.item_name || candidate.item_code} subtitle={candidate.item_code} icon="inventory_2"
      details={[
        [t('raw_material.qr'), candidate.barcode], [t('raw_material.warehouse'), candidate.warehouse],
        [t('raw_material.group'), candidate.item_group], [t('raw_material.quantity'), model.formatQty(candidate.qty, candidate.uom)],
        [t('raw_material.apparatus'), candidate.apparatus_options.map(model.apparatusLabel).sort().join(', ')],
      ]} action={<WorkerSheetButton label={t('raw_material.assign_to_order')} variant="filled" height={48}
        icon={{ android: 'link' }} onPress={() => { selected = true; sheet.close(); }} />} />,
      { dismissible: true, compact: true, fitContent: true, onDismiss: () => {
        if (selected && controller.current()) void controller.assignCandidate(candidate, async () => true, choose);
      } });
  };
  const openAssignment = (assignment: AdminRawMaterialAssignment) => {
    if (!controller.current()) return;
    let selected = false;
    sheet.open(<MaterialDetails title={assignment.item_name || assignment.item_code} subtitle={assignment.item_code} icon="link"
      details={[
        [t('raw_material.qr'), assignment.barcode], [t('raw_material.order_label'), assignment.order_id],
        [t('raw_material.apparatus'), model.apparatusLabel(assignment.apparatus)], [t('raw_material.warehouse'), assignment.stock_warehouse],
        [t('raw_material.group'), assignment.item_group], ...(assignment.stock_qty > 0
          ? [[t('raw_material.quantity'), model.formatQty(assignment.stock_qty, assignment.stock_uom)] as [string, string]] : []),
        [t('raw_material.status'), model.statusLabel(assignment)],
      ]} action={<WorkerSheetButton label={t(model.canUnlink(assignment) ? 'raw_material.unassign' : 'raw_material.unassign_unavailable')}
        disabled={!model.canUnlink(assignment) || state.unlinkingKey === model.assignmentKey(assignment)} height={48}
        icon={{ android: 'link_off' }} onPress={() => { selected = true; sheet.close(); }} />} />,
      { dismissible: true, compact: true, fitContent: true, onDismiss: () => {
        if (selected && controller.current()) void unlink(assignment);
      } });
  };
  const picker = <View style={{ padding: 14, gap: 10 }}>
    <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' }}>{t('raw_material.order_label')}</Text>
    <WorkerSheetButton label={model.selectedOrderLabel || t(state.orders.length ? 'raw_material.select' : 'raw_material.not_found')}
      onPress={openOrder} disabled={state.saving || !!state.assigningBarcode || !state.orders.length || (state.tab === 'qr' && !!state.lookup?.assignment)} />
    {state.tab === 'manual' && state.apparatusOptions.length > 0 ? <DropdownFilter label={t('raw_material.apparatus')}
      selectedLabel={state.selectedApparatus ? model.apparatusLabel(state.selectedApparatus) : t('raw_material.select')}
      options={state.apparatusOptions.map(value => ({ value, label: model.apparatusLabel(value) }))}
      enabled={!state.saving && !state.assigningBarcode && !state.candidatesLoading}
      backgroundColor={colors.surfaceContainerLowest} onChange={id => controller.selectApparatus(id)} last /> : null}
  </View>;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={t('raw_material.assign_title')} navigation={{ icon: 'menu', label: 'Material bo‘limlari', onPress: drawer.open }} />
    {!!state.notice && <AssignmentNotice message={state.notice} tone={state.noticeTone} />}
    {!model.groupScopeReady ? <View style={{ padding: 16, gap: 6 }}><Text style={{ color: colors.onSurface, fontWeight: '800', fontSize: 16 }}>{t('raw_material.group_missing')}</Text>
      <Text style={{ color: colors.onSurfaceVariant }}>{t('raw_material.group_missing_message')}</Text></View>
      : state.loading ? <ActivityIndicator /> : state.error ? <WorkerSheetButton label={t('action.retry')} onPress={() => { void controller.refresh(); }} />
        : <OrdersWorkspace session={session} tabs={[{ id: 'manual', name: 'Ro‘yxatdan' }, { id: 'qr', name: 'QR orqali' }]}
          selected={state.tab} onSelect={tab => controller.setTab(tab as 'manual' | 'qr')} distributeTabs>
          {(tabId, pagerGesture) => <OrdersList active={state.tab === tabId} pagerGesture={pagerGesture} headerOffset={headerOffset}
            headerHeight={headerHeight} topInset={48} passthrough={() => true}>
            <View style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 16 }}>{picker}
              {tabId === 'qr' ? <View style={{ padding: 14, paddingTop: 0, gap: 10 }}>
                <WorkerSheetButton label={t('raw_material.qr_scan')} variant="filled" height={48} icon={{ android: 'qr_code_scanner' }}
                  disabled={state.saving} onPress={() => setScanning(true)} />
                {!!state.barcode && <MaterialScannedCard model={model} unlink={unlink} />}
                <WorkerSheetButton label={t('raw_material.assign')} variant="filled" height={48} icon={{ android: 'link' }}
                  disabled={!model.canSave} onPress={() => { void controller.save(choose); }} />
              </View> : null}
            </View>
            {tabId === 'manual' ? <>
              <SectionTitle>{t('raw_material.unlinked_section')}</SectionTitle>
              {state.candidatesLoading ? <ActivityIndicator /> : state.candidatesError ? <View style={{ padding: 20, gap: 8 }}>
                <Text style={{ color: colors.onSurface, textAlign: 'center' }}>{t('raw_material.candidates_failed')}</Text>
                <WorkerSheetButton label={t('action.retry')} variant="text" icon={{ android: 'refresh' }} onPress={() => { void controller.retryCandidates(); }} />
              </View> : !state.candidates.length ? <Empty>{t('raw_material.candidates_empty')}</Empty>
                : state.candidates.map((candidate, index) => <MaterialAssignmentRow key={candidate.barcode}
                  first={index === 0} last={index === state.candidates.length - 1} icon="inventory_2"
                  title={candidate.item_name || candidate.item_code}
                  subtitle={[candidate.barcode, model.formatQty(candidate.qty, candidate.uom), candidate.warehouse].filter(Boolean).join(' • ')}
                  busy={state.assigningBarcode === candidate.barcode} onPress={() => openCandidate(candidate)} />)}
              <SectionTitle>{t('raw_material.linked_section')}</SectionTitle>
              {!model.visibleAssignments.length ? <Empty>{t('raw_material.order_empty')}</Empty> : model.visibleAssignments.map((row, index) =>
                <MaterialAssignmentRow key={model.assignmentKey(row)} first={index === 0} last={index === model.visibleAssignments.length - 1} icon="link"
                  title={row.item_name || row.item_code} subtitle={[row.barcode, model.formatQty(row.stock_qty, row.stock_uom), row.stock_warehouse].filter(Boolean).join(' • ')}
                  busy={state.unlinkingKey === model.assignmentKey(row)} onPress={() => openAssignment(row)} />)}
            </> : !state.assignments.length ? <Empty>{t('raw_material.linked_empty')}</Empty> : state.assignments.map((row, index) => {
              const expanded = state.expandedKey === model.assignmentKey(row);
              return <View key={model.assignmentKey(row)}><MaterialAssignmentRow first={index === 0} last={index === state.assignments.length - 1 && !expanded}
                icon="qr_code_2" title={row.order_id} subtitle={[row.barcode, model.apparatusLabel(row.apparatus), row.item_name, row.item_group].filter(Boolean).join(' · ')}
                busy={state.unlinkingKey === model.assignmentKey(row)} onPress={() => controller.expand(expanded ? null : model.assignmentKey(row))} />
                {expanded ? <View style={{ marginHorizontal: 8, backgroundColor: colors.surfaceContainerLowest, padding: 16, gap: 7 }}>
                  {[[t('raw_material.order_label'), row.order_id], [t('raw_material.qr'), row.barcode], [t('raw_material.apparatus'), model.apparatusLabel(row.apparatus)],
                    [t('raw_material.warehouse'), row.stock_warehouse], [t('raw_material.item_code'), row.item_code], [t('raw_material.item_name'), row.item_name],
                    [t('raw_material.group'), row.item_group], [t('raw_material.status'), model.statusLabel(row)], [t('raw_material.reserved_order'), row.reserved_order_id],
                    [t('raw_material.assigned_by'), model.assignmentAssignee(row)], [t('raw_material.time'), model.formatAssignmentTimestamp(row.assigned_at)]].map(([label, value]) =>
                    <Info key={label} label={label} value={value} />)}
                  {model.canUnlink(row) ? <WorkerSheetButton label={t('raw_material.unassign')} icon={{ android: 'link_off' }}
                    disabled={state.unlinkingKey === model.assignmentKey(row)} onPress={() => { void unlink(row); }} /> : null}
                </View> : null}
              </View>;
            })}
          </OrdersList>}
        </OrdersWorkspace>}
    <RawSplitScanner visible={scanning} active={scanning} isCurrent={controller.isCurrent} onClose={() => setScanning(false)}
      onComplete={barcode => { setScanning(false); void controller.scan(barcode); }} />
  </View>;
}

function MaterialAssignmentOrderPicker({ model, close }: { model: Model; close: () => void }) {
  const picker = useMaterialAssignmentPicker(model.state.orders, model.orderLabel), { height } = useWindowDimensions();
  return <View style={{ height: height * 0.66 }}><PickerSheetContent title={model.t('raw_material.order_select')}
    hint={model.t('raw_material.order_search')} closeLabel="Yopish" emptyLabel={model.t('raw_material.not_found')}
    onClose={close} onSearch={picker.setInput} query={picker.input} items={picker.items.map(order => ({ key: order.map.id,
      title: model.orderLabel(order), subtitle: order.map.id.trim(), select: () => { close(); model.controller.selectOrder(order.map.id); } }))}
    hasMore={picker.hasMore} onLoadMore={picker.loadMore} /></View>;
}
function MaterialScannedCard({ model, unlink }: { model: Model; unlink: (row: AdminRawMaterialAssignment) => Promise<void> }) {
  const { state, t } = model, colors = useMaterialColors(), detail = state.lookup, assignment = detail?.assignment;
  return <View style={{ backgroundColor: colors.surfaceContainerHighest, borderRadius: 12, padding: 12, gap: 10 }}>
    <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{t('raw_material.material_info')}</Text>
    {state.scanLoading ? <ActivityIndicator /> : null}<Info label={t('raw_material.qr')} value={state.barcode} />
    {detail ? <><Info label={t('raw_material.warehouse')} value={detail.warehouse} /><Info label={t('raw_material.type')} value={detail.item_group} />
      <Info label={t('raw_material.item_name')} value={detail.item_name} /><Info label={t('raw_material.quantity')} value={model.formatQty(detail.qty, detail.uom)} />
      <Info label={t('raw_material.item_code')} value={detail.item_code} />
      {!!model.diagnosticMessage && state.diagnostic?.compatible === false ? <Text style={{ color: colors.onErrorContainer, backgroundColor: colors.errorContainer, padding: 12, borderRadius: 12 }}>{model.diagnosticMessage}</Text> : null}
      {assignment ? <><View style={{ backgroundColor: colors.secondaryContainer, borderRadius: 12, padding: 12, gap: 3 }}>
        <Text style={{ color: colors.onSecondaryContainer }}>{t('raw_material.current_order')}</Text>
        <Text style={{ color: colors.onSecondaryContainer, fontWeight: '800', fontSize: 16 }}>{model.scannedOrderLabel}</Text>
        {!!model.scannedStatusLabel && <Text style={{ color: colors.onSecondaryContainer, fontWeight: '700' }}>{model.scannedStatusLabel}</Text>}
      </View>{!!model.scannedLockMessage && <Text style={{ color: colors.onErrorContainer, backgroundColor: colors.errorContainer, borderRadius: 12, padding: 12 }}>{model.scannedLockMessage}</Text>}
        {model.canUnlink(assignment, 'scan') ? <WorkerSheetButton label={t('raw_material.unassign')} icon={{ android: 'link_off' }}
          disabled={state.unlinkingKey === model.assignmentKey(assignment)} onPress={() => { void unlink(assignment); }} /> : null}
      </> : <Text style={{ color: colors.onSurfaceVariant, fontWeight: '700' }}>{t('raw_material.unassigned_order')}</Text>}
    </> : null}
    {!!state.scanError && <Text style={{ color: colors.error, fontWeight: '700' }}>{state.scanError}</Text>}
  </View>;
}
function MaterialAssignmentRow({ title, subtitle, first, last, icon, busy, onPress }: {
  title: string; subtitle: string; first: boolean; last: boolean; icon: 'inventory_2' | 'link' | 'qr_code_2'; busy: boolean; onPress: () => void;
}) {
  const colors = useMaterialColors();
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest} disabled={busy} onPress={onPress}
    style={{ height: 61, paddingHorizontal: 14, paddingVertical: 8 }}>
    <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }}>
      <SymbolView name={{ android: icon }} size={16} tintColor={colors.onSecondaryContainer} />
    </View><View style={{ flex: 1, marginLeft: 12, gap: 4 }}><Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
      <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }} numberOfLines={1}>{subtitle}</Text></View>
    {busy ? <ActivityIndicator size="small" /> : null}
  </WorkerQueueCard>;
}
/** @v2 _ManualMaterialSheetSurface */
function MaterialDetails({ title, subtitle, icon, details, action }: { title: string; subtitle: string; icon: 'link' | 'inventory_2'; details: readonly (readonly [string, string])[]; action: ReactNode }) {
  const colors = useMaterialColors();
  return <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 18 }}>
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={{ android: icon }} size={24} tintColor={colors.onSecondaryContainer} /></View>
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        {!!subtitle && subtitle !== title && <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{subtitle}</Text>}</View></View>
    <View style={{ gap: 7 }}>{details.map(([label, value]) => <Info key={label} label={label} value={value} />)}</View>{action}
  </View>;
}
function Info({ label, value }: { label: string; value: string }) {
  const colors = useMaterialColors();
  if (!value.trim()) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><Text style={{ width: 104, color: colors.onSurfaceVariant, fontSize: 12 }}>{label}</Text>
    <Text selectable style={{ flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: '600' }}>{value}</Text></View>;
}
function SectionTitle({ children }: { children: string }) {
  const colors = useMaterialColors(); return <Text style={{ paddingHorizontal: 12, paddingTop: 18, paddingBottom: 8, color: colors.onSurface, fontSize: 14, fontWeight: '800' }}>{children}</Text>;
}
function Empty({ children }: { children: string }) {
  const colors = useMaterialColors(); return <Text style={{ paddingHorizontal: 12, paddingVertical: 20, textAlign: 'center', color: colors.onSurfaceVariant }}>{children}</Text>;
}
function AssignmentNotice({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  const colors = adminTopNoticeColors(tone);
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: colors.background, paddingHorizontal: 16, paddingVertical: 12 }}>
    <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{message}</Text>
  </View>;
}
