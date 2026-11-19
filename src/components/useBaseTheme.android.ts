import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useBaseThemeConfig } from './useBaseThemeConfig';

export function useBaseTheme() {
  const config = useBaseThemeConfig();
  const colors = useMaterialColors({ colorScheme: config.mode });
  return { ...config, colors };
}
