import { Column, IconButton, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { BaseHost } from '../../components/BaseHost.android';
import { useBaseTheme } from '../../components/useBaseTheme';
import { RoleTopBar } from './RoleTopBar.android';

type Navigation = { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string };

export function RoleHeader({ title, subtitle, navigation, titleContent, actions, compact = false }: {
  title: string; subtitle?: string; navigation?: Navigation | null; titleContent?: ReactNode; actions?: ReactNode; compact?: boolean;
}) {
  const { colors } = useBaseTheme();
  const leading = navigation ? <IconButton onClick={navigation.onPress} modifiers={[
    size(48, 48), semantics({ contentDescription: navigation.label }), ...(navigation.testID ? [testID(navigation.testID)] : []),
  ]}>
    <RNHostView matchContents><SymbolView name={{ android: navigation.icon === 'back' ? 'arrow_back' : 'menu' }}
      size={24} tintColor={compact ? colors.onSurface : colors.onSurfaceVariant} /></RNHostView>
  </IconButton> : null;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <RoleTopBar compact={compact} leading={leading} actions={actions} title={titleContent ?? <Column>
      <Text color={colors.onSurface} style={{ typography: 'titleLarge' }}>{title}</Text>
      {subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{subtitle}</Text> : null}
    </Column>} />
  </BaseHost>;
}
