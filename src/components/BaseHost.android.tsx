import { Host, type HostProps } from '@expo/ui/jetpack-compose';
import { useBaseThemeConfig } from './useBaseThemeConfig';

type Props = Omit<HostProps, 'colorScheme' | 'seedColor' | 'colorOverrides' | 'layoutDirection'>;

export function BaseHost(props: Props) {
  const { mode, direction } = useBaseThemeConfig();
  return <Host {...props} colorScheme={mode} layoutDirection={direction} />;
}
