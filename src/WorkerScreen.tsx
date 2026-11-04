import { ListItem, Spacer } from '@expo/ui';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { updateSessionAssignments, type Session } from './auth';
import { canWorkOnApparatus, loadWorkerQueue, queueFromSnapshot, workerOrderIsFrozen, type CompletedOrder, type QueueOrder, type WorkerQueue } from './workerApi';
import { useNativeSheet } from './nativeSheet';
import { OrderScreen } from './OrderScreen';
import { subscribeWorkerLive } from './workerLive';
import { readWorkerActionControl, runWorkerMenuAction, workerLongPressMenu } from './workerLongPress';
import { WorkerHeader } from './components/WorkerHeader';
import { WorkerDrawer } from './components/WorkerDrawer';
import { WorkerTabs } from './components/WorkerTabs';
import { WorkerBottomBar } from './components/WorkerBottomBar';
import { WorkerFab } from './components/WorkerFab';
import { WorkerQrScanner } from './components/WorkerQrScanner';
import { ProfileScreen } from './components/ProfileScreen';
import { DailyWorkScreen } from './components/DailyWorkScreen';
import { WorkerOrderListItem } from './components/WorkerOrderListItem';
import { useWorkerColors } from './components/useWorkerColors';
import { WorkerQueueList } from './components/WorkerQueueList';
import { WorkerQueueFilter } from './components/WorkerQueueFilter';
import { WorkerOrderSheet } from './components/WorkerOrderSheet';
import { WorkerOrderDetails, WorkerOrderFreezeDetails } from './components/WorkerOrderDetails';
import { WorkerWipHistory, WorkerWipHistorySheet, type WorkerWipHistorySheetHandle } from './components/WorkerWipHistory';
import { WorkerLongPressActions, type WorkerActionChoice } from './components/WorkerLongPressActions';
import { WorkerAlert } from './components/WorkerAlert';
import type { WorkerAlertData } from './components/workerDialogTypes';
import { DEFAULT_QUEUE_LIMIT, loadQueueLimit, saveQueueLimit, type QueueLimit } from './workerQueueLimit';

type Props = { session: Session; onLogout: () => void; nativeNavigation?: boolean; onNavigate?: (id: 'profile' | 'chat' | 'daily') => void; onOpenDrawer?: () => void };
type ActiveOrder = { apparatusId: string; orderId: string; preview?: QueueOrder; readOnly?: boolean; initialAction?: 'complete' | 'astatka' };
type ActionScope = { window: string; scope: string };
type ActionOrder = { apparatusId: string; order: QueueOrder; completed: boolean };
const statusLabel: Record<string, string> = {
  pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida',
  paused: 'To‘xtatilgan', completed: 'Yakunlangan', frozen: 'Muzlatilgan',
  print_preflight: 'Rang moslash', print_preflight_passed: 'Rang chiqarildi',
  waiting_next_stage: 'Keyingi bosqich kutilmoqda', issue: 'Muammoli',
};

export function WorkerScreen({ session, onLogout, nativeNavigation = false, onNavigate, onOpenDrawer }: Props) {
  const colors = useWorkerColors();
  const headerOffset = useSharedValue(0);
  const headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const [orderFontLoaded] = useFonts({
    'GoogleSans-Regular': require('../assets/fonts/GoogleSans-Regular.ttf'),
    'GoogleSans-Medium': require('../assets/fonts/GoogleSans-Medium.ttf'),
  });
  const orderFontFamily = Platform.OS !== 'ios' && orderFontLoaded ? 'GoogleSans-Regular' : undefined;
  const orderHeadlineFontFamily = Platform.OS !== 'ios' && orderFontLoaded ? 'GoogleSans-Medium' : undefined;
  const [queue, setQueue] = useState<WorkerQueue | null>(null);
  const [machineId, setMachineId] = useState('');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const historySheet = useRef<WorkerWipHistorySheetHandle>(null);
  const [actionOrder, setActionOrder] = useState<ActionOrder | null>(null);
  const orderRoute = useNativeSheet();
  const historyRoute = useNativeSheet();
  const actionsRoute = useNativeSheet();
  const nativeOrder = useRef<ActiveOrder | null>(null);
  const nativeActions = useRef<ActionOrder | null>(null);
  const [section, setSection] = useState<'home' | 'profile' | 'daily'>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [navBarHeight, setNavBarHeight] = useState(80);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [queueLimit, setQueueLimit] = useState<QueueLimit>(DEFAULT_QUEUE_LIMIT);
  const [limitReady, setLimitReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const requestGeneration = useRef(0);
  const screenMounted = useRef(true);
  const queueRef = useRef<WorkerQueue | null>(null);
  const pendingAction = useRef<WorkerActionChoice | null>(null);
  const actionWrites = useRef(new Set<string>());
  const actionScope = useRef<ActionScope | null>(null);
  const preflightCheck = useRef(0);
  const preflightReopenBusy = useRef(false);
  const queueScopeRef = useRef<string | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const searchScope = search.trim().slice(0, 120);
  const windowScope = JSON.stringify([searchScope, queueLimit]);
  const currentWindow = useRef(windowScope);
  useEffect(() => { currentWindow.current = windowScope; }, [windowScope]);
  useEffect(() => { preflightCheck.current++; }, [session, windowScope, machineId, activeOrder, actionOrder, section, scannerOpen, alert]);
  useEffect(() => {
    let mounted = true;
    void loadQueueLimit(session).then(limit => { if (mounted) { setQueueLimit(limit); setLimitReady(true); } });
    return () => { mounted = false; };
  }, [session]);
  useEffect(() => {
    if (section !== 'home') headerOffset.set(0);
  }, [section, headerOffset]);
  const reload = useCallback(async (showLoading = false) => {
    if (!limitReady) return;
    const generation = ++requestGeneration.current;
    if (showLoading) setLoading(true);
    try {
      const result = await loadWorkerQueue(session, search, queueLimit);
      if (generation !== requestGeneration.current) return;
      const current = queueRef.current;
      const old = current?.snapshot;
      const next = result.snapshot;
      if (old && queueScopeRef.current === windowScope && old.epoch === next.epoch && old.scope === next.scope && typeof old.rev === 'number' && typeof next.rev === 'number' && old.rev > next.rev) return;
      if (!updateSessionAssignments(session, result.assignedIds, result.assignedLabels)) return;
      queueRef.current = result;
      queueScopeRef.current = windowScope;
      setQueue(result);
      setLoadedScope(windowScope);
      setMachineId(current => current === 'completed' || result.machines.some(machine => machine.id === current) ? current : (result.machines[0]?.id ?? ''));
      setError('');
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setError(e instanceof Error ? e.message : 'Navbatni yuklab bo‘lmadi.');
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [session, search, queueLimit, windowScope, limitReady]);
  const latestReload = useRef(reload);
  useEffect(() => { latestReload.current = reload; }, [reload]);
  useEffect(() => { screenMounted.current = true; return () => { screenMounted.current = false; }; }, []);
  const renderOrderRoute = useCallback((target: ActiveOrder, onClose = orderRoute.close) => {
    if (target.readOnly && target.preview) return <WorkerOrderDetails session={session}
      apparatusId={target.apparatusId}
      order={target.preview} queueCursor={queueRef.current?.snapshot ?? null} onClose={onClose} />;
    return <OrderScreen session={session} apparatusId={target.apparatusId} orderId={target.orderId} preview={target.preview}
      queueCursor={queueRef.current?.snapshot ?? null} initialAction={target.initialAction}
      onClose={onClose} onChanged={() => { void latestReload.current(); }} />;
  }, [session, orderRoute]);
  useEffect(() => {
    if (nativeOrder.current) orderRoute.update(renderOrderRoute(nativeOrder.current));
  }, [queue, orderRoute, renderOrderRoute]);
  function openOrder(target: ActiveOrder) {
    if (Platform.OS !== 'android') { setActiveOrder(target); return; }
    if (workerOrderIsFrozen(queueRef.current?.snapshot, target.orderId)) {
      ToastAndroid.show('Buyurtma muzlatilgan. Adminga xabar bering.', ToastAndroid.LONG);
      return;
    }
    if (orderRoute.isOpen()) return;
    preflightCheck.current++;
    nativeOrder.current = target;
    orderRoute.open(renderOrderRoute(target), { onDismiss: () => {
      nativeOrder.current = null;
      preflightCheck.current++;
    } });
  }
  function openHistory(order: CompletedOrder) {
    preflightCheck.current++;
    if (Platform.OS !== 'android') { historySheet.current?.open(order); return; }
    if (workerOrderIsFrozen(queueRef.current?.snapshot, order.id)) return;
    const apparatusNames = Object.fromEntries(queueRef.current?.machines.map(machine => [machine.id, machine.name]) ?? []);
    if (order.issueNote) {
      historyRoute.open(<WorkerOrderFreezeDetails order={order} apparatusName={apparatusNames[order.apparatusId] ?? ''} onClose={historyRoute.close} />,
        { dismissible: true, compact: true, onDismiss: () => { preflightCheck.current++; } });
      return;
    }
    historyRoute.open(<WorkerWipHistory session={session} order={order} apparatusNames={apparatusNames} onClose={historyRoute.close} />,
      { dismissible: true, onDismiss: () => { preflightCheck.current++; } });
  }
  const scopedCursor = useCallback((expected: ActionScope | null) => {
    const snapshot = queueRef.current?.snapshot;
    return expected && currentWindow.current === expected.window && queueScopeRef.current === expected.window && snapshot?.scope === expected.scope ? snapshot : null;
  }, []);
  const getActionCursor = useCallback(() => scopedCursor(actionScope.current), [scopedCursor]);
  const chooseOrderAction = useCallback((action: WorkerActionChoice) => { pendingAction.current = action; }, []);
  useEffect(() => {
    if (!limitReady) return;
    const timer = setTimeout(() => { void reload(true); }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [reload, search, limitReady]);
  useEffect(() => {
    if (loadedScope !== windowScope || !queueRef.current) return;
    return subscribeWorkerLive(session, searchScope, () => { void reload(); }, undefined,
      () => queueRef.current?.snapshot ?? null,
      snapshot => {
        const current = queueRef.current;
        if (!current) return;
        const updated = queueFromSnapshot(current.machines, snapshot, current.assignedIds, current.assignedLabels);
        requestGeneration.current++;
        queueRef.current = updated;
        setQueue(updated);
        setLoading(false);
      }, queueLimit);
  }, [session, searchScope, windowScope, queueLimit, reload, loadedScope]);

  const selectedMachine = queue?.machines.find(machine => machine.id === machineId);
  const completedMatches = (queue?.completed ?? []).filter(order => !searchScope || [order.code, order.title, order.customer].some(value => value.toLocaleLowerCase().includes(searchScope.toLocaleLowerCase())));
  const completed = queueLimit === 0 ? completedMatches : completedMatches.slice(0, queueLimit);
  const canWorkMachine = (id: string) => canWorkOnApparatus(queue?.machines.find(machine => machine.id === id), session.assigned_apparatus);
  const scannerMachineId = selectedMachine ? (canWorkMachine(selectedMachine.id) ? selectedMachine.id : '') : queue?.machines.find(machine => canWorkMachine(machine.id))?.id ?? '';
  const scanner = scannerOpen ? <WorkerQrScanner session={session} apparatusId={scannerMachineId} onClose={() => setScannerOpen(false)} onOrder={(apparatusId, orderId) => { setScannerOpen(false); setMachineId(apparatusId); openOrder({ apparatusId, orderId }); }} /> : null;
  if (scannerOpen && !nativeNavigation) return scanner;
  function selectDestination(id: string) {
    if (id === 'home' || id === 'queue') { setSection('home'); return; }
    if (id === 'profile') { if (nativeNavigation) onNavigate?.('profile'); else setSection('profile'); return; }
    if (id === 'daily') { if (nativeNavigation) onNavigate?.('daily'); else setSection('daily'); return; }
    if (id === 'chat' && nativeNavigation) { onNavigate?.('chat'); return; }
    if (id === 'logout') { onLogout(); return; }
    const labels: Record<string, string> = { chat: 'Chat', paddons: 'Paddonlar', instructions: 'App yo‘riqnomasi', transfer: 'Joylashtirish va transfer' };
    setAlert({ title: labels[id] ?? 'Bo‘lim', message: 'Bu bo‘lim hozircha tayyor emas.' });
  }
  function openScanner() {
    if (!scannerMachineId) { setAlert({ title: 'QR skanerlash', message: 'Avval o‘zingizga biriktirilgan bosma aparatni tanlang.' }); return; }
    setScannerOpen(true);
  }
  async function openPreflightConfirmation(apparatusId: string, orderId: string, scope: string) {
    if (preflightReopenBusy.current) return;
    const generation = ++preflightCheck.current;
    const expectedWindow = windowScope;
    const getCursor = () => {
      const snapshot = queueRef.current?.snapshot;
      return currentWindow.current === expectedWindow && queueScopeRef.current === expectedWindow && snapshot?.scope === scope ? snapshot : null;
    };
    try {
      const data = await readWorkerActionControl(session, apparatusId, orderId, getCursor);
      if (!screenMounted.current || generation !== preflightCheck.current) return;
      const menu = workerLongPressMenu(data, session, apparatusId, orderId, getCursor());
      if (menu.kind !== 'reopen') { void latestReload.current(); return; }
      setAlert({ title: 'Rang chiqarilyapti holatiga qaytarish', message: 'Rostdan ham rang chiqarilyapti holatiga qaytarmoqchimisiz?', confirmLabel: 'Ruxsat', onConfirm: () => {
        if (preflightReopenBusy.current) return;
        preflightReopenBusy.current = true;
        void (async () => {
          let message = '';
          try {
            await runWorkerMenuAction(session, apparatusId, orderId, 'reopen', menu, getCursor);
          } catch { message = 'Amal tasdiqlanmadi. Buyurtmaning joriy holati yangilanmoqda.'; }
          finally { preflightReopenBusy.current = false; }
          if (screenMounted.current) {
            void latestReload.current();
            if (message) setAlert(current => current ?? { title: 'Buyurtma', message });
          }
        })();
      } });
    } catch (e) {
      if (screenMounted.current && generation === preflightCheck.current) {
        void latestReload.current();
        setAlert({ title: 'Buyurtma', message: e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi.' });
      }
    }
  }
  function openOrderActions(apparatusId: string, order: QueueOrder, isCompleted: boolean) {
    if (!canWorkMachine(apparatusId) || actionWrites.current.has(JSON.stringify([apparatusId, order.id]))) return;
    if (Platform.OS === 'android' && actionsRoute.isOpen()) return;
    preflightCheck.current++;
    const scope = queueRef.current?.snapshot.scope;
    if (loadedScope !== windowScope || typeof scope !== 'string' || !scope) { setAlert({ title: 'Navbat yangilanmoqda', message: 'Buyurtmani ochishdan avval yangilanishini kuting.' }); return; }
    if (!isCompleted && order.state === 'print_preflight_passed') { void openPreflightConfirmation(apparatusId, order.id, scope); return; }
    actionScope.current = { window: windowScope, scope };
    pendingAction.current = null;
    const target = { apparatusId, order, completed: isCompleted };
    if (Platform.OS === 'android') {
      nativeActions.current = target;
      actionsRoute.open(<WorkerLongPressActions session={session} apparatusId={apparatusId}
        apparatusName={queue?.machines.find(machine => machine.id === apparatusId)?.name ?? apparatusId}
        order={order} completed={isCompleted} getCursor={getActionCursor}
        onChoose={chooseOrderAction} />,
      { dismissible: true, compact: true, onDismiss: closeOrderActions });
    } else setActionOrder(target);
  }
  function closeOrderActions() {
    const target = Platform.OS === 'android' ? nativeActions.current : actionOrder;
    const action = pendingAction.current;
    const expected = actionScope.current;
    nativeActions.current = null;
    actionScope.current = null;
    pendingAction.current = null;
    if (!screenMounted.current) return;
    if (Platform.OS !== 'android') setActionOrder(null);
    preflightCheck.current++;
    if (!target || !action) return;
    if (typeof action === 'string') {
      openOrder({ apparatusId: target.apparatusId, orderId: target.order.id, preview: target.order, initialAction: action });
      return;
    }
    const key = JSON.stringify([target.apparatusId, target.order.id]);
    const readCursor = () => screenMounted.current ? scopedCursor(expected) : null;
    const run = async () => {
      if (actionWrites.current.has(key) || !screenMounted.current) return;
      if (!readCursor()) {
        void latestReload.current();
        setAlert({ title: 'Buyurtma', message: 'Buyurtma holati o‘zgardi. Qayta urining.' });
        return;
      }
      actionWrites.current.add(key);
      let message: string;
      try { message = await action.run(readCursor); }
      catch { message = 'Amal tasdiqlanmadi. Buyurtmaning joriy holati yangilanmoqda.'; }
      finally { actionWrites.current.delete(key); }
      if (screenMounted.current) {
        void latestReload.current();
        if (message && Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.LONG);
        else if (message) setAlert(current => current ?? { title: 'Buyurtma', message });
      }
    };
    if (action.confirmation) setAlert({ ...action.confirmation, onConfirm: () => { void run(); } });
    else void run();
  }
  const openDrawer = onOpenDrawer ?? (() => setDrawerOpen(true));
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}>
    <WorkerHeader search={search} onSearchChange={setSearch} onMenu={openDrawer} onProfile={() => selectDestination('profile')} />
  </View>;
  const content = (
    <SafeAreaView edges={nativeNavigation ? [] : Platform.OS === 'android' || Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={[styles.safe, { backgroundColor: colors.background }]}>
      {!nativeNavigation && section !== 'daily' && (Platform.OS !== 'android' || section === 'profile') ? header : null}
      {section === 'profile' ? <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => setSection('daily')} /> : section === 'daily'
        ? <DailyWorkScreen session={session} onOpenDrawer={openDrawer} onBack={() => setSection('home')} /> : <>
      <WorkerTabs session={session} machines={queue?.machines ?? []} selected={machineId} onSelect={setMachineId} loading={loading && !queue} header={Platform.OS === 'android' ? header : undefined} headerOffset={headerOffset} fontFamily={orderHeadlineFontFamily} search={search} onSearchChange={setSearch} onMenu={openDrawer} onProfile={() => selectDestination('profile')}>
        {(tabId, pagerGesture, machinePicker) => {
          const pageMachine = queue?.machines.find(machine => machine.id === tabId);
          const canWork = canWorkMachine(tabId);
          const pageOrders = queue?.orders[tabId] ?? [];
          const pageActive = tabId === (machineId || 'completed');
          return <WorkerQueueList active={pageActive} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight} topInset={headerSize + 48} onRefresh={async () => { await reload(); }}>
          <WorkerQueueFilter key="queue-filter" machinePicker={machinePicker} value={queueLimit} enabled={limitReady} loading={!!queue && loading && loadedScope !== windowScope} backgroundColor={colors.surface} onChange={limit => {
            if (limit === queueLimit) return;
            requestGeneration.current++;
            queueRef.current = null;
            queueScopeRef.current = null;
            setLoadedScope(null);
            setLoading(true);
            setQueueLimit(limit);
            void saveQueueLimit(session, limit).catch(() => {});
          }} />
          {error ? <ListItem supportingText={error} onPress={() => { void reload(true); }}>Qayta urinish</ListItem> : null}
          {queue && !queue.machines.length ? <ListItem supportingText="Administrator aparatni hisobingizga biriktirishi kerak.">Bosma aparati topilmadi</ListItem> : null}
          {tabId === 'completed' && !completed.length && !loading ? <ListItem>Tugallangan buyurtmalar yo‘q</ListItem> : null}
          {tabId === 'completed' ? completed.map((order, index) => (
            <WorkerOrderListItem key={`${order.apparatusId}:${order.id}`} last={index === completed.length - 1} fontFamily={orderFontFamily} headlineFontFamily={orderHeadlineFontFamily}
              session={session} orderId={order.id} imageId={order.imageId} imageActive={pageActive} cardTone={order.cardTone}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.customer, order.completedAt ? new Date(order.completedAt * 1000).toLocaleString() : ''].filter(Boolean).join(' · ')}
              onPress={() => openHistory(order)}
              onLongPress={!order.issueNote.trim() && canWorkMachine(order.apparatusId) ? () => openOrderActions(order.apparatusId, order, true) : undefined} />
          )) : null}
          {pageMachine && !pageOrders.length && !loading ? <ListItem>Buyurtmalar topilmadi</ListItem> : null}
          {tabId !== 'completed' ? pageOrders.map((order, index) => (
            <WorkerOrderListItem key={order.id} last={index === pageOrders.length - 1} fontFamily={orderFontFamily} headlineFontFamily={orderHeadlineFontFamily}
              session={session} orderId={order.id} imageId={order.imageId} imageActive={pageActive} cardTone={order.cardTone}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.customer, statusLabel[order.state] ?? order.state].filter(Boolean).join(' · ')}
              statusText={statusLabel[order.state] ?? order.state} statusDetail={order.customer}
              onLongPress={canWork ? () => openOrderActions(tabId, order, false) : undefined}
              onPress={() => {
                if (loadedScope !== windowScope) { setAlert({ title: 'Navbat yangilanmoqda', message: 'Buyurtmani ochishdan avval yangilanishini kuting.' }); return; }
                openOrder({ apparatusId: tabId, orderId: order.id, preview: order, readOnly: !canWork });
              }} />
          )) : null}
          {Platform.OS !== 'ios' && <Spacer size={88} />}
          </WorkerQueueList>;
        }}
      </WorkerTabs>
      </>}
      {!nativeNavigation && <View onLayout={event => setNavBarHeight(event.nativeEvent.layout.height)}>
        <WorkerBottomBar active={section} onSelect={selectDestination} onScan={openScanner} />
      </View>}
      {section !== 'daily' ? <WorkerFab onSelect={selectDestination} onScan={openScanner} bottomOffset={nativeNavigation ? 88 : navBarHeight + insets.bottom + 16} /> : null}
      {activeOrder ? <WorkerOrderSheet onClose={() => setActiveOrder(null)}>
        {renderOrderRoute(activeOrder, () => setActiveOrder(null))}
      </WorkerOrderSheet> : null}
      {Platform.OS !== 'android' && <WorkerWipHistorySheet ref={historySheet} session={session} onDismiss={() => { preflightCheck.current++; }} />}
      {actionOrder ? <WorkerOrderSheet dismissible compact onClose={closeOrderActions}>
        <WorkerLongPressActions session={session} apparatusId={actionOrder.apparatusId} apparatusName={queue?.machines.find(machine => machine.id === actionOrder.apparatusId)?.name ?? actionOrder.apparatusId} order={actionOrder.order} completed={actionOrder.completed} getCursor={getActionCursor} onChoose={chooseOrderAction} />
      </WorkerOrderSheet> : null}
      <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
      {nativeNavigation && scannerOpen && <Modal visible presentationStyle="fullScreen" animationType="slide" onRequestClose={() => setScannerOpen(false)}>{scanner}</Modal>}
    </SafeAreaView>
  );
  if (nativeNavigation) return content;
  return <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)} onSelect={selectDestination} displayName={String(session.profile.display_name ?? '')} canTransfer={session.capabilities.includes('inventory.movement.manage')} active={section === 'home' ? 'queue' : section}>{content}</WorkerDrawer>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
});
