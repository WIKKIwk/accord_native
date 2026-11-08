import { router } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { Session } from '../../auth';
import { ChatMetadataProvider } from '../../components/ChatMetadata';
import { createChatNavigation } from './chatNavigation';
import { ChatLivePolicyProvider, type ChatLivePolicy } from './ChatLivePolicy';
import { secureChatUnavailableReason } from './chatSecureReadiness';

type ChatRouteValue = { session: Session; basePath: string; livePolicy?: ChatLivePolicy; onOpenDrawer?: () => void; onBack?: () => void; onClosingChange?: (closing: boolean) => void };
const ChatRouteContext = createContext<(ChatRouteValue & { navigation: ReturnType<typeof createChatNavigation> }) | null>(null);

export function ChatRouteProvider({ children, ...props }: ChatRouteValue & { children: ReactNode }) {
  const navigation = useMemo(() => createChatNavigation(props.basePath, router), [props.basePath]);
  const unavailable = props.livePolicy === 'secure' ? secureChatUnavailableReason() : null;
  return <ChatLivePolicyProvider policy={props.livePolicy ?? 'legacy'}><ChatRouteContext.Provider value={{ ...props, navigation }}>
    {unavailable ? <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}><Text>{unavailable}</Text></View>
      : <ChatMetadataProvider key={props.session.imageCacheScope}>{children}</ChatMetadataProvider>}
  </ChatRouteContext.Provider></ChatLivePolicyProvider>;
}

export function useChatRoute() {
  const value = useContext(ChatRouteContext);
  if (!value) throw new Error('Chat pages require ChatRouteProvider');
  return value;
}
