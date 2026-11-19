import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminShellTheme } from './useAdminShellTheme';
import { AdminScreenHeader } from './AdminTopBar.android';

/** Profile uses AppShell's default titleLarge; its own route suppresses the default Profile action. */
export function AdminProfileHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  const { chromeBackground } = useAdminShellTheme(), insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: chromeBackground }}>
    <AdminScreenHeader title={title} testID="admin-profile-header-safe-area"
      navigation={{ icon: 'back', label: backLabel, onPress: onBack, testID: 'admin-profile-back' }} />
  </View>;
}
