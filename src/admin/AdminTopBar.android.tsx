import { Row } from '@expo/ui/jetpack-compose';
import type { ComponentProps, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';

export { RoleTopBar as AdminTopBar } from '../shared/navigation/RoleTopBar.android';

export function AdminScreenHeader({ title, navigation, actions, profileAction, testID }: {
  title: string; navigation?: ComponentProps<typeof RoleHeader>['navigation'];
  actions?: ReactNode; profileAction?: ReactNode; testID?: string;
}) {
  const nativeActions = actions ? <BaseHost matchContents><Row verticalAlignment="center">{actions}</Row></BaseHost> : null;
  return <SafeAreaView edges={['left', 'right']} testID={testID}>
    <RoleHeader title={title} navigation={navigation} actions={nativeActions} profileAction={profileAction} />
  </SafeAreaView>;
}
