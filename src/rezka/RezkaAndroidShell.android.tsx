import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerScreen } from '../WorkerScreen';
import { DailyWorkScreen } from '../components/DailyWorkScreen';
import { RezkaProfile } from './RezkaProfile';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { RezkaTestSessionUnavailable } from './RezkaTestSessionUnavailable';
import { RezkaSessionWaiting } from './RezkaSessionWaiting';
import { localizedGetter } from '../shared/localization';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { RezkaWorkerSettingsScreen } from './RezkaWorkerSettings';
import type { RezkaDestination } from './RezkaShellContext';
import { isRezkaSessionCurrent } from './rezkaSessionGuard';
import { rezkaShellCanNavigate, rezkaShellDrawerItems } from './rezkaShellModel';
import { logoutRezkaSession, useRezkaLocale, useRezkaShellSession } from './useRezkaShell';

export function RezkaAndroidShell() {
  const snapshot = useRezkaShellSession(), locale = useRezkaLocale(), insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false), [section, setSection] = useState<RezkaDestination>('queue');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (section === 'queue' || drawerOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setSection('queue'); return true; });
    return () => listener.remove();
  }, [section, drawerOpen]);
  if (Platform.OS !== 'android' || snapshot === null) return <Redirect href="/" />;
  if (snapshot === 'test-token-unavailable') return <RezkaTestSessionUnavailable />;
  if (snapshot === 'transition-pending') return <RezkaSessionWaiting />;
  if (snapshot === undefined || signingOut) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!isRezkaSessionCurrent(snapshot, 'master')) return <Redirect href="/" />;
  const session = snapshot.session;
  const navigate = (destination: RezkaDestination) => {
    if (isRezkaSessionCurrent(snapshot, 'master') && rezkaShellCanNavigate(session, destination)) setSection(destination);
  };
  const onLogout = () => { setSigningOut(true); logoutRezkaSession(session, () => router.replace('/')); };
  const items: RoleNavigationItem[] = [{ id: 'queue', label: localizedGetter('homeNavTitle', locale), icon: 'home' },
    { id: 'profile', label: localizedGetter('profileTitle', locale), icon: 'person' }];
  const content = section === 'workers'
    ? <RezkaWorkerSettingsScreen session={session} snapshot={snapshot} allowAssignments
      navigation={{ icon: 'menu', label: localizedGetter('adminDrawerSections', locale), onPress: () => setDrawerOpen(true) }} />
    : <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
      {section === 'queue' ? <WorkerScreen session={session} onLogout={onLogout} nativeNavigation onOpenDrawer={() => setDrawerOpen(true)}
        onNavigate={destination => { if (destination === 'profile' || destination === 'daily') navigate(destination); }} /> :
        section === 'daily' ? <DailyWorkScreen session={session} onOpenDrawer={() => setDrawerOpen(true)} onBack={() => navigate('queue')} /> :
          <RezkaProfile snapshot={snapshot} onLogout={onLogout} onDailyWork={() => navigate('daily')} />}
    </SafeAreaView>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <RoleDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}
      title={localizedGetter('adminDrawerSections', locale)} items={rezkaShellDrawerItems(session, locale)} active={section}
      closeAccessibilityLabel={localizedGetter('closeAction', locale)}
      footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', locale), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }}
      onSelect={id => { if (id === 'logout') confirmRoleDrawerLogout(onLogout); else if (id === 'queue' || id === 'workers' || id === 'daily' || id === 'profile') navigate(id); }}>
      <View style={{ flex: 1 }}>{content}<RoleBottomBar items={items} active={section === 'queue' || section === 'profile' ? section : ''}
        bottomInset={insets.bottom} onSelect={id => { if (id === 'queue' || id === 'profile') navigate(id); }} /></View>
    </RoleDrawer>
  </WorkerSecurityProvider>;
}
