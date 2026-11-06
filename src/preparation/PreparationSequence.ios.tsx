import { Button, Host, HStack, List, ProgressView, RNHostView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, onAppear } from '@expo/ui/swift-ui/modifiers';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { ListItem, Row } from '@expo/ui';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import type { Session } from '../auth';
import { activeSessionToken, registerSessionResetHook } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { WorkerOrderImage } from '../components/WorkerOrderHeader';
import { useWorkerColors } from '../components/useWorkerColors';
import { productionText } from '../shared/localization';
import { sessionReadScope } from '../sessionReadScope';
import { workerOrderDetailFromSnapshot } from '../workerApi';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { preparationOrdersWarmStore } from './preparationRuntime';
import { subscribePreparationOrdersLive } from './preparationOrdersLive';
import { PreparationOrdersState as OrdersState } from './preparationOrdersState';
import { usePreparationContext } from './PreparationContext';
import { usePreparationOrderMaterials } from './usePreparationOrderMaterials';
import { openPreparationRoute } from './PreparationRoutes';
import { localeController } from '../shared/localization/runtime';
import { preparationAlert, usePreparationText } from './PreparationUI';
import { preparationOrderDetail, type PreparationOrderListRow } from './preparationOrdersApi';
import type { PreparationOrdersState } from './preparationOrdersState';

type Detail = Awaited<ReturnType<typeof preparationOrderDetail>>;
type Props = { session: Session; controller: PreparationOrdersState; selectApparatus: (id: string) => Promise<void>;
  renderDetail: (detail: Detail, row: PreparationOrderListRow) => ReactNode };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function PreparationOrderSummary({ session, detail, row }: { session: Session; detail: Detail; row: PreparationOrderListRow }) {
  const t = usePreparationText(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const [expanded, setExpanded] = useState(true), materials = usePreparationOrderMaterials(session, row.id), colors = useWorkerColors();
  const image = useNativeSheet();
  const order = workerOrderDetailFromSnapshot(detail, row.id), map = order.map;
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  const meters = positive(map.base_length), weight = positive(map.order_kg), rolls = positive(map.roll_count), width = positive(map.width_mm);
  return <>
    <Section><HStack><Button modifiers={[accessibilityLabel(t('Buyurtma rasmini ochish'))]} onPress={() => image.open(<WorkerOrderImage session={session} orderId={row.id} imageId={row.image_id}
      onClose={image.close} />, { dismissible: true })}><RNHostView matchContents><WorkerOrderThumbnail session={session} orderId={row.id} imageId={row.image_id}
      active backgroundColor={colors.surface} iconColor={colors.icon} /></RNHostView></Button><VStack alignment="leading">
      <Text>{row.code || row.order_number || row.id}</Text><Text>{[order.customer || row.customer_name, row.title].filter(Boolean).join(' · ')}</Text>
    </VStack></HStack></Section>
    <Section><Button label={productionText('worker.summary.expected.title', locale)} onPress={() => setExpanded(value => !value)} />
      {expanded && <>
        {meters !== null && <Text>{productionText('worker.summary.length', locale)}: {Math.ceil(meters / 500) * 500} m</Text>}
        {weight !== null && <Text>{productionText('worker.summary.weight', locale)}: {weight} kg</Text>}
        {rolls !== null && <Text>{productionText('worker.summary.shafts', locale)}: {rolls} · {width ?? '—'} mm</Text>}
        <Text>{productionText('order.print_side', locale)}: {productionText(map.standard_print_side === false ? 'order.print_side.nonstandard' : 'order.print_side.standard', locale)}</Text>
      </>}</Section>
    <Section><Button label={t('Shnek formulalar')} modifiers={[disabled(materials.loading)]} onPress={() => { void materials.load(); }} />
      {materials.loading && <ProgressView />}{!!materials.error && <Text>{materials.error}</Text>}
      {materials.materials?.map(material => <Button key={material.material_id} label={material.material_name || material.material_id} onPress={() => {
        openPreparationRoute('variants', { orderId: row.id, orderCode: row.code || row.order_number,
          productCode: String(map.product_code ?? ''), productTitle: row.title, materialId: material.material_id,
          materialName: material.material_name || material.material_id, customerName: order.customer || row.customer_name });
      }} />)}</Section>
  </>;
}
function OrderDetail({ session, controller, row, close, renderDetail }: Props & { row: PreparationOrderListRow; close: () => void }) {
  const t = usePreparationText(), state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const exists = state.rows.some(item => item.id === row.id);
  const load = useCallback(() => {
    if (!exists) return;
    setLoading(true); setError('');
    void preparationOrderDetail(session, row.id).then(setDetail).catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [session, row.id, exists]);
  useEffect(() => {
    if (!exists) return;
    let active = true;
    void preparationOrderDetail(session, row.id).then(value => { if (active) setDetail(value); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, row.id, exists]);
  useEffect(() => { if (!exists) close(); }, [exists, close]);
  return <Host style={{ flex: 1 }}><VStack><Text>{row.code || row.order_number || row.id}</Text><List>
    {loading && <ProgressView />}{!!error && <Section><Text>{error}</Text><Button label={t('Qayta urinish')} onPress={load} /></Section>}
    {!loading && detail && exists && renderDetail(detail, row)}
  </List><Button label={t('Yopish')} onPress={close} /></VStack></Host>;
}

// @v2 AdminProductionMapOrdersScreen
// @v2 _PreparationOrdersListState
export function PreparationSequence({ session, controller, selectApparatus, renderDetail }: Props) {
  const t = usePreparationText(), sheet = useNativeSheet(), drawer = useRoleDrawer();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(70);
  const [query, setQuery] = useState('');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(useCallback(() => { controller.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', value => controller.setForeground(value === 'active'));
    return () => { subscription.remove(); controller.setForeground(false); }; }, [controller]));
  const select = async (id: string) => {
    try { await selectApparatus(id); await controller.changeQuery({ apparatus: id }); }
    catch (error) { preparationAlert(error); }
  };
  return <OrdersWorkspace session={session} tabs={state.window?.apparatus ?? []} selected={state.apparatus}
    onSelect={id => { void select(id); }} search={query} onSearchChange={value => { setQuery(value); controller.searchChanged(value); }}
    loading={state.loading && !state.window} onMenu={drawer.open}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/ios-preparation' as Href); }}
    onProfile={() => router.navigate('/ios-preparation/profile' as Href)}>
    {(tabId, pagerGesture, machinePicker) => <OrdersList active={tabId === state.apparatus} pagerGesture={pagerGesture}
      headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={() => controller.reload(true)}>
      <Row spacing={8} style={{ paddingVertical: 4 }}>{machinePicker}</Row>
      {!!state.error && <ListItem supportingText={state.error} onPress={() => { void controller.reload(); }}>{t('Qayta urinish')}</ListItem>}
      {!state.loading && !state.error && !state.rows.length && <ListItem>{t('Mos buyurtma topilmadi.')}</ListItem>}
      {state.rows.map((row, index) => <OrderListItem key={row.id} session={session} orderId={row.id} imageId={row.image_id}
        imageActive={tabId === state.apparatus} last={index === state.rows.length - 1}
        headline={`${row.position}. ${row.code || row.order_number || row.id} · ${row.title}`} supportingText={row.customer_name}
        onPress={() => sheet.open(<OrderDetail session={session} controller={controller} row={row} close={sheet.close}
          selectApparatus={selectApparatus} renderDetail={renderDetail} />, { dismissible: false })} />)}
      {state.window?.next_cursor != null && <Button label={t('Yana yuklash')} modifiers={[disabled(state.loading), onAppear(() => { void controller.loadMore(); })]}
        onPress={() => { void controller.loadMore(); }} />}
    </OrdersList>}
  </OrdersWorkspace>;
}

export function PreparationSequenceRoute() {
  const { session } = usePreparationContext();
  const controller = useMemo(() => {
    const scope = sessionReadScope(session);
    return new OrdersState(preparationOrdersWarmStore, () => !!activeSessionToken(session) && sessionReadScope(session) === scope,
      (window, search, length, onEvent, onError, onDone) => subscribePreparationOrdersLive(session, window,
        { search, length }, onEvent, onError, onDone), () => adminSequenceApparatusStore.loadSavedApparatusId());
  }, [session]);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.sessionChanged(true); });
    void controller.start();
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  const selectApparatus = useCallback(async (id: string) => {
    const apparatus = controller.getSnapshot().window?.apparatus.find(item => item.id === id);
    if (apparatus) await adminSequenceApparatusStore.saveApparatus(apparatus);
  }, [controller]);
  return <PreparationSequence session={session} controller={controller} selectApparatus={selectApparatus}
    renderDetail={(detail, row) => <PreparationOrderSummary session={session} detail={detail} row={row} />} />;
}
