import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import type { Session } from '../auth';
import { localizedGetter, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useAccountSwitcherLauncher } from './useAccountSwitcherLauncher';

export type AccountAccessProps = { session: Session; onLogout: () => void };
const subscribe = (listener: () => void) => localeController.addListener(listener);
const snapshot = () => localeController.locale;

/** Keep account management available when this session has no supported workspace. */
export function useAccountAccess(session: Session) {
  const locale = useSyncExternalStore(subscribe, snapshot, snapshot);
  const text = (key: string) => localizedGetter(key, locale);
  const [profileOpen, setProfileOpen] = useState(false);
  const switcher = useAccountSwitcherLauncher();
  const unassigned = session.profile.role === 'aparatchi' && session.assigned_apparatus.length === 0;

  useEffect(() => {
    if (Platform.OS !== 'android' || !profileOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setProfileOpen(false); return true; });
    return () => subscription.remove();
  }, [profileOpen]);

  return {
    text, profileOpen, unassigned,
    title: unassigned ? productionText('worker.guide.no_machine.title', locale) : text('accessDenied'),
    message: text(unassigned ? 'accountAccessUnassignedBody' : 'accountAccessUnavailableBody'),
    openProfile: () => setProfileOpen(true), closeProfile: () => setProfileOpen(false),
    openSwitcher: switcher.open,
    addAccount: () => router.push('/add-account'),
  };
}
