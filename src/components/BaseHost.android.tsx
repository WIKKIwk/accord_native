import { Host } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useBaseTheme } from './useBaseTheme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }; dynamicColors?: boolean };
export function BaseHost({ dynamicColors = false, ...props }: Props) {
  const theme = useBaseTheme();
  return <Host {...props} colorScheme={dynamicColors ? undefined : theme.mode} seedColor={dynamicColors ? undefined : theme.seed}
    colorOverrides={dynamicColors ? undefined : theme.colors} layoutDirection={theme.direction} />;
}
