import * as Crypto from 'expo-crypto';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { sendOrderAlert, type OrderAlertKind } from '../workerControlsApi';
import { WorkerOrderAlertState } from '../workerOrderAlert';
import { WorkerOrderButton } from './WorkerOrderControls';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';
/** @v2 OrderAlertButton */
export function WorkerOrderAlertButton({ session, orderId, apparatusId, kind, enabled = true }: { session: Session; orderId: string; apparatusId: string; kind: OrderAlertKind; enabled?: boolean }) {
  const { p } = useWorkerOrderText(), colors = useWorkerColors(), [, redraw] = useReducer(value => value + 1, 0);
  const mounted = useRef(true), permit = useRef(enabled), identity = useRef('');
  useLayoutEffect(() => { permit.current = enabled; }, [enabled]);
  const scope = sessionReadScope(session), key = JSON.stringify([scope, orderId, apparatusId, kind]); useLayoutEffect(() => { identity.current = key; }, [key]);
  const state = useMemo(() => new WorkerOrderAlertState(Crypto.randomUUID(), requestId => sendOrderAlert(session, { order_id: orderId, apparatus: apparatusId, kind, request_id: requestId }),
    // eslint-disable-next-line react-hooks/refs -- Constructor retains guards without executing them during render.
    () => mounted.current && identity.current === key && !!activeSessionToken(session) && sessionReadScope(session) === scope, () => permit.current, redraw), [session, scope, key, orderId, apparatusId, kind]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <View style={{ gap: 6 }}><WorkerOrderButton label={p(state.label(kind))} icon={{ ios: 'bell', android: 'notifications' }} disabled={!enabled || state.sending || state.sent} onPress={() => { void state.send(); }} />
    {!!state.errorCode && <Text accessibilityRole="alert" style={{ color: colors.error }}>{p(state.errorKey)}</Text>}
  </View>;
}
