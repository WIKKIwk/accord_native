import { useNativeState } from '@expo/ui';
import { usePinSetupCore } from './usePinSetupCore';

export function usePinSetup() {
  return usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState(''));
}
