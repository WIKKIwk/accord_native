import { useNativeState } from '@expo/ui/swift-ui';
import { usePinSetupCore } from './usePinSetupCore';

export function usePinSetup() {
  return usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState(''));
}
