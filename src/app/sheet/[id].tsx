import { Redirect, useLocalSearchParams, useNavigation, useRoute } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { SecurityContext } from '../../components/WorkerSecurity';
import { WorkerOrderSheet } from '../../components/WorkerOrderSheet';
import { closeNativeSheet, getNativeSheet, mountNativeSheet, subscribeNativeSheet } from '../../nativeSheet';
import { requestAdminClosedSheetTargetedPop } from '../../admin/adminClosedSheetTarget';

export default function NativeSheetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const routeKey = useRoute().key;
  const subscribe = useCallback((listener: () => void) => subscribeNativeSheet(id, listener), [id]);
  const getSnapshot = useCallback(() => getNativeSheet(id), [id]);
  const sheet = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const close = useCallback(() => closeNativeSheet(id), [id]);

  useEffect(() => mountNativeSheet(id, () => {
    if (getNativeSheet(id)?.options.dismissOwnRoute) requestAdminClosedSheetTargetedPop(navigation, routeKey, id);
    else navigation.goBack();
  }), [id, navigation, routeKey]);

  if (!sheet) return <Redirect href="/" />;
  return <SecurityContext.Provider value={sheet.security}>
    <WorkerOrderSheet onClose={close} compact={sheet.options.compact} fitContent={sheet.options.fitContent} dismissible={sheet.options.dismissible} heightFraction={sheet.options.heightFraction}>
      {sheet.content}
    </WorkerOrderSheet>
  </SecurityContext.Provider>;
}
