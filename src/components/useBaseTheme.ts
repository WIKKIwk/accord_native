import palettes from '../shared/themePalettes.json';
import { useBaseThemeConfig } from './useBaseThemeConfig';

export function useBaseTheme() {
  const config = useBaseThemeConfig();
  const colors: Record<string, string> = palettes.classic[config.mode].colors;
  return { ...config, colors };
}
