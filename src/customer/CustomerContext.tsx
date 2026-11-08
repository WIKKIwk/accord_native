import { Redirect, router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { appPreferences } from '../appPreferences';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { notificationHiddenStore, notificationUnreadStore, refreshHub } from '../shared/notificationStoresRuntime';
import { CustomerNotificationsController } from './customerNotifications';
import { createCustomerStore } from './customerRuntime';
import type { CustomerStore } from './customerStore';

type CustomerContextValue = { session: Session; store: CustomerStore; notifications: CustomerNotificationsController; onLogout: () => void; chatUnread: number };
const CustomerContext = createContext<CustomerContextValue | null>(null);
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function useCustomerText() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return useMemo(() => ({ locale, text: (key: string) => localizedGetter(key, locale),
    method: (key: string, values: Record<string, unknown>) => localizedMethod(key, locale, values) }), [locale]);
}

function CustomerProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const store = useMemo(() => createCustomerStore(session), [session]);
  const chatUnread = useChatUnreadCount(session);
  const notifications = useMemo(() => new CustomerNotificationsController({ session, store, storage: appPreferences,
    hidden: notificationHiddenStore, unread: notificationUnreadStore, refreshHub,
    schedule: callback => { requestAnimationFrame(callback); } }), [session, store]);
  useEffect(() => registerSessionResetHook(() => notifications.resetSession()), [notifications]);
  useEffect(() => { store.activate(); return () => { notifications.stop(); store.dispose(); }; }, [notifications, store]);
  return <CustomerContext.Provider value={{ session, store, notifications, onLogout, chatUnread }}>{children}</CustomerContext.Provider>;
}

export function CustomerGate({ platform, children }: { platform: 'ios' | 'android'; children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true; const expected = generation.current;
    void loadSession().then(value => { if (mounted && expected === generation.current) setSession(value); })
      .catch(() => { if (mounted && expected === generation.current) setSession(null); });
    const unregister = registerSessionResetHook(async () => { generation.current++; if (mounted) setSession(null); });
    return () => { mounted = false; unregister(); };
  }, []);
  if (Platform.OS !== platform || session === null || (session && !canOpenRoute(session, appRoutes.customerHome))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})])
    .finally(() => { setSession(null); router.replace('/'); }); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <CustomerProvider session={session} onLogout={onLogout}>{children}</CustomerProvider>
  </WorkerSecurityProvider>;
}

export function useCustomerContext(): CustomerContextValue {
  const value = useContext(CustomerContext);
  if (!value) throw new Error('Customer session unavailable');
  return value;
}

export function useCustomerStore(): CustomerStore {
  const { store } = useCustomerContext();
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const version = useCallback(() => store.version, [store]);
  useSyncExternalStore(subscribe, version, version);
  return store;
}

export function useCustomerUnread(): boolean {
  const { session } = useCustomerContext();
  const subscribe = useCallback((listener: () => void) => notificationUnreadStore.subscribe(listener), []);
  const snapshot = useCallback(() => notificationUnreadStore.hasUnreadForProfile(session), [session]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
