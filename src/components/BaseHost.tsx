import { Host } from '@expo/ui';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useBaseTheme } from './useBaseTheme';

export type BaseHostProps = { children: ReactNode; style?: StyleProp<ViewStyle>; matchContents?: boolean | { vertical?: boolean; horizontal?: boolean } };

export function BaseHost(props: BaseHostProps) {
  const theme = useBaseTheme();
  return <Host {...props} colorScheme={theme.mode} seedColor={theme.colors.primary ?? theme.seed} layoutDirection={theme.direction} />;
}
