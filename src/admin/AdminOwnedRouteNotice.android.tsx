import { SnackbarHost, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export function AdminOwnedRouteNotice({ notice, isCurrent }: { notice: { serial: number; message: string } | null; isCurrent: () => boolean }) {
  const host = useRef<SnackbarHostRef>(null), shown = useRef<unknown>(null), insets = useSafeAreaInsets();
  useEffect(() => { if (notice && shown.current !== notice && isSynchronouslyTrue(isCurrent)) { shown.current = notice; void host.current?.showSnackbar({ message: notice.message, duration: 'short' }); } }, [notice, isCurrent]);
  return <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={host} /></BaseHost></View>;
}
const styles = StyleSheet.create({ notice: { position: 'absolute', left: 16, right: 16 } });
