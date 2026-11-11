import { workerPaddonListRoute } from './workerPaddonNavigation';
import { ListItem, Spacer } from '@expo/ui';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Modal, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, type Session, type SessionWitness } from './auth';
import { prepareWorkerFabQr, workerFabErrorText } from './workerFabQr';
import { workerFabQrReads } from './workerFabQrReads';
import { sessionReadScope } from './sessionReadScope';
import { canWorkOnApparatus, workerOrderIsFrozen, type CompletedOrder, type QueueOrder, type WorkerQueue } from './workerApi';
import { useNativeSheet } from './nativeSheet';
import { OrderScreen } from './OrderScreen';
import { workerOrderBusyTitle } from './workerOrderBlocking';
import { useWorkerQueue } from './components/useWorkerQueue';
import { workerQueueReadCanRetry } from './workerQueueReadError';
import { WorkerQueueConnectionProgress } from './components/WorkerQueueConnectionProgress';
import { readWorkerActionControl, runWorkerMenuAction, workerLongPressMenu, type WorkerMenu } from './workerLongPress';
import { prepareWorkerLongPress, type WorkerPreparedActionSheet } from './workerLongPressPreparation';
import { workerLongPressFeedback } from './workerLongPressFeedback';
import { MobileApiException } from './shared/mobileApiException';
import { WorkerControlException } from './workerControlsApi';
import { WorkerHeader } from './components/WorkerHeader';
import { WorkerDrawer } from './components/WorkerDrawer';
import { WorkerTabs } from './components/WorkerTabs';
import { WorkerBottomBar } from './components/WorkerBottomBar';
import { WorkerFab } from './components/WorkerFab';
import { WorkerQrScanner } from './components/WorkerQrScanner';
import { WorkerWorkInstructions } from './components/WorkerWorkInstructions';
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
import { DEFAULT_QUEUE_LIMIT, QUEUE_LIMITS, loadQueueLimit, saveQueueLimit, type QueueLimit } from './workerQueueLimit';
import { workerQueueSearch } from './workerQueueWindow';
import { useWorkerOrderText } from './components/useWorkerOrderText';
import { workerPaddonApparatus } from './workerActivePaddon';
import { useWorkerActivePaddon } from './components/useWorkerActivePaddon';
import { WorkerActivePaddonButton, WorkerActivePaddonPicker } from './components/WorkerActivePaddon';
import { WorkerPaddonFeedback } from './components/WorkerPaddonFeedback';
import { WorkerPaddons } from './components/WorkerPaddons';
import { OrdersHeader } from './shared/orders/OrdersHeader';
import { WorkerPeremotkaButton, WorkerPeremotkaSheet } from './components/WorkerPeremotka';
import { useWorkerPeremotka } from './components/useWorkerPeremotka';
import { WorkerCutToolbar } from './components/WorkerCutToolbar';
import { openWorkerCutPanel } from './workerPeremotka';
import { WorkerSheetPresentation } from './workerSheetPresentation';
import { workerDailyWorkVisible, workerInventoryVisible } from './workerNavigation';
import { workerQueueLimitLabels } from './workerQueuePresentation';
import { WorkerInventoryScreen } from './components/WorkerInventoryScreen';

type Props = { session: Session; onLogout: () => void; nativeNavigation?: boolean; onNavigate?: (id: 'profile' | 'chat' | 'daily') => void; onOpenDrawer?: () => void };
type ActiveOrder = { apparatusId: string; orderId: string; preview?: QueueOrder; readOnly?: boolean; initialAction?: 'complete' | 'astatka' | 'resume' | 'detach_roll'; initialScanQr?: string; initialSwitchQr?: string; presentationId?: number; onClose?: () => void };
type ActionScope = { window: string; scope: string; readScope: string; witness: SessionWitness | null };
type ActionOrder = { apparatusId: string; order: QueueOrder; completed: boolean; prepared: WorkerPreparedActionSheet; presentationId?: number; onChoose: (action: WorkerActionChoice) => void };

export function WorkerScreen({ session, onLogout, nativeNavigation = false, onNavigate, onOpenDrawer }: Props) {
  const colors = useWorkerColors();
  const { p, t, locale } = useWorkerOrderText();
  const queueStateLabels: Record<string, string> = {
    pending: p('worker.queue.status.pending'), in_progress: p('worker.queue.status.in_progress'),
    paused: p('worker.queue.status.paused'), frozen: p('worker.queue.status.frozen'),
    print_preflight: p('worker.queue.status.print_preflight'), print_preflight_passed: p('worker.queue.status.print_preflight_passed'),
    waiting_next_stage: p('worker.qr.order_status.waiting_next_stage'), issue: p('worker.qr.order_status.completed_with_issue'),
    completed: p('worker.queue.status.completed'), history_completed: p('worker.queue.status.completed'),
    history_partial: p('worker.queue.status.completed_partial'),
  };
  const queueStatusLabel = (order: QueueOrder) => queueStateLabels[order.cardTone] ?? queueStateLabels[order.state] ?? queueStateLabels.pending;
  const synchronizationError = p('worker.error.sync');
  const headerOffset = useSharedValue(0);
  const headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const [orderFontLoaded] = useFonts({
    'GoogleSans-Regular': require('../assets/fonts/GoogleSans-Regular.ttf'),
    'GoogleSans-Medium': require('../assets/fonts/GoogleSans-Medium.ttf'),
  });
  const orderFontFamily = Platform.OS !== 'ios' && orderFontLoaded ? 'GoogleSans-Regular' : undefined;
  const orderHeadlineFontFamily = Platform.OS !== 'ios' && orderFontLoaded ? 'GoogleSans-Medium' : undefined;
  const [orderNotice, setOrderNotice] = useState('');
  useEffect(() => {
    if (!orderNotice) return;
    const timer = setTimeout(() => setOrderNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [orderNotice]);
  const [machineSelection, setMachineId] = useState('');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [nativeOverlayOpen, setNativeOverlayOpen] = useState(false);
  const historySheet = useRef<WorkerWipHistorySheetHandle>(null);
  const [actionOrder, setActionOrder] = useState<ActionOrder | null>(null);
  const sheetPresentation = useRef(new WorkerSheetPresentation());
  const [historyPresentation, setHistoryPresentation] = useState<number | null>(null);
  const orderRoute = useNativeSheet();
  const historyRoute = useNativeSheet();
  const actionsRoute = useNativeSheet();
  const nativeOrder = useRef<ActiveOrder | null>(null);
  const nativeActions = useRef<ActionOrder | null>(null);
  const [section, setSection] = useState<'home' | 'profile' | 'daily' | 'instructions' | 'paddons' | 'inventory'>('home');
  const [paddonApparatus, setPaddonApparatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const pendingScannedOrder = useRef<{ target: ActiveOrder; scope: string; witness: SessionWitness | null; window: string } | null>(null);
  const pendingQrSwitch = useRef<{ apparatusId: string; qr: string; scope: string; window: string; witness: SessionWitness | null; committed: boolean } | null>(null);
  const qrLocation = useRef({ machine: '', window: '' });
  const [navBarHeight, setNavBarHeight] = useState(80);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [queueLimit, setQueueLimit] = useState<QueueLimit>(DEFAULT_QUEUE_LIMIT);
  const [limitReady, setLimitReady] = useState(false);
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const screenMounted = useRef(true);
  const queueRef = useRef<WorkerQueue | null>(null);
  const pendingAction = useRef<WorkerActionChoice | null>(null);
  const actionWrites = useRef(new Set<string>());
  const actionScope = useRef<ActionScope | null>(null);
  const actionOpening = useRef<{ controller: AbortController; presentationId?: number } | null>(null);
  const cancelActionOpening = useCallback(() => {
    const pending = actionOpening.current;
    actionOpening.current = null;
    if (!pending) return;
    pending.controller.abort();
    if (pending.presentationId !== undefined) sheetPresentation.current.dismiss(pending.presentationId);
  }, []);
  useFocusEffect(useCallback(() => cancelActionOpening, [cancelActionOpening]));
  const preflightCheck = useRef(0);
  const preflightReopenBusy = useRef(false);
  const queueScopeRef = useRef<string | null>(null);
  const searchScope = workerQueueSearch(search);
  const windowScope = JSON.stringify([searchScope, queueLimit]);
  const currentWindow = useRef(windowScope);
  const queueState = useWorkerQueue(session, searchScope, queueLimit, limitReady);
  const { queue, loading, loadedWindow: loadedScope, reload } = queueState;
  const machineId = machineSelection === 'completed' || queue?.machines.some(machine => machine.id === machineSelection) ? machineSelection : (queue?.machines[0]?.id ?? '');
  const retryingQueue = !!queueState.error && workerQueueReadCanRetry(queueState.error);
  const error = queueState.error && !retryingQueue ? (queueState.error instanceof Error ? queueState.error.message : p('worker.error.sync')) : '';
  const synchronizedQueue = useRef(false);
  useLayoutEffect(() => {
    currentWindow.current = windowScope;
    queueRef.current = queue;
    queueScopeRef.current = loadedScope;
    synchronizedQueue.current = queueState.synchronized;
  }, [windowScope, queue, loadedScope, queueState.synchronized]);
  useEffect(() => { preflightCheck.current++; }, [session, windowScope, machineId, activeOrder, actionOrder, section, scannerOpen, alert]);
  useEffect(() => {
    let mounted = true;
    void loadQueueLimit(session).then(limit => { if (mounted) setQueueLimit(limit); }).catch(() => {}).finally(() => { if (mounted) setLimitReady(true); });
    return () => { mounted = false; };
  }, [session]);
  useEffect(() => {
    if (section !== 'home') headerOffset.set(0);
  }, [section, headerOffset]);
  const latestReload = useRef(reload);
  useEffect(() => { latestReload.current = reload; }, [reload]);
  const onWritePending = useCallback((pending: boolean) => queueState.controller.setWritePending(pending), [queueState.controller]);
  const readScope = sessionReadScope(session), previousReadScope = useRef(readScope);
  useLayoutEffect(() => () => cancelActionOpening(),
    [session, readScope, windowScope, machineId, section, scannerOpen, drawerOpen, cancelActionOpening]);
  useEffect(() => {
    if (previousReadScope.current === readScope) return;
    previousReadScope.current = readScope;
    setActiveOrder(null); setActionOrder(null); setScannerOpen(false);
    nativeOrder.current = null; nativeActions.current = null;
    sheetPresentation.current.reset(); setHistoryPresentation(null);
    orderRoute.close(); actionsRoute.close(); historyRoute.close();
  }, [readScope, orderRoute, actionsRoute, historyRoute]);
  useEffect(() => { screenMounted.current = true; return () => { screenMounted.current = false; }; }, []);
  useLayoutEffect(() => { qrLocation.current = { machine: machineId, window: windowScope }; }, [machineId, windowScope]);
  const renderOrderRoute = useCallback((target: ActiveOrder, onClose = orderRoute.close) => {
    if (target.readOnly && target.preview) return <WorkerOrderDetails session={session}
      apparatusId={target.apparatusId}
      order={target.preview} queueCursor={queueState.synchronized ? queueRef.current?.snapshot ?? null : null} queueWindow={windowScope} onClose={onClose} />;
    return <OrderScreen key={`${target.apparatusId}:${target.orderId}`} session={session} apparatusId={target.apparatusId} orderId={target.orderId} preview={target.preview}
      initialScanQr={target.initialScanQr} initialSwitchQr={target.initialSwitchQr}
      onSwitchCommitted={() => { const pending = pendingQrSwitch.current; if (pending && isSessionWitnessCurrent(pending.witness)) pending.committed = true; }}
      queueCursor={queueState.synchronized ? queueRef.current?.snapshot ?? null : null} busyOrderTitle={workerOrderBusyTitle(queueRef.current, target.apparatusId, target.orderId)}
      apparatusCatalog={queueRef.current?.catalog} apparatus={queueRef.current?.machines.find(machine => machine.id === target.apparatusId)} initialAction={target.initialAction} queueWindow={windowScope}
      onWritePending={onWritePending} onNotice={setOrderNotice} onClose={onClose} onChanged={() => { void latestReload.current(); }} />;
  }, [session, orderRoute, windowScope, queueState.synchronized, onWritePending]);
  useEffect(() => {
    if (nativeOrder.current) orderRoute.update(renderOrderRoute(nativeOrder.current));
  }, [queue, orderRoute, renderOrderRoute]);
  function openOrder(target: ActiveOrder) {
    if (actionOpening.current) return;
    if (Platform.OS !== 'android' && sheetPresentation.current.isOpen()) return;
    if (workerOrderIsFrozen(queueRef.current?.snapshot, target.orderId)) {
      setOrderNotice('Buyurtma muzlatilgan. Adminga xabar bering.');
      return;
    }
    if (Platform.OS !== 'android') {
      const presentationId = sheetPresentation.current.open();
      if (presentationId === null) return;
      setActiveOrder({ ...target, presentationId, onClose: () => closeOrder(presentationId) });
      return;
    }
    if (orderRoute.isOpen()) return;
    preflightCheck.current++;
    nativeOrder.current = target;
    setNativeOverlayOpen(true);
    orderRoute.open(renderOrderRoute(target), { onDismiss: () => {
      nativeOrder.current = null;
      setNativeOverlayOpen(false);
      preflightCheck.current++;
      finishQrOrderDismissal();
    } });
  }
  function closeOrder(presentationId: number) {
    if (!sheetPresentation.current.dismiss(presentationId)) return;
    setActiveOrder(current => current?.presentationId === presentationId ? null : current);
    finishQrOrderDismissal();
  }
  function openHistory(order: CompletedOrder) {
    if (actionOpening.current) return;
    if (Platform.OS !== 'android' && sheetPresentation.current.isOpen()) return;
    preflightCheck.current++;
    if (Platform.OS !== 'android') {
      if (!historySheet.current) return;
      const presentationId = sheetPresentation.current.open();
      if (presentationId === null) return;
      setHistoryPresentation(presentationId);
      setNativeOverlayOpen(true);
      const catalog = queueRef.current?.catalog ?? queueRef.current?.machines ?? [];
      historySheet.current.open(order, Object.fromEntries(catalog.map(machine => [machine.id, machine.name])),
        catalog.find(machine => machine.id === order.apparatusId), () => { void latestReload.current(); }, onWritePending);
      return;
    }
    if (workerOrderIsFrozen(queueRef.current?.snapshot, order.id)) return;
    setNativeOverlayOpen(true);
    const apparatusNames = Object.fromEntries(queueRef.current?.machines.map(machine => [machine.id, machine.name]) ?? []);
    if (order.issueNote) {
      historyRoute.open(<WorkerOrderFreezeDetails order={order} apparatusName={apparatusNames[order.apparatusId] ?? ''} onClose={historyRoute.close} />,
        { dismissible: true, compact: true, onDismiss: () => { setNativeOverlayOpen(false); preflightCheck.current++; } });
      return;
    }
    const operation = (queueRef.current?.catalog ?? queueRef.current?.machines)?.find(machine => machine.id === order.apparatusId)?.operation ?? '';
    historyRoute.open(<WorkerWipHistory session={session} order={order} apparatusNames={apparatusNames} operation={operation}
      allowReactivation={['laminate', 'glue', 'cut'].includes(operation)} onReactivationAttempted={() => { void latestReload.current(); }}
      onWritePending={onWritePending} onClose={historyRoute.close} />,
      { dismissible: true, onDismiss: () => { setNativeOverlayOpen(false); preflightCheck.current++; } });
  }
  const scopedCursor = useCallback((expected: ActionScope | null) => {
    const snapshot = queueRef.current?.snapshot;
    return synchronizedQueue.current && expected && currentWindow.current === expected.window && queueScopeRef.current === expected.window && snapshot?.scope === expected.scope ? snapshot : null;
  }, []);
  const actionContextCurrent = useCallback((expected: ActionScope | null) => !!expected && screenMounted.current &&
    !!activeSessionToken(session) && isSessionWitnessCurrent(expected.witness) && expected.readScope === sessionReadScope(session) &&
    currentWindow.current === expected.window, [session]);
  const chooseOrderAction = useCallback((action: WorkerActionChoice) => { pendingAction.current = action; }, []);

  const selectedMachine = queue?.machines.find(machine => machine.id === machineId);
  const completedMatches = (queue?.completed ?? []).filter(order => !searchScope || [order.code, order.title, order.customer].some(value => value.toLocaleLowerCase().includes(searchScope.toLocaleLowerCase())));
  const completed = queueLimit === 0 ? completedMatches : completedMatches.slice(0, queueLimit);
  const canWorkMachine = (id: string) => canWorkOnApparatus(queue?.machines.find(machine => machine.id === id), session.assigned_apparatus);
  const scannerMachineId = selectedMachine && canWorkMachine(selectedMachine.id) ? selectedMachine.id : '';
  const paddonMachine = workerPaddonApparatus(queue?.machines ?? [], machineId, session.assigned_apparatus);
  const cutVisible = section === 'home' && queueState.synchronized && loadedScope === windowScope && !drawerOpen && !scannerOpen && !activeOrder && !actionOrder && !nativeOverlayOpen;
  const peremotka = useWorkerPeremotka(session, paddonMachine?.id ?? '', cutVisible);
  const activePaddon = useWorkerActivePaddon(session, paddonMachine?.id ?? '',
    cutVisible && peremotka.state.phase === 'closed',
    JSON.stringify([queue?.snapshot.epoch, queue?.snapshot.rev, queue?.snapshot.scope]));
  useEffect(() => { preflightCheck.current++; }, [activePaddon.state.busy]);
  function finishQrScan(apparatusId: string, orderId: string, qr: string, switching = false, cameraDismissed = false) {
    const target: ActiveOrder = { apparatusId, orderId, ...(switching ? { initialSwitchQr: qr } : { initialScanQr: qr }) };
    pendingQrSwitch.current = switching ? { apparatusId, qr, scope: sessionReadScope(session), window: windowScope, witness: captureSessionWitness(session), committed: false } : null;
    setMachineId(apparatusId);
    if (!cameraDismissed && nativeNavigation && Platform.OS === 'ios') pendingScannedOrder.current = { target, scope: sessionReadScope(session), witness: captureSessionWitness(session), window: windowScope };
    else openOrder(target);
    setScannerOpen(false);
  }
  function scannerDismissed() {
    const pending = pendingScannedOrder.current;
    pendingScannedOrder.current = null;
    if (pending && screenMounted.current && activeSessionToken(session) && pending.scope === sessionReadScope(session) && isSessionWitnessCurrent(pending.witness) &&
        pending.window === qrLocation.current.window && pending.target.apparatusId === qrLocation.current.machine) openOrder(pending.target);
  }
  function finishQrOrderDismissal() {
    const pending = pendingQrSwitch.current;
    pendingQrSwitch.current = null;
    if (!pending?.committed) return;
    const current = () => screenMounted.current && isSessionWitnessCurrent(pending.witness) &&
      pending.scope === sessionReadScope(session) && qrLocation.current.machine === pending.apparatusId && qrLocation.current.window === pending.window;
    if (!current()) return;
    const apparatus = queueRef.current?.machines.find(machine => machine.id === pending.apparatusId);
    if (!apparatus) return;
    const reads = workerFabQrReads(session, apparatus.id, () => queueRef.current?.snapshot ?? null, current);
    void prepareWorkerFabQr(session, apparatus, pending.qr, reads, p, id => (queueRef.current?.catalog ?? queueRef.current?.machines)?.find(machine => machine.id === id)?.name ?? id)
      .then(target => { if (reads.current()) finishQrScan(apparatus.id, target.orderId, pending.qr, target.switching, true); })
      .catch(error => { if (reads.current()) setAlert({ title: p('worker.qr.guidance.title'), message: workerFabErrorText(error, p), confirmLabel: p('worker.action.close') }); });
  }
  const scanner = scannerOpen ? <WorkerQrScanner key={scannerMachineId} session={session} apparatusId={scannerMachineId} apparatus={selectedMachine} getSnapshot={() => queueRef.current?.snapshot ?? null} apparatusLabel={id => (queueRef.current?.catalog ?? queueRef.current?.machines)?.find(machine => machine.id === id)?.name ?? id} onClose={() => setScannerOpen(false)} onOrder={finishQrScan} /> : null;
  if (scannerOpen && !nativeNavigation) return scanner;
  function selectDestination(id: string) {
    if (id === 'transfer') {
      if (!workerInventoryVisible(session)) return;
      if (nativeNavigation) router.push('/ios-worker/inventory' as Href);
      else setSection('inventory');
      return;
    }
    if (id === 'home' || id === 'queue') { setSection('home'); return; }
    if (id === 'profile') { if (nativeNavigation) onNavigate?.('profile'); else setSection('profile'); return; }
    if (id === 'daily') { if (nativeNavigation) onNavigate?.('daily'); else setSection('daily'); return; }
    if (id === 'chat') {
      if (nativeNavigation) onNavigate?.('chat');
      else router.push((Platform.OS === 'ios' ? '/ios-chat' : '/android-chat') as Href);
      return;
    }
    if (id === 'logout') { onLogout(); return; }
    if (id === 'instructions') {
      if (nativeNavigation) router.push('/ios-worker/instructions' as Href); else setSection('instructions');
      return;
    }
    if (id === 'paddons' || id.startsWith('paddons:')) {
      const apparatus = id.startsWith('paddons:') ? id.slice(8) : '';
      if (nativeNavigation) router.push(workerPaddonListRoute(apparatus));
      else { setPaddonApparatus(apparatus); setSection('paddons'); }
      return;
    }
  }
  function openScanner() {
    if (!scannerMachineId) { setAlert({ title: 'QR skanerlash', message: p('worker.qr.select_apparatus') }); return; }
    setScannerOpen(true);
  }
  async function openPreflightConfirmation(apparatusId: string, orderId: string, scope: string, prepared?: WorkerMenu) {
    if (preflightReopenBusy.current) return;
    const generation = ++preflightCheck.current;
    const expectedWindow = windowScope;
    const witness = captureSessionWitness(session), readScope = sessionReadScope(session);
    const getCursor = () => {
      if (!screenMounted.current || !activeSessionToken(session) || !isSessionWitnessCurrent(witness) ||
          readScope !== sessionReadScope(session) || currentWindow.current !== expectedWindow) throw new Error(p('worker.error.sync'));
      const snapshot = queueRef.current?.snapshot;
      return synchronizedQueue.current && currentWindow.current === expectedWindow && queueScopeRef.current === expectedWindow && snapshot?.scope === scope ? snapshot : null;
    };
    try {
      const data = prepared ? null : await readWorkerActionControl(session, apparatusId, orderId, getCursor);
      if (!screenMounted.current || generation !== preflightCheck.current) return;
      const menu = prepared ?? workerLongPressMenu(data!, session, apparatusId, orderId, getCursor());
      if (menu.kind !== 'reopen') { void latestReload.current(); return; }
      setAlert({ title: 'Rang chiqarilyapti holatiga qaytarish', message: 'Rostdan ham rang chiqarilyapti holatiga qaytarmoqchimisiz?', confirmLabel: 'Ruxsat', onConfirm: () => {
        if (preflightReopenBusy.current) return;
        preflightReopenBusy.current = true;
        queueState.controller.setWritePending(true);
        void (async () => {
          let message = '';
          try {
            await runWorkerMenuAction(session, apparatusId, orderId, 'reopen', menu, getCursor);
          } catch { message = 'Amal tasdiqlanmadi. Buyurtmaning joriy holati yangilanmoqda.'; }
          finally { preflightReopenBusy.current = false; queueState.controller.setWritePending(false); }
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
  async function openOrderActions(apparatusId: string, order: QueueOrder, isCompleted: boolean) {
    workerLongPressFeedback();
    if (!canWorkMachine(apparatusId) || actionWrites.current.has(JSON.stringify([apparatusId, order.id]))) return;
    if (actionOpening.current) return;
    if (Platform.OS === 'android' && (actionsRoute.isOpen() || orderRoute.isOpen() || historyRoute.isOpen())) return;
    if (Platform.OS !== 'android' && sheetPresentation.current.isOpen()) return;
    preflightCheck.current++;
    const snapshotScope = queueRef.current?.snapshot.scope;
    const scope = typeof snapshotScope === 'string' ? snapshotScope : '';
    const presentationId = Platform.OS !== 'android' ? sheetPresentation.current.open() : undefined;
    if (presentationId === null) return;
    const expected: ActionScope = { window: windowScope, scope, readScope: sessionReadScope(session), witness: captureSessionWitness(session) };
    const opening = { controller: new AbortController(), presentationId };
    actionOpening.current = opening;
    const current = () => !opening.controller.signal.aborted && actionContextCurrent(expected);
    const getCursor = () => {
      if (!current()) throw new Error(synchronizationError);
      return scopedCursor(expected);
    };
    const apparatus = queueRef.current?.machines.find(machine => machine.id === apparatusId);
    let presented = false;
    try {
      if (!apparatus) return;
      const prepared = await prepareWorkerLongPress(session, apparatus, order, isCompleted, getCursor, current,
        opening.controller.signal, p, message => { if (current()) setOrderNotice(message); });
      if (!current() || prepared.kind === 'none') return;
      actionOpening.current = null;
      if (prepared.kind === 'astatka') {
        if (presentationId !== undefined) sheetPresentation.current.dismiss(presentationId);
        openOrder({ apparatusId, orderId: order.id, preview: order, initialAction: 'astatka' });
        return;
      }
      if (prepared.kind === 'menu' && prepared.menu.kind === 'reopen' && order.state === 'print_preflight_passed') {
        if (presentationId !== undefined) sheetPresentation.current.dismiss(presentationId);
        void openPreflightConfirmation(apparatusId, order.id, scope, prepared.menu);
        return;
      }
      actionScope.current = expected;
      pendingAction.current = null;
      const target: ActionOrder = { apparatusId, order, completed: isCompleted, prepared, presentationId,
        onChoose: presentationId === undefined ? chooseOrderAction : action => {
          if (sheetPresentation.current.isCurrent(presentationId)) chooseOrderAction(action);
        },
      };
      if (Platform.OS === 'android') {
        nativeActions.current = target;
        setNativeOverlayOpen(true);
        actionsRoute.open(<WorkerLongPressActions session={session} apparatusId={apparatusId} operation={apparatus.operation}
          order={order} prepared={prepared} onChoose={chooseOrderAction} />,
        { dismissible: true, compact: true, onDismiss: closeOrderActions });
      } else setActionOrder(target);
      presented = true;
    } catch (error) {
      if (current()) setOrderNotice(error instanceof MobileApiException || error instanceof WorkerControlException ? error.message : p('worker.error.sync'));
    } finally {
      if (actionOpening.current === opening) actionOpening.current = null;
      if (!presented) {
        opening.controller.abort();
        if (presentationId !== undefined) sheetPresentation.current.dismiss(presentationId);
      }
    }
  }
  function closeOrderActions(presentationId = actionOrder?.presentationId) {
    if (Platform.OS !== 'android' && (presentationId === undefined || !sheetPresentation.current.dismiss(presentationId))) return;
    const target = Platform.OS === 'android' ? nativeActions.current : actionOrder;
    const action = pendingAction.current;
    const expected = actionScope.current;
    nativeActions.current = null;
    setNativeOverlayOpen(false);
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
    const readCursor = () => {
      if (!actionContextCurrent(expected)) throw new Error(p('worker.error.sync'));
      return scopedCursor(expected);
    };
    const run = async () => {
      if (actionWrites.current.has(key) || !screenMounted.current) return;
      if (!actionContextCurrent(expected)) {
        void latestReload.current();
        setAlert({ title: 'Buyurtma', message: 'Buyurtma holati o‘zgardi. Qayta urining.' });
        return;
      }
      actionWrites.current.add(key);
      queueState.controller.setWritePending(true);
      let message: string;
      try { message = await action.run(readCursor); }
      catch { message = 'Amal tasdiqlanmadi. Buyurtmaning joriy holati yangilanmoqda.'; }
      finally { actionWrites.current.delete(key); queueState.controller.setWritePending(false); }
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
  const cutActions = paddonMachine && section === 'home' ? <WorkerCutToolbar>
    <WorkerPeremotkaButton {...peremotka} disabled={activePaddon.state.busy} onOpen={() => openWorkerCutPanel('peremotka', activePaddon.controller, peremotka.controller)} />
    <WorkerActivePaddonButton {...activePaddon} onOpen={() => openWorkerCutPanel('paddon', activePaddon.controller, peremotka.controller)} />
  </WorkerCutToolbar> : undefined;
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}>
    {Platform.OS === 'android' ? <OrdersHeader search={search} onSearchChange={setSearch} onMenu={openDrawer} onProfile={() => selectDestination('profile')}
      actions={cutActions} />
      : <WorkerHeader search={search} onSearchChange={setSearch} onMenu={openDrawer} onProfile={() => selectDestination('profile')} />}
  </View>;
  const content = (
    <SafeAreaView edges={nativeNavigation ? [] : Platform.OS === 'android' || Platform.OS === 'ios' ? ['top', 'left', 'right'] : undefined} style={[styles.safe, { backgroundColor: colors.background }]}>
      {!nativeNavigation && section !== 'daily' && section !== 'instructions' && section !== 'paddons' && section !== 'inventory' && (Platform.OS !== 'android' || section === 'profile') ? header : null}
      {section === 'inventory' ? <WorkerInventoryScreen session={session} onBack={() => setSection('home')} /> : section === 'paddons' ? <WorkerPaddons key={paddonApparatus} session={session} apparatus={paddonApparatus} onBack={() => setSection('home')} /> : section === 'instructions' ? <WorkerWorkInstructions session={session} onBack={() => setSection('home')} /> : section === 'profile' ? <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => setSection('daily')} /> : section === 'daily'
        ? <DailyWorkScreen session={session} onOpenDrawer={openDrawer} onBack={() => setSection('home')} /> : <>
      <WorkerTabs session={session} machines={queue?.machines ?? []} selected={machineId} onSelect={setMachineId} loading={loading && !queue} header={Platform.OS === 'android' ? header : undefined} headerOffset={headerOffset} fontFamily={orderHeadlineFontFamily} search={search} onSearchChange={setSearch} onMenu={openDrawer} onProfile={() => selectDestination('profile')}
        toolbarActions={cutActions} completedLabel={p('worker.queue.tab.completed')} title={t('Buyurtmalar')} searchPlaceholder={p('worker.queue.search.open')}>
        {(tabId, pagerGesture, machinePicker) => {
          const pageMachine = queue?.machines.find(machine => machine.id === tabId);
          const canWork = canWorkMachine(tabId);
          const pageOrders = queue?.orders[tabId] ?? [];
          const pageActive = tabId === (machineId || 'completed');
          return <WorkerQueueList active={pageActive} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight} topInset={headerSize + 48} onRefresh={queueState.controller.refreshAll}>
          <WorkerQueueFilter key="queue-filter" machinePicker={machinePicker} labels={workerQueueLimitLabels(locale, QUEUE_LIMITS)} value={queueLimit} enabled={limitReady} loading={!!queue && loading && loadedScope !== windowScope} backgroundColor={colors.surface} onChange={limit => {
            if (limit === queueLimit) return;
            setQueueLimit(limit);
            void saveQueueLimit(session, limit).catch(() => {});
          }} />
          <WorkerQueueConnectionProgress active={loading || retryingQueue} />
          {error ? <ListItem supportingText={error} onPress={() => { void reload(true); }}>{p('worker.action.retry')}</ListItem> : null}
          {queue && !queue.machines.length ? <ListItem>{p('worker.queue.empty.apparatus')}</ListItem> : null}
          {tabId === 'completed' && !completed.length && !loading ? <ListItem>{p('worker.queue.completed.empty')}</ListItem> : null}
          {tabId !== 'completed' && canWork ? <ListItem>{p('worker.queue.your.apparatus')}</ListItem> : null}
          {tabId === 'completed' ? completed.map((order, index) => (
            <WorkerOrderListItem key={`${order.apparatusId}:${order.id}`} first={index === 0} last={index === completed.length - 1} fontFamily={orderFontFamily} headlineFontFamily={orderHeadlineFontFamily}
              session={session} orderId={order.id} imageId={order.imageId} imageActive={pageActive} cardTone={order.cardTone}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.customer, order.completedAt ? new Date(order.completedAt * 1000).toLocaleString() : ''].filter(Boolean).join(' · ')}
              {...(Platform.OS === 'ios' ? { statusText: queueStatusLabel(order),
                statusDetail: [order.customer, order.completedAt ? new Date(order.completedAt * 1000).toLocaleString() : ''].filter(Boolean).join(' · ') } : {})}
              onPress={() => openHistory(order)}
              onLongPress={!order.issueNote.trim() && canWorkMachine(order.apparatusId) ? () => openOrderActions(order.apparatusId, order, true) : undefined} />
          )) : null}
          {pageMachine && !pageOrders.length && !loading ? <ListItem>{p('worker.queue.empty.orders', { apparatus: pageMachine.name.trim() })}</ListItem> : null}
          {tabId !== 'completed' ? pageOrders.map((order, index) => (
            <WorkerOrderListItem key={order.id} first={index === 0} last={index === pageOrders.length - 1} fontFamily={orderFontFamily} headlineFontFamily={orderHeadlineFontFamily}
              session={session} orderId={order.id} imageId={order.imageId} imageActive={pageActive} cardTone={order.cardTone}
              headline={[order.code, order.title].filter(Boolean).join(' · ')}
              supportingText={[order.temporarilyPaused ? p('worker.temporary_pause.status') : '', order.customer].filter(Boolean).join(' • ')}
              {...(Platform.OS === 'ios' ? { statusText: queueStatusLabel(order),
                statusDetail: [order.temporarilyPaused ? p('worker.temporary_pause.status') : '', order.customer].filter(Boolean).join(' • ') } : {})}
              onLongPress={canWork ? () => openOrderActions(tabId, order, false) : undefined}
              onPress={() => {
                openOrder({ apparatusId: tabId, orderId: order.id, preview: order, readOnly: !canWork });
              }} />
          )) : null}
          {Platform.OS !== 'ios' && <Spacer size={88} />}
          </WorkerQueueList>;
        }}
      </WorkerTabs>
      </>}
      {!nativeNavigation && section !== 'paddons' && section !== 'inventory' && <View onLayout={event => setNavBarHeight(event.nativeEvent.layout.height)}>
        <WorkerBottomBar active={section} onSelect={selectDestination} onScan={openScanner} />
      </View>}
      {section !== 'daily' && section !== 'instructions' && section !== 'paddons' && section !== 'inventory' ? <WorkerFab onSelect={selectDestination} onScan={openScanner} bottomOffset={nativeNavigation ? 88 : navBarHeight + insets.bottom + 16} /> : null}
      {activeOrder ? <WorkerOrderSheet key={activeOrder.presentationId} onClose={activeOrder.onClose!}>
        {renderOrderRoute(activeOrder, activeOrder.onClose)}
      </WorkerOrderSheet> : null}
      {Platform.OS !== 'android' && <WorkerWipHistorySheet key={readScope} ref={historySheet} session={session} presentationId={historyPresentation ?? undefined} onDismiss={() => {
        const id = historyPresentation;
        if (id === null || !sheetPresentation.current.dismiss(id)) return;
        setHistoryPresentation(null);
        setNativeOverlayOpen(false); preflightCheck.current++;
      }} />}
      {actionOrder ? <WorkerOrderSheet key={actionOrder.presentationId} dismissible compact fitContent measureContent heightFraction={0.86} onClose={() => closeOrderActions(actionOrder.presentationId)}>
        <WorkerLongPressActions session={session} apparatusId={actionOrder.apparatusId} operation={queue?.machines.find(machine => machine.id === actionOrder.apparatusId)?.operation ?? ''} order={actionOrder.order} prepared={actionOrder.prepared} onChoose={actionOrder.onChoose} />
      </WorkerOrderSheet> : null}
      <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
      <WorkerActivePaddonPicker {...activePaddon} />
      <WorkerPeremotkaSheet {...peremotka} />
      <WorkerPaddonFeedback message={orderNotice || activePaddon.notice} />
      {nativeNavigation && <Modal visible={scannerOpen} presentationStyle="fullScreen" animationType="slide" onDismiss={scannerDismissed} onRequestClose={() => setScannerOpen(false)}>{scanner}</Modal>}
    </SafeAreaView>
  );
  if (nativeNavigation) return content;
  return <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)} onSelect={selectDestination} displayName={String(session.profile.display_name ?? '')} canTransfer={workerInventoryVisible(session)} showDailyWork={workerDailyWorkVisible(session)} active={section === 'home' ? 'queue' : section === 'inventory' ? 'transfer' : section}>{content}</WorkerDrawer>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
});
