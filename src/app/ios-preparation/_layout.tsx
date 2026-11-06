import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, type Session } from '../../auth';
import { clearAppLock } from '../../appLock';
import { WorkerSecurityProvider } from '../../components/WorkerSecurity';
import { PreparationProvider } from '../../preparation/PreparationContext';
import { usePreparationText } from '../../preparation/PreparationUI';
import { appRoutes, canOpenRoute } from '../../shared/appRoutes';

export default function PreparationLayout() {
  const t = usePreparationText();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => { let active = true; void loadSession().then(value => { if (active) setSession(value); })
    .catch(() => { if (active) setSession(null); }); return () => { active = false; }; }, []);
  if (Platform.OS !== 'ios' || session === null || (session && !canOpenRoute(session, appRoutes.preparation))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => setSession(null)); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <PreparationProvider session={session} onLogout={onLogout}><NativeTabs>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t('Tayyorlov')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>{t('Profil')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs></PreparationProvider>
  </WorkerSecurityProvider>;
}
