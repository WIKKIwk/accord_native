import { useNativeState } from '@expo/ui/jetpack-compose';
import { usePinSetupCore } from './usePinSetupCore';

export function usePinSetup() {
  return usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState(''));
}
