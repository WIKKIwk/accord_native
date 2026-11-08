import { Redirect } from 'expo-router';
import { Platform, View } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { appRoutes } from '../shared/appRoutes';
import { useAdminShell } from './AdminShellContext';

/** The real profile is prepared for integration, but direct entry also respects the destination hold. */
export function AdminProfileRoute() {
  const shell = useAdminShell();
  if (!shell.isCurrent() || !shell.destination(appRoutes.profile, Platform.OS)) return <Redirect href="/" />;
  return <View style={{ flex: 1 }}><ProfileScreen session={shell.session} onLogout={shell.onLogout} /></View>;
}
