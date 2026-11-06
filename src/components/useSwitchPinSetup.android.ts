import { useNativeState } from '@expo/ui/jetpack-compose';
import { useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useSwitchPinSetupCore } from './useSwitchPinSetupCore';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

export function useSwitchPinSetup(session: Session) {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useSwitchPinSetupCore(session, useNativeState(''), key => localizedGetter(key, locale));
}
