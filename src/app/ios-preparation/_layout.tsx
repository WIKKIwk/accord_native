import { Redirect, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, type Session } from '../../auth';
import { clearAppLock } from '../../appLock';
import { WorkerSecurityProvider } from '../../components/WorkerSecurity';
import { PreparationProvider } from '../../preparation/PreparationContext';
import { PreparationDrawer } from '../../preparation/PreparationDrawer';
import { usePreparationText } from '../../preparation/PreparationUI';
import { appRoutes, canOpenRoute } from '../../shared/appRoutes';
import { RoleTabs, roleTabIcons } from '../../shared/navigation/RoleTabs.ios';

export default function PreparationLayout() {
  const t = usePreparationText(), pathname = usePathname();
  const [chatClosing, setChatClosing] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => { let active = true; void loadSession().then(value => { if (active) setSession(value); })
    .catch(() => { if (active) setSession(null); }); return () => { active = false; }; }, []);
  if (Platform.OS !== 'ios' || session === null || (session && !canOpenRoute(session, appRoutes.preparation))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => setSession(null)); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <PreparationProvider session={session} onLogout={onLogout} setChatClosing={setChatClosing}><PreparationDrawer>
      <RoleTabs hidden={pathname.startsWith('/ios-preparation/chat/') && !chatClosing} disableHiddenAnimation tabs={[
        { name: '(home)', label: t('Tayyorlov'), icon: roleTabIcons.home },
        { name: 'chat', label: t('Chat'), icon: roleTabIcons.chat },
        { name: 'profile', label: t('Profil'), icon: roleTabIcons.profile },
      ]} />
    </PreparationDrawer></PreparationProvider>
  </WorkerSecurityProvider>;
}
