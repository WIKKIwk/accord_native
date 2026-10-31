import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LoginScreen } from '../LoginScreen';
import { WorkerScreen } from '../WorkerScreen';
import { loadSession, logout, type Session } from '../auth';

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadSession().then(value => { if (active) setSession(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <WorkerScreen session={session} onLogout={() => {
    setLoading(true);
    void logout(session).catch(() => {}).finally(() => {
      setSession(null);
      setLoading(false);
    });
  }} />;
}
