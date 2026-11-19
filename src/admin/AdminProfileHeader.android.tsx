import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminScreenHeader } from './AdminTopBar.android';

/** Profile uses AppShell's default titleLarge; its own route suppresses the default Profile action. */
export function AdminProfileHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  const { colors } = useBaseTheme(), insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }}>
    <AdminScreenHeader title={title} testID="admin-profile-header-safe-area" standardTitle
      navigation={{ icon: 'back', label: backLabel, onPress: onBack, testID: 'admin-profile-back' }} />
  </View>;
}
