import { qolipTasksWarmStore } from './qolipTasksWarmStore';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { QolipFabProvider } from './QolipFabContext';
import { Redirect, router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { logout } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { localizedGetter } from '../shared/localization';
import { QolipDock } from './QolipDock';
import { QolipRoleContext, type QolipRoleContextValue } from './QolipRoleContext';
import { qolipDestinations, qolipDestinationTitle } from './qolipNavigation';
import { useQolipNotice } from './useQolipNotice';
import { useQolipSettledHomeSession } from './useQolipSettledHomeSession';
import { useQolipText } from './useQolipText';

export function QolipSessionGate({ platform, children }: { platform: 'ios' | 'android'; children: ReactNode }) {
  const entry = useQolipSettledHomeSession();
  if (Platform.OS !== platform || entry.kind === 'invalid' || entry.kind === 'unavailable') return <Redirect href="/" />;
  if (entry.kind !== 'ready') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <QolipRuntime key={entry.session.imageCacheScope} session={entry.session} boundary={entry.boundary}>{children}</QolipRuntime>;
}
function QolipRuntime({ session, boundary, children }: Pick<QolipRoleContextValue, 'session' | 'boundary'> & { children: ReactNode }) {
  const drawer = useRoleDrawerState(), { locale } = useQolipText(), feedback = useQolipNotice(), pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const isCurrent = boundary.current, base = '/' + Platform.OS + '-qolip';
  const navigate = useCallback((path: string) => { if (isCurrent()) { if (!path) router.dismissTo(base as Href); else router.replace((base + '/' + path) as Href); } }, [base, isCurrent]);
  const onLogout = useCallback(() => {
    if (!isCurrent() || loggingOut) return;
    setLoggingOut(true);
    void logout(session).then(() => router.replace('/')).catch(() => { if (isCurrent()) setLoggingOut(false); });
  }, [isCurrent, loggingOut, session]);
  const onProfile = useCallback(() => navigate('profile'), [navigate]);
  const showNotice = feedback.show;
  const notice = useCallback((message: string) => { if (isCurrent()) showNotice(message); }, [isCurrent, showNotice]);
  const value: QolipRoleContextValue = useMemo(() => ({ session, boundary, isCurrent, notice,
    onMenu: drawer.onOpen, onProfile, onLogout, dock: <QolipDock /> }), [session, boundary, isCurrent, notice, drawer.onOpen, onProfile, onLogout]);
  useEffect(() => { void qolipTasksWarmStore.prepare(session, isCurrent, () => adminSequenceApparatusStore.loadSavedApparatusId()); }, [session, isCurrent]);
  const active = pathname.slice(base.length + 1).split('/')[0] || 'home';
  return <WorkerSecurityProvider session={session} onLogout={onLogout}>
    <RoleDrawer {...drawer} title="Bo‘limlar" closeAccessibilityLabel={localizedGetter('closeAction', locale)}
      active={active} items={qolipDestinations.map(([id, , key, android, ios]) => ({ id, label: qolipDestinationTitle(key, locale), symbol: Platform.OS === 'android' ? { android } : ios }))}
      footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', locale), symbol: Platform.OS === 'android' ? { android: 'logout' } : 'rectangle.portrait.and.arrow.right' }}
      onSelect={id => { if (!isCurrent()) return; if (id === 'logout') confirmRoleDrawerLogout(onLogout);
        else { const destination = qolipDestinations.find(item => item[0] === id); if (destination) navigate(destination[1]); } }}>
      <QolipRoleContext.Provider value={value}><QolipFabProvider>{children}</QolipFabProvider><PreparationNotice message={feedback.message} /></QolipRoleContext.Provider>
    </RoleDrawer>
  </WorkerSecurityProvider>;
}
