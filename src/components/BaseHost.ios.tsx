import { Host, type HostProps } from '@expo/ui/swift-ui';
import { useBaseThemeConfig } from './useBaseThemeConfig';

type Props = Pick<HostProps, 'children' | 'style' | 'matchContents' | 'ignoreSafeArea' | 'pointerEvents'>;
export function BaseHost(props: Props) {
  const { mode, direction } = useBaseThemeConfig();
  return <Host {...props} colorScheme={mode} layoutDirection={direction} />;
}
