import { Column, Text } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { BaseHost } from '../../components/BaseHost.android';
import { useBaseTheme } from '../../components/useBaseTheme';
import { RoleHeaderButton } from './RoleHeaderButton';
import { RoleHeaderRow } from './RoleHeaderRow';

type Navigation = { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string };

export function RoleHeader({ title, subtitle, navigation, actions, profileAction }: {
  title: string; subtitle?: string; navigation?: Navigation | null; actions?: ReactNode; profileAction?: ReactNode;
}) {
  const { colors } = useBaseTheme();
  return <RoleHeaderRow>
    {navigation ? <RoleHeaderButton {...navigation} tintColor={colors.onSurfaceVariant} /> : null}
    <BaseHost matchContents={{ vertical: true }} style={{ flex: 1 }}>
      <Column>
        <Text color={colors.onSurface} style={{ typography: 'titleLarge' }} maxLines={1} overflow="ellipsis">{title}</Text>
        {subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{subtitle}</Text> : null}
      </Column>
    </BaseHost>
    {actions}
    {profileAction}
  </RoleHeaderRow>;
}
