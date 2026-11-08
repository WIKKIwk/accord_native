import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { registerSessionResetHook, type Session } from '../auth';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';
import { rawSplitSessionIsCurrent, type RawSplitSessionTicket } from './rawSplitApi';
import { rawSplitDeviceSelection, validateRawSplitDeviceSelection } from './rawSplitDeviceSelection';
import { RawSplitPickerOverlay } from './RawSplitPickerOverlay';
import { RawSplitPickerCoordinator } from './rawSplitPickerCoordinator';
import { createRawSplitRuntime } from './rawSplitRuntime';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
type Runtime = ReturnType<typeof createRawSplitRuntime>;
type Context = { session: Session; ticket: RawSplitSessionTicket; runtime: Runtime; onLogout(): void; issueRevision: number };
const RawSplitContext = createContext<Context | null>(null);

export function RawSplitProvider({ session, ticket, onLogout, children }: { session: Session; ticket: RawSplitSessionTicket;
  onLogout(): void; children: ReactNode }) {
  const [picker, setPicker] = useState<Request | null>(null), [issueRevision, setIssueRevision] = useState(0);
  const [invalidated, setInvalidated] = useState(false), notice = usePreparationNotice(), lifetime = useRef({ mounts: 0 });
  const [owner] = useState(() => {
    const pickerOwner = new RawSplitPickerCoordinator({ isCurrent: () => rawSplitSessionIsCurrent(ticket),
      create: () => createNativeTransientDevicePicker(() => rawSplitSessionIsCurrent(ticket), validateRawSplitDeviceSelection),
      convert: rawSplitDeviceSelection, render: setPicker });
    const runtime = createRawSplitRuntime({ ticket, canMutate: () => false, selectPrinter: () => pickerOwner.select(), onMessage: notice.show,
      onIssueVisible: () => setIssueRevision(value => value + 1),
      onUnsupportedPrinter: () => Alert.alert('Printer ulanmagan', 'Zebra yoki Bluetooth printerni tanlang.') });
    return { ticket, pickerOwner, runtime, dispose() { pickerOwner.dispose(); runtime.dispose(); } };
  });
  useEffect(() => {
    const scope = lifetime.current; scope.mounts++;
    const unregister = registerSessionResetHook(async () => { owner.dispose(); setPicker(null); setInvalidated(true); });
    return () => {
      unregister(); scope.mounts--;
      queueMicrotask(() => { if (scope.mounts === 0) owner.dispose(); });
    };
  }, [owner]);
  if (invalidated || !rawSplitSessionIsCurrent(owner.ticket)) return null;
  return <RawSplitContext.Provider value={{ session, ticket: owner.ticket, runtime: owner.runtime, onLogout, issueRevision }}>
    <View style={{ flex: 1 }}><View style={{ flex: 1 }} accessibilityElementsHidden={picker !== null}
      importantForAccessibility={picker ? 'no-hide-descendants' : 'auto'}>{children}</View><PreparationNotice message={notice.message} />
      {picker && <RawSplitPickerOverlay request={picker} owner={owner.pickerOwner} />}</View>
  </RawSplitContext.Provider>;
}
export function useRawSplitContext(): Context {
  const value = useContext(RawSplitContext);
  if (!value) throw new Error('Homashyo sessiyasi mavjud emas');
  return value;
}
