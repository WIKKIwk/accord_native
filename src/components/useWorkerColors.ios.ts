import { PlatformColor } from 'react-native';

// UIKit resolves these colors for the current appearance and accessibility settings.
const colors = {
  error: PlatformColor('systemRed'),
  background: PlatformColor('systemBackground'),
  surface: PlatformColor('secondarySystemGroupedBackground'),
  field: PlatformColor('tertiarySystemFill'),
  text: PlatformColor('label'),
  muted: PlatformColor('secondaryLabel'),
  icon: PlatformColor('systemBlue'),
  clear: PlatformColor('secondaryLabel'),
};

export function useWorkerColors() {
  return colors;
}
