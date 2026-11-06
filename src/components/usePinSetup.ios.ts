import { useNativeState } from '@expo/ui/swift-ui';
import { useBaseLocale } from './useBaseLocale.ios';
import { usePinSetupCore } from './usePinSetupCore';
import { useStagedPinSetup } from './useStagedPinSetup';

export function usePinSetup() {
  const { text } = useBaseLocale();
  return useStagedPinSetup(usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState('')), text);
}
