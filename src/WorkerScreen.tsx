import { ListItem, Spacer } from '@expo/ui';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import type { Session } from './auth';
import { loadWorkerQueue, queueFromSnapshot, type WorkerQueue } from './workerApi';
import { OrderScreen } from './OrderScreen';
import { subscribeWorkerLive } from './workerLive';
import { WorkerHeader } from './components/WorkerHeader';
import { WorkerDrawer } from './components/WorkerDrawer';
import { WorkerTabs } from './components/WorkerTabs';
import { WorkerBottomBar } from './components/WorkerBottomBar';
import { WorkerFab } from './components/WorkerFab';
import { WorkerQrScanner } from './components/WorkerQrScanner';
import { WorkerProfile } from './components/WorkerProfile';
import { WorkerOrderListItem } from './components/WorkerOrderListItem';
import { useWorkerColors } from './components/useWorkerColors';
import { WorkerQueueList } from './components/WorkerQueueList';

type Props = { session: Session; onLogout: () => void };
const statusLabel: Record<string, string> = {
  pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida',
  paused: 'To‘xtatilgan', completed: 'Yakunlangan', frozen: 'Muzlatilgan',
  print_preflight: 'Rang moslash',
};

export function WorkerScreen({ session, onLogout }: Props) {
  const colors = useWorkerColors();
  const headerOffset = useSharedValue(0);
  const headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const [orderFontLoaded] = useFonts({
    'GoogleSans-Regular': require('../assets/fonts/GoogleSans-Regular.ttf'),
  });
  const orderFontFamily = orderFontLoaded ? 'GoogleSans-Regular' : undefined;
  const [queue, setQueue] = useState<WorkerQueue | null>(null);
  const [machineId, setMachineId] = useState('');
  const [activeOrder, setActiveOrder] = useState<{ apparatusId: string; orderId: string } | null>(null);
  const [section, setSection] = useState<'home' | 'profile'>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [navBarHeight, setNavBarHeight] = useState(80);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestGeneration = useRef(0);
  const queueRef = useRef<WorkerQueue | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const searchScope = search.trim().slice(0, 120);
  useEffect(() => {
    if (section === 'profile') headerOffset.set(0);
  }, [section, headerOffset]);
  const reload = useCallback(async (showLoading = false) => {
    const generation = ++requestGeneration.current;
    if (showLoading) setLoading(true);
    try {
      const result = await loadWorkerQueue(session, search);
      if (generation !== requestGeneration.current) return;
      const current = queueRef.current;
      const old = current?.snapshot;
      const next = result.snapshot;
      if (old && loadedScope === searchScope && old.epoch === next.epoch && old.scope === next.scope && typeof old.rev === 'number' && typeof next.rev === 'number' && old.rev > next.rev) return;
      queueRef.current = result;
      setQueue(result);
      setLoadedScope(searchScope);
      setMachineId(current => current === 'completed' || result.machines.some(machine => machine.id === current) ? current : (result.machines[0]?.id ?? ''));
      setError('');
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setError(e instanceof Error ? e.message : 'Navbatni yuklab bo‘lmadi.');
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [session, search, searchScope, loadedScope]);
  useEffect(() => {
    const timer = setTimeout(() => { void reload(true); }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [reload, search]);
  useEffect(() => {
    if (activeOrder || loadedScope !== searchScope || !queueRef.current) return;
    return subscribeWorkerLive(session, searchScope, () => { void reload(); }, undefined,
      () => queueRef.current?.snapshot ?? null,
      snapshot => {
        const current = queueRef.current;
        if (!current) return;
        const updated = queueFromSnapshot(current.machines, snapshot);
        requestGeneration.current++;
        queueRef.current = updated;
        setQueue(updated);
        setLoading(false);
      });
  }, [session, searchScope, reload, activeOrder, loadedScope]);

  if (activeOrder) return <OrderScreen session={session} apparatusId={activeOrder.apparatusId} orderId={activeOrder.orderId} onClose={() => setActiveOrder(null)} onChanged={() => { void reload(); }} />;
  const selectedMachine = queue?.machines.find(machine => machine.id === machineId);
  const completed = (queue?.completed ?? []).filter(order => !searchScope || [order.code, order.title, order.customer].some(value => value.toLocaleLowerCase().includes(searchScope.toLocaleLowerCase())));
  const scannerMachineId = selectedMachine?.id ?? queue?.machines[0]?.id ?? '';
  if (scannerOpen) return <WorkerQrScanner session={session} apparatusId={scannerMachineId} onClose={() => setScannerOpen(false)} onOrder={(apparatusId, orderId) => { setScannerOpen(false); setMachineId(apparatusId); setActiveOrder({ apparatusId, orderId }); }} />;
  function selectDestination(id: string) {
    if (id === 'home' || id === 'queue') { setSection('home'); return; }
    if (id === 'profile') { setSection('profile'); return; }
    if (id === 'logout') { onLogout(); return; }
    const labels: Record<string, string> = { chat: 'Chat', daily: 'Kunlik ishlar', paddons: 'Paddonlar', instructions: 'App yo‘riqnomasi', transfer: 'Joylashtirish va transfer' };
    Alert.alert(labels[id] ?? 'Bo‘lim', 'Bu bo‘lim hozircha tayyor emas.');
  }
  function openScanner() {
    if (!scannerMachineId) { Alert.alert('QR skanerlash', 'Avval aparatni tanlang.'); return; }
    setScannerOpen(true);
  }
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}>
    <WorkerHeader search={search} onSearchChange={setSearch} onMenu={() => setDrawerOpen(true)} onProfile={() => setSection('profile')} />
  </View>;
  return (
    <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)} onSelect={selectDestination} displayName={String(session.profile.display_name ?? '')} canTransfer={session.capabilities.includes('inventory.movement.manage')} active={section === 'profile' ? 'profile' : 'queue'}>
    <SafeAreaView edges={Platform.OS === 'android' ? ['top', 'left', 'right'] : undefined} style={[styles.safe, { backgroundColor: colors.background }]}>
      {Platform.OS !== 'android' || section === 'profile' ? header : null}
      {section === 'profile' ? <WorkerProfile session={session} onLogout={onLogout} /> : <>
      <WorkerTabs machines={queue?.machines ?? []} selected={machineId} onSelect={setMachineId} loading={loading && !queue} header={Platform.OS === 'android' ? header : undefined} headerOffset={headerOffset}>
        {(tabId, pagerGesture) => {
          const pageMachine = queue?.machines.find(machine => machine.id === tabId);
          const pageOrders = queue?.orders[tabId] ?? [];
          return <WorkerQueueList active={tabId === (machineId || 'completed')} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight} topInset={headerSize + 48} onRefresh={async () => { await reload(); }}>
          {error ? <ListItem supportingText={error} onPress={() => { void reload(true); }}>Qayta urinish</ListItem> : null}
          {queue && !queue.machines.length ? <ListItem supportingText="Administrator aparatni hisobingizga biriktirishi kerak.">Bosma aparati topilmadi</ListItem> : null}
          {tabId === 'completed' && !completed.length && !loading ? <ListItem>Tugallangan buyurtmalar yo‘q</ListItem> : null}
          {tabId === 'completed' ? completed.map((order, index) => (
            <WorkerOrderListItem key={`${order.apparatusId}:${order.id}`} first={index === 0} last={index === completed.length - 1} fontFamily={orderFontFamily}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.customer, order.completedAt ? new Date(order.completedAt * 1000).toLocaleString() : ''].filter(Boolean).join(' · ')}
              onPress={() => Alert.alert([order.code, order.title].filter(Boolean).join(' · '), [order.customer, order.issueNote].filter(Boolean).join('\n') || 'Tugallangan buyurtma')} />
          )) : null}
          {pageMachine && !pageOrders.length && !loading ? <ListItem>Buyurtmalar topilmadi</ListItem> : null}
          {tabId !== 'completed' ? pageOrders.map((order, index) => (
            <WorkerOrderListItem key={order.id} first={index === 0} last={index === pageOrders.length - 1} fontFamily={orderFontFamily}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.customer, statusLabel[order.state] ?? order.state].filter(Boolean).join(' · ')}
              onPress={() => setActiveOrder({ apparatusId: tabId, orderId: order.id })} />
          )) : null}
          <Spacer size={88} />
          </WorkerQueueList>;
        }}
      </WorkerTabs>
      </>}
      <View onLayout={event => setNavBarHeight(event.nativeEvent.layout.height)}>
        <WorkerBottomBar active={section} onSelect={selectDestination} onScan={openScanner} />
      </View>
      <WorkerFab onSelect={selectDestination} onScan={openScanner} bottomOffset={navBarHeight + insets.bottom + 16} />
    </SafeAreaView>
    </WorkerDrawer>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
});
