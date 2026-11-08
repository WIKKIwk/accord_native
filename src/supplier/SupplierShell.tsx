import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { SupplierProvider, useSupplierSession } from './SupplierSession';
import { supplierDrawerItems } from './supplierNavigationModel';
import { useSupplierText } from './useSupplierOverview';

/** The entry is intentionally not connected to homeTarget while the security holds remain. */
export function SupplierShell({ platform, children }: { platform: 'ios' | 'android'; children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true; const request = generation.current;
    void loadSession().then(value => { if (mounted && request === generation.current) setSession(value); })
      .catch(() => { if (mounted && request === generation.current) setSession(null); });
    const unregister = registerSessionResetHook(async () => { generation.current++; if (mounted) setSession(null); });
    return () => { mounted = false; unregister(); };
  }, []);
  if (Platform.OS !== platform || session === null || (session && !canOpenRoute(session, appRoutes.supplierHome))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})])
    .finally(() => { setSession(null); router.replace('/'); }); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <SupplierProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>{children}</SupplierProvider>
  </WorkerSecurityProvider>;
}

/** Reuses the native role drawer. The caller owns route selection and root-stack rules. */
export function SupplierDrawer({ active, onSelect, children }: { active?: string; onSelect: (id: string) => void;
  children: (open: () => void) => ReactNode }) {
  const state = useRoleDrawerState(), { l, t } = useSupplierText(), { onLogout } = useSupplierSession();
  return <RoleDrawer {...state} title="Bo‘limlar" items={supplierDrawerItems(l).filter(item => item.id !== 'notifications')} active={active}
    closeAccessibilityLabel={t('Menyuni yopish')} footerAction={{ id: 'logout', label: l('logoutTitle'), destructive: true }}
    onSelect={id => { if (id === 'logout') confirmRoleDrawerLogout(onLogout); else onSelect(id); }}>
    {children(state.onOpen)}
  </RoleDrawer>;
}
