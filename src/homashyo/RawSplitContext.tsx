import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { registerSessionResetHook, type Session } from '../auth';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { usePreparationText } from '../preparation/PreparationUI';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import { rawSplitSessionIsCurrent, type RawSplitSessionTicket } from './rawSplitApi';
import { rawSplitDeviceSelection, validateRawSplitDeviceSelection } from './rawSplitDeviceSelection';
import { RawSplitPickerOverlay } from './RawSplitPickerOverlay';
import { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import { createRawSplitRuntime } from './rawSplitRuntime';
import { rawSplitUnsupportedReason } from './rawSplitPrintRuntime';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
type Runtime = ReturnType<typeof createRawSplitRuntime>;
type Context = { session: Session; ticket: RawSplitSessionTicket; runtime: Runtime; onLogout(): void; issueRevision: number; unread: number; chatClosing: boolean; setChatClosing(closing: boolean): void };
const RawSplitContext = createContext<Context | null>(null);

export function RawSplitProvider({ session, ticket, onLogout, subscribeWitness, witnessVersion, children }: { session: Session; ticket: RawSplitSessionTicket;
  onLogout(): void; subscribeWitness(listener: () => void): () => void; witnessVersion(): number; children: ReactNode }) {
  const [picker, setPicker] = useState<Request | null>(null), [issueRevision, setIssueRevision] = useState(0);
  const [invalidated, setInvalidated] = useState(false), notice = usePreparationNotice(), lifetime = useRef({ mounts: 0 }), t = usePreparationText();
  useSyncExternalStore(subscribeWitness, witnessVersion, witnessVersion);
  const unread = useChatUnreadCount(session), [chatClosing, setChatClosing] = useState(false);
  const [owner] = useState(() => {
    const pickerOwner = new RawSplitPickerCoordinator({ isCurrent: () => rawSplitSessionIsCurrent(ticket),
      create: isCurrent => createNativeTransientDevicePicker(isCurrent, validateRawSplitDeviceSelection),
      convert: rawSplitDeviceSelection, render: setPicker });
    const runtime = createRawSplitRuntime({ ticket, canMutate: () => session.token !== 'test-mode-token' && rawSplitSessionIsCurrent(ticket), selectPrinter: isCurrent => pickerOwner.select(isCurrent), onMessage: notice.show,
      onIssueVisible: () => setIssueRevision(value => value + 1),
      onUnsupportedPrinter: printer => Alert.alert('Printer ulanmagan', rawSplitUnsupportedReason(printer.transport)) });
    return { ticket, pickerOwner, runtime, dispose() { pickerOwner.dispose(); runtime.dispose(); } };
  });
  useEffect(() => {
    const scope = lifetime.current; scope.mounts++;
    const invalidate = () => { owner.dispose(); setPicker(null); setInvalidated(true); };
    const unsubscribePending = owner.runtime.home.subscribe(() => owner.pickerOwner.invalidateIfStale());
    owner.pickerOwner.invalidateIfStale();
    const unregister = registerSessionResetHook(async () => { invalidate(); });
    const unsubscribe = subscribeWitness(() => { if (!rawSplitSessionIsCurrent(ticket)) invalidate(); });
    if (!rawSplitSessionIsCurrent(ticket)) invalidate();
    return () => {
      unsubscribe(); unsubscribePending(); unregister(); scope.mounts--;
      queueMicrotask(() => { if (scope.mounts === 0) owner.dispose(); });
    };
  }, [owner, subscribeWitness, ticket]);
  if (invalidated || !rawSplitSessionIsCurrent(owner.ticket)) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text>Sessiya o‘zgargan. Sahifani qayta oching.</Text><WorkerSheetButton label="Bosh sahifa" onPress={() => router.replace('/')} /></View>;
  return <RawSplitContext.Provider value={{ session, ticket: owner.ticket, runtime: owner.runtime, onLogout, issueRevision, unread, chatClosing, setChatClosing }}>
    <View style={{ flex: 1 }}><View style={{ flex: 1 }} accessibilityElementsHidden={picker !== null}
      importantForAccessibility={picker ? 'no-hide-descendants' : 'auto'}>{children}</View><PreparationNotice message={t(notice.message)} />
      {picker && <RawSplitPickerOverlay request={picker} owner={owner.pickerOwner} />}</View>
  </RawSplitContext.Provider>;
}
export function useRawSplitContext(): Context {
  const value = useContext(RawSplitContext);
  if (!value) throw new Error('Homashyo sessiyasi mavjud emas');
  return value;
}
