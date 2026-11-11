import { Host } from '@expo/ui/swift-ui';
import type { ReactNode } from 'react';
import { PlatformColor, type StyleProp, type ViewStyle } from 'react-native';
import { useBaseTheme } from './useBaseTheme';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; matchContents?: boolean | { vertical?: boolean; horizontal?: boolean } };
export function BaseHost(props: Props) {
  const theme = useBaseTheme();
  return <Host {...props} colorScheme={theme.mode} seedColor={PlatformColor('systemBlue')} layoutDirection={theme.direction} />;
}
