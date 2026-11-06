import { useNativeState } from '@expo/ui/swift-ui';
import type { Session } from '../auth';
import { useBaseLocale } from './useBaseLocale.ios';
import { useSwitchPinSetupCore } from './useSwitchPinSetupCore';

export function useSwitchPinSetup(session: Session) {
  const { text } = useBaseLocale();
  return useSwitchPinSetupCore(session, useNativeState(''), text);
}
