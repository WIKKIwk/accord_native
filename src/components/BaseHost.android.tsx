import { Host } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useBaseTheme } from './useBaseTheme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; matchContents?: boolean | { vertical?: boolean; horizontal?: boolean } };
export function BaseHost(props: Props) {
  const theme = useBaseTheme();
  return <Host {...props} colorScheme={theme.mode} seedColor={theme.seed} colorOverrides={theme.colors} layoutDirection={theme.direction} />;
}
