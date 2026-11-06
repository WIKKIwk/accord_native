import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { PreparationOrderListRow } from './preparationOrdersApi';
import type { PreparationOrdersState } from './preparationOrdersState';
import { PreparationButton, PreparationField, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Props = { session: Session; controller: PreparationOrdersState;
  selectApparatus: (id: string) => Promise<void>; openOrder: (row: PreparationOrderListRow) => void };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function sequenceLifecycle(controller: PreparationOrdersState) {
  let mounts = 0, started = false;
  return { mount() {
    mounts++;
    if (!started) { started = true; void controller.start(); }
    return () => { mounts--; queueMicrotask(() => { if (!mounts) controller.dispose(); }); };
  } };
}

/** The integrator supplies the shared apparatus selection and read-only order detail. */
export function PreparationSequenceList({ session, controller, selectApparatus, openOrder }: Props) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [query, setQuery] = useState(''), dialogs = usePreparationDialogs(), t = usePreparationText();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), visible = useRef(false), focusedOnce = useRef(false);
  const lifecycle = useMemo(() => sequenceLifecycle(controller), [controller]);
  useEffect(() => lifecycle.mount(), [lifecycle]);
  useFocusEffect(useCallback(() => {
    visible.current = true;
    if (focusedOnce.current || AppState.currentState !== 'active') controller.setForeground(AppState.currentState === 'active');
    focusedOnce.current = true;
    return () => { visible.current = false; controller.setForeground(false); };
  }, [controller]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', value => controller.setForeground(visible.current && value === 'active'));
    return () => sub.remove();
  }, [controller]);
  const choose = async () => {
    const selection = await dialogs.choose('Apparat', (state.window?.apparatus ?? []).map(item => ({ label: item.name, value: item.id })));
    if (selection === null || selection === state.apparatus) return;
    try { await selectApparatus(selection); await controller.changeQuery({ apparatus: selection }); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <View style={{ padding: 16 }}><PreparationText title>{t('Ketma-ketlik')}</PreparationText></View>
    <FlatList data={state.rows} keyExtractor={item => item.id} contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 8, paddingBottom: insets.bottom + 20 }}
      refreshControl={<RefreshControl refreshing={state.loading && !!state.rows.length} onRefresh={() => void controller.reload(true)} />}
      onEndReached={() => void controller.loadMore()} onEndReachedThreshold={0.5}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 8 }}>
        <PreparationField label={productionText('worker.queue.search.sequence', locale)} initial={query} onChange={value => { setQuery(value); controller.searchChanged(value); }} />
        <PreparationRow title={t('Apparat')} subtitle={state.window?.apparatus.find(item => item.id === state.apparatus)?.name ?? ''} onPress={() => void choose()} />
        {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void controller.reload(true)} /></> : null}
        {state.loading && !state.rows.length ? <ActivityIndicator /> : null}
        {!state.loading && !state.error && !state.rows.length ? <PreparationText>{t('Mos buyurtma topilmadi.')}</PreparationText> : null}
      </View>}
      renderItem={({ item }) => <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <WorkerOrderThumbnail session={session} orderId={item.id} imageId={item.image_id} active backgroundColor={colors.surface} iconColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}><PreparationRow title={`${item.position}. ${item.code || item.order_number || item.id} · ${item.title}`}
          subtitle={item.customer_name} onPress={() => openOrder(item)} /></View>
      </View>}
      ListFooterComponent={state.window?.next_cursor ? <PreparationButton label="Yana yuklash" disabled={state.loading} onPress={() => void controller.loadMore()} /> : undefined} />
  </View>;
}
