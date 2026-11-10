import { Redirect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { SecurityContext } from '../../components/WorkerSecurity';
import { WorkerOrderSheet } from '../../components/WorkerOrderSheet';
import { closeNativeSheet, getNativeSheet, mountNativeSheet, subscribeNativeSheet } from '../../nativeSheet';

export default function NativeSheetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const subscribe = useCallback((listener: () => void) => subscribeNativeSheet(id, listener), [id]);
  const getSnapshot = useCallback(() => getNativeSheet(id), [id]);
  const sheet = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const close = useCallback(() => closeNativeSheet(id), [id]);

  useEffect(() => mountNativeSheet(id, () => navigation.goBack()), [id, navigation]);

  if (!sheet) return <Redirect href="/" />;
  return <SecurityContext.Provider value={sheet.security}>
    <WorkerOrderSheet onClose={close} compact={sheet.options.compact} fitContent={sheet.options.fitContent} dismissible={sheet.options.dismissible} heightFraction={sheet.options.heightFraction}>
      {sheet.content}
    </WorkerOrderSheet>
  </SecurityContext.Provider>;
}
