import { useNativeState } from '@expo/ui/jetpack-compose';
import { useSyncExternalStore } from 'react';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { usePinSetupCore } from './usePinSetupCore';
import { useStagedPinSetup } from './useStagedPinSetup';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

export function usePinSetup() {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useStagedPinSetup(usePinSetupCore(useNativeState(''), useNativeState(''), useNativeState('')),
    key => localizedGetter(key, locale));
}
