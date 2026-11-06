import { Redirect, Stack, router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { activeSessionToken, loadSession, logout, registerSessionResetHook, type Session } from '../../auth';
import { clearAppLock } from '../../appLock';
import { loadChatConversations } from '../../chatApi';
import { ChatConversationsScreen } from '../../components/ChatConversationsScreen';
import { ChatDirectoryScreen } from '../../components/ChatDirectoryScreen';
import { ChatThreadScreen } from '../../components/ChatThreadScreen';
import { useChatMetadata } from '../../components/ChatMetadata';
import { WorkerSecurityProvider } from '../../components/WorkerSecurity';
import { ChatRouteProvider, useChatRoute } from './ChatRouteContext';

export function ChatRouteStack() {
  const { basePath, onClosingChange } = useChatRoute();
  const pathname = usePathname();
  return <Stack>
    <Stack.Screen name="index" listeners={{ focus: () => onClosingChange?.(false) }} />
    <Stack.Screen name="new" listeners={{ transitionStart: event => {
      if (!event.data.closing || pathname === `${basePath}/new`) onClosingChange?.(event.data.closing);
    }, gestureCancel: () => onClosingChange?.(false) }} />
    <Stack.Screen name="[conversationId]" listeners={{ transitionStart: event => onClosingChange?.(event.data.closing),
      gestureCancel: () => onClosingChange?.(false) }} />
  </Stack>;
}

export function ChatListPage() {
  const { session, navigation, onOpenDrawer, onBack } = useChatRoute();
  return <ChatConversationsScreen key={session.imageCacheScope} session={session} navigation={navigation} onOpenDrawer={onOpenDrawer} onBack={onBack} />;
}
export function ChatDirectoryPage() {
  const { session, navigation } = useChatRoute();
  return <ChatDirectoryScreen key={session.imageCacheScope} session={session} onOpenConversation={navigation.replaceConversation} />;
}
export function ChatThreadPage() {
  const { session } = useChatRoute();
  const { conversationId, title } = useLocalSearchParams<{ conversationId: string; title?: string }>();
  const { conversations, remember } = useChatMetadata();
  const metadata = conversations.get(conversationId);
  useFocusEffect(useCallback(() => {
    if (metadata) return;
    const controller = new AbortController();
    void loadChatConversations(session, controller.signal).then(page => {
      if (!controller.signal.aborted && activeSessionToken(session)) remember(page.items);
    }).catch(() => {});
    return () => controller.abort();
  }, [metadata, remember, session]));
  return <ChatThreadScreen key={`${session.imageCacheScope}:${conversationId}`} session={session} conversationId={conversationId}
    title={metadata?.title ?? title ?? ''} peer={metadata?.peer ?? null} />;
}

/** All logged-in roles can open this route without supplying a worker context. */
export function StandaloneChatLayout({ basePath }: { basePath: string }) {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    let active = true;
    void loadSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    const unregister = registerSessionResetHook(async () => { if (active) setSession(null); });
    return () => { active = false; unregister(); };
  }, []);
  if (session === undefined) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/" />;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})])
    .finally(() => { setSession(null); router.replace('/'); }); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <ChatRouteProvider session={session} basePath={basePath} onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}>
      <ChatRouteStack />
    </ChatRouteProvider>
  </WorkerSecurityProvider>;
}
