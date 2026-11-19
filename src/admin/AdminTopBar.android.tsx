import { RNHostView } from '@expo/ui/jetpack-compose';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RoleTopBar } from '../shared/navigation/RoleTopBar.android';
import { AdminText } from './AdminTypography.android';

export function AdminTopBar(props: Omit<ComponentProps<typeof RoleTopBar>, 'compact'>) {
  return <RoleTopBar {...props} compact />;
}

export function AdminScreenHeader({ title, navigation, actions, profileAction, testID, standardTitle = false }: {
  title: string; navigation?: ComponentProps<typeof RoleHeader>['navigation'];
  actions?: ReactNode; profileAction?: ReactNode; testID?: string; standardTitle?: boolean;
}) {
  const { colors } = useBaseTheme();
  const profile = profileAction ? <RNHostView matchContents><View style={{ width: 58, height: 60, justifyContent: 'center' }}>{profileAction}</View></RNHostView> : null;
  return <SafeAreaView edges={['left', 'right']} testID={testID} style={{ backgroundColor: colors.surfaceContainerHigh }}>
    <RoleHeader compact title={title} navigation={navigation}
      titleContent={<AdminText maxLines={1} overflow="ellipsis" color={colors.onSurface}
        style={standardTitle ? { typography: 'titleLarge', fontSize: 20, fontWeight: '700' } : { fontSize: 24, fontWeight: '800' }}>{title}</AdminText>}
      actions={actions || profile ? <>{actions}{profile}</> : null} />
    <View style={{ height: 3 }} />
  </SafeAreaView>;
}
