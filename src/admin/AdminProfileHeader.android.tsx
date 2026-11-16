import { Column, IconButton, RNHostView, Spacer, TopAppBar } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';

/** Profile uses AppShell's default titleLarge; its own route suppresses the default Profile action. */
export function AdminProfileHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  const { colors } = useBaseTheme(), insets = useSafeAreaInsets();
  return <SafeAreaView edges={['left', 'right']} style={{ paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }} testID="admin-profile-header-safe-area">
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
      <TopAppBar windowInsets={{}} colors={{ containerColor: colors.surfaceContainerHigh }} modifiers={[height(60)]}>
        <TopAppBar.NavigationIcon><IconButton onClick={onBack} modifiers={[semantics({ contentDescription: backLabel }), testID('admin-profile-back')]}>
          <RNHostView matchContents><SymbolView name={{ android: 'arrow_back' }} size={24} tintColor={colors.onSurface} /></RNHostView>
        </IconButton></TopAppBar.NavigationIcon>
        <TopAppBar.Title><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }}>{title}</Text></TopAppBar.Title>
      </TopAppBar><Spacer modifiers={[height(3)]} />
    </Column></BaseHost>
  </SafeAreaView>;
}
