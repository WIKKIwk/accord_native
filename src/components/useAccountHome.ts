import { useNavigation } from 'expo-router';
import type { Session } from '../auth';
import { unlockAfterLogin } from '../shared/securityUnlockRuntime';

/** @v2 rootNavigator.pushNamedAndRemoveUntil(AppSession.homeRoute, (_) => false) */
export function useAccountHome() {
  const navigation = useNavigation('/');
  return (session: Session) => {
    const state = navigation.getState();
    if (!state) throw new Error('Root navigation is unavailable');
    unlockAfterLogin(session);
    // Expo Router 58 requires a complete RESET state. A new route key also remounts
    // Android's worker entry, which otherwise retains its previous session.
    const next = { ...state, index: 0,
      routes: [{ name: 'index', key: `account-${session.imageCacheScope}` }] };
    navigation.dispatch({ type: 'RESET', payload: next });
  };
}
