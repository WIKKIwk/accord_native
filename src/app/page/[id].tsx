import { Redirect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { SecurityContext } from '../../components/WorkerSecurity';
import { getNativeSheet, mountNativeSheet, subscribeNativeSheet } from '../../nativeSheet';

export default function NativePageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const subscribe = useCallback((listener: () => void) => subscribeNativeSheet(id, listener), [id]);
  const getSnapshot = useCallback(() => getNativeSheet(id), [id]);
  const page = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isPage = page?.options.presentation === 'page';

  useEffect(() => {
    if (isPage) return mountNativeSheet(id, () => navigation.goBack());
  }, [id, navigation, isPage]);

  if (!page || !isPage) return <Redirect href="/" />;
  return <SecurityContext.Provider value={page.security}>{page.content}</SecurityContext.Provider>;
}
