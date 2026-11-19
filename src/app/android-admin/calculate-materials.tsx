import { SnackbarHost, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { Redirect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminCreateMenu } from '../../admin/AdminCreateMenu.android';
import { useAdminShell } from '../../admin/AdminShellContext';
import { BrigaderCalculateMaterialsContent } from '../../brigader/BrigaderCalculateMaterialsContent';
import { BaseHost } from '../../components/BaseHost.android';
import { appRoutes } from '../../shared/appRoutes';
import { adminText } from '../../shared/localization';

/** @v2 AdminCalculateMaterialsScreen */
export default function AdminCalculateMaterialsRoute() {
  const shell = useAdminShell(), insets = useSafeAreaInsets(), snackbar = useRef<SnackbarHostRef>(null);
  const showMessage = useCallback((message: string) => { void snackbar.current?.showSnackbar({ message, duration: 'short' }); }, []);
  if (!shell.isCurrent()) return null;
  if (!shell.destination(appRoutes.adminCalculateMaterials, 'android')) return <Redirect href="/" />;
  return <View style={{ flex: 1 }}>
    <BrigaderCalculateMaterialsContent showMessage={showMessage} renderPrimary={({ page, actions }) =>
      <AdminCreateMenu actions={actions} isCurrent={page.interactive} openLabel={adminText('material.add', page.locale)}
        closeLabel={adminText('action.close', page.locale)} bottomOffset={insets.bottom + 94} visible={page.interactive()} />} />
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
      <BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost>
    </View>
  </View>;
}
