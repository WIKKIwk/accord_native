import { PlatformColor } from 'react-native';
/** UIKit's semantic inverse foreground/background adapts to the actual native appearance. */
export function useBrigaderSnackPalette() { return { inverseSurface: PlatformColor('label'), onInverseSurface: PlatformColor('systemBackground') }; }
