import { PlatformColor } from 'react-native';
import { useBaseThemeConfig } from './useBaseThemeConfig';

// UIColor resolves these tokens against the device's appearance and accessibility settings.
const colors = {
  primary: PlatformColor('systemBlue'),
  onPrimary: PlatformColor('lightText'),
  primaryContainer: PlatformColor('secondarySystemFill'),
  onPrimaryContainer: PlatformColor('label'),
  secondary: PlatformColor('secondaryLabel'),
  onSecondary: PlatformColor('systemBackground'),
  secondaryContainer: PlatformColor('secondarySystemFill'),
  onSecondaryContainer: PlatformColor('label'),
  tertiary: PlatformColor('secondaryLabel'),
  onTertiary: PlatformColor('systemBackground'),
  tertiaryContainer: PlatformColor('tertiarySystemFill'),
  onTertiaryContainer: PlatformColor('label'),
  surface: PlatformColor('systemBackground'),
  onSurface: PlatformColor('label'),
  onSurfaceVariant: PlatformColor('secondaryLabel'),
  surfaceDim: PlatformColor('systemGray4'),
  surfaceBright: PlatformColor('tertiarySystemBackground'),
  surfaceContainerLowest: PlatformColor('systemBackground'),
  surfaceContainerLow: PlatformColor('systemGroupedBackground'),
  surfaceContainer: PlatformColor('secondarySystemGroupedBackground'),
  surfaceContainerHigh: PlatformColor('secondarySystemBackground'),
  surfaceContainerHighest: PlatformColor('systemGray5'),
  outline: PlatformColor('systemGray'),
  outlineVariant: PlatformColor('opaqueSeparator'),
  error: PlatformColor('systemRed'),
  onError: PlatformColor('lightText'),
  errorContainer: PlatformColor('tertiarySystemFill'),
  onErrorContainer: PlatformColor('systemRed'),
  surfaceTint: 'transparent',
};

export function useBaseTheme() {
  return { ...useBaseThemeConfig(), colors };
}
