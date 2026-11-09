import { DarkTheme, DefaultTheme, Redirect, router, ThemeProvider, usePathname, type Href } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useState } from 'react';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { WorkerSecurityProvider } from '../../components/WorkerSecurity';
import { RezkaTestSessionUnavailable } from '../../rezka/RezkaTestSessionUnavailable';
import { RezkaSessionWaiting } from '../../rezka/RezkaSessionWaiting';
import { localizedGetter } from '../../shared/localization';
import { RoleDrawer } from '../../shared/navigation/RoleDrawer';
import { confirmRoleDrawerLogout } from '../../shared/navigation/roleDrawerLogout';
import { RezkaShellContext, type RezkaDestination } from '../../rezka/RezkaShellContext';
import { isRezkaSessionCurrent } from '../../rezka/rezkaSessionGuard';
import { rezkaShellCanNavigate, rezkaShellDrawerItems } from '../../rezka/rezkaShellModel';
import { logoutRezkaSession, useRezkaLocale, useRezkaShellSession } from '../../rezka/useRezkaShell';

const paths: Record<RezkaDestination, Href> = { queue: '/ios-rezka' as Href, workers: '/ios-rezka/workers' as Href,
  daily: '/ios-rezka/daily' as Href, instructions: '/ios-rezka/instructions' as Href, profile: '/ios-rezka/profile' as Href };

export default function IosRezkaLayout() {
  const snapshot = useRezkaShellSession(), locale = useRezkaLocale(), pathname = usePathname(), colorScheme = useColorScheme();
  const [drawerOpen, setDrawerOpen] = useState(false), [signingOut, setSigningOut] = useState(false);
  if (Platform.OS !== 'ios' || snapshot === null) return <Redirect href="/" />;
  if (snapshot === 'test-token-unavailable') return <RezkaTestSessionUnavailable />;
  if (snapshot === 'transition-pending') return <RezkaSessionWaiting />;
  if (snapshot === undefined || signingOut) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!isRezkaSessionCurrent(snapshot, 'master')) return <Redirect href="/" />;
  const session = snapshot.session;
  const navigate = (destination: RezkaDestination) => {
    if (isRezkaSessionCurrent(snapshot, 'master') && rezkaShellCanNavigate(session, destination)) router.navigate(paths[destination]);
  };
  const onLogout = () => {
    if (!isRezkaSessionCurrent(snapshot, 'master')) return;
    setSigningOut(true); logoutRezkaSession(snapshot, () => router.replace('/'));
  };
  const active = pathname === '/ios-rezka' ? 'queue' : pathname === '/ios-rezka/workers' ? 'workers'
    : pathname === '/ios-rezka/daily' ? 'daily' : pathname === '/ios-rezka/instructions' ? 'instructions' : pathname === '/ios-rezka/profile' ? 'profile' : '';
  return <RezkaShellContext.Provider value={{ snapshot, openDrawer: () => setDrawerOpen(true), onLogout, navigate }}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
        <RoleDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}
          title={localizedGetter('adminDrawerSections', locale)} items={rezkaShellDrawerItems(session, locale)} active={active}
          closeAccessibilityLabel={localizedGetter('closeAction', locale)}
          footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', locale), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }}
          onSelect={id => { if (id === 'logout') confirmRoleDrawerLogout(onLogout); else if (id === 'queue' || id === 'workers' || id === 'daily' || id === 'instructions' || id === 'profile') navigate(id); }}>
          <NativeTabs>
            <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
              <NativeTabs.Trigger.Label>{localizedGetter('homeNavTitle', locale)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
            <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
              <NativeTabs.Trigger.Label>{localizedGetter('profileTitle', locale)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
          </NativeTabs>
        </RoleDrawer>
      </WorkerSecurityProvider>
    </ThemeProvider>
  </RezkaShellContext.Provider>;
}
