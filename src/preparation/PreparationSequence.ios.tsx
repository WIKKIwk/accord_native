import { Button, Host, HStack, List, Menu, ProgressView, RNHostView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled, onAppear } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { useWorkerColors } from '../components/useWorkerColors';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { preparationOrderDetail, type PreparationOrderListRow } from './preparationOrdersApi';
import type { PreparationOrdersState } from './preparationOrdersState';

type Detail = Awaited<ReturnType<typeof preparationOrderDetail>>;
type Props = { session: Session; controller: PreparationOrdersState; selectApparatus: (id: string) => Promise<void>;
  renderDetail: (detail: Detail, row: PreparationOrderListRow) => ReactNode };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
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

function SequenceRow({ session, row }: { session: Session; row: PreparationOrderListRow }) {
  const [showImage, setShowImage] = useState(false), colors = useWorkerColors();
  useEffect(() => {
    let second = 0; const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShowImage(true)); });
    return () => { cancelAnimationFrame(first); if (second) cancelAnimationFrame(second); };
  }, []);
  return <HStack spacing={10}>
    {showImage && <RNHostView matchContents><WorkerOrderThumbnail session={session} orderId={row.id} imageId={row.image_id}
      active backgroundColor={colors.surface} iconColor={colors.icon} /></RNHostView>}
    <VStack alignment="leading"><Text>{row.position}. {row.code || row.order_number || row.id}</Text><Text>{row.title} · {row.customer_name}</Text></VStack>
  </HStack>;
}

// V2 _PreparationOrdersListState. The integrator supplies its shared warm store,
// persisted apparatus selection and the existing read-only detail presentation.
export function PreparationSequence({ session, controller, selectApparatus, renderDetail }: Props) {
  const t = usePreparationText(), sheet = useNativeSheet();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(useCallback(() => { controller.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', value => controller.setForeground(value === 'active'));
    return () => { subscription.remove(); controller.setForeground(false); }; }, [controller]));
  const select = async (id: string) => {
    try { await selectApparatus(id); await controller.changeQuery({ apparatus: id }); }
    catch (error) { preparationAlert(error); }
  };
  return <><Stack.Screen options={{ title: t('Ketma-ketlik') }} /><PreparationList refresh={() => controller.reload(true)}>
    <Section><TextField placeholder={productionText('worker.queue.search.sequence', locale)} onTextChange={value => controller.searchChanged(value)} />
      {!!state.window?.apparatus.length && <Menu label={state.window.apparatus.find(item => item.id === state.apparatus)?.name ?? t('Apparat')}>
        {state.window.apparatus.map(item => <Button key={item.id} label={item.name} onPress={() => { void select(item.id); }} />)}
      </Menu>}</Section>
    <PreparationStatus loading={state.loading} error={state.error} retry={() => { void controller.reload(); }} />
    {!state.loading && !state.error && !state.rows.length && <Section><Text>{t('Mos buyurtma topilmadi.')}</Text></Section>}
    <Section>{state.rows.map((row, index) => <Button key={row.id} modifiers={[onAppear(() => {
      if (index >= state.rows.length - 5 && state.window?.next_cursor) void controller.loadMore();
    })]} onPress={() => sheet.open(<OrderDetail session={session} controller={controller}
      row={row} close={sheet.close} selectApparatus={selectApparatus} renderDetail={renderDetail} />, { dismissible: false })}>
      <SequenceRow session={session} row={row} />
    </Button>)}</Section>
    {state.window?.next_cursor != null && <Section><Button label={t('Yana yuklash')} modifiers={[disabled(state.loading)]}
      onPress={() => { void controller.loadMore(); }} /></Section>}
  </PreparationList></>;
}
