import { DarkTheme, DefaultTheme, Redirect, router, ThemeProvider, usePathname, type Href } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { loadSession, logout, type Session } from '../../auth';
import { WorkerAlert } from '../../components/WorkerAlert';
import { WorkerDrawer } from '../../components/WorkerDrawer';
import { WorkerSessionContext } from '../../components/WorkerSession';
import { WorkerSecurityProvider } from '../../components/WorkerSecurity';
import { clearAppLock } from '../../appLock';
import type { WorkerAlertData } from '../../components/workerDialogTypes';

export default function IosWorkerLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatClosing, setChatClosing] = useState(false);
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    void loadSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, []);

  if (Platform.OS !== 'ios' || session === null) return <Redirect href="/" />;
  if (session === undefined || signingOut) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;

  const onLogout = () => {
    setSigningOut(true);
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => setSession(null));
  };
  const selectDestination = (id: string) => {
    if (id === 'queue') { router.navigate('/ios-worker'); return; }
    if (id === 'daily') { router.navigate('/ios-worker/daily'); return; }
    if (id === 'instructions') { router.navigate('/ios-worker/instructions' as Href); return; }
    if (id === 'profile') { router.navigate('/ios-worker/profile'); return; }
    if (id === 'logout') { onLogout(); return; }
    const labels: Record<string, string> = { instructions: 'App yo‘riqnomasi', transfer: 'Joylashtirish va transfer' };
    setAlert({ title: labels[id] ?? 'Bo‘lim', message: 'Bu bo‘lim hozircha tayyor emas.' });
  };

  return <WorkerSessionContext.Provider value={{ session, onLogout, onOpenDrawer: () => setDrawerOpen(true), setChatClosing }}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
      <View style={{ flex: 1 }}>
        <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)} onSelect={selectDestination}
          displayName={String(session.profile.display_name ?? '')} canTransfer={session.capabilities.includes('inventory.movement.manage')}
          active={pathname === '/ios-worker/profile' ? 'profile' : pathname === '/ios-worker' ? 'queue' : pathname === '/ios-worker/daily' ? 'daily' : ''}>
          <NativeTabs hidden={pathname.startsWith('/ios-worker/chat/') && !chatClosing} disableHiddenAnimation>
            <NativeTabs.Trigger name="(home)">
              <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
              <NativeTabs.Trigger.Label>Asosiy</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="profile">
              <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
              <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="chat">
              <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
              <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
          </NativeTabs>
        </WorkerDrawer>
        <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
      </View>
      </WorkerSecurityProvider>
    </ThemeProvider>
  </WorkerSessionContext.Provider>;
}
