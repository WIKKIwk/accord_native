import { Button, Host, HStack, Image, List, ProgressView, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, contentShape, font, foregroundStyle, frame, lineLimit, listRowInsets, listRowSeparator, listStyle, padding, refreshable, scrollContentBackground, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { loadChatConversations } from '../chatApi';
import { subscribeChatLive } from '../chatLive';
import { chatTime, filterChatConversations, type ChatConversation } from '../chatModel';
import { ChatAvatar } from './ChatAvatar';
import { useChatMetadata } from './ChatMetadata';

type Props = { session: Session; onOpenDrawer?: () => void };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function ConversationRow({ conversation, session, token, onOpen }: { conversation: ChatConversation; session: Session; token: string | null; onOpen: (item: ChatConversation) => void }) {
  return <Button onPress={() => onOpen(conversation)} modifiers={[buttonStyle('plain'), listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 })]}>
  <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
    <RNHostView matchContents><ChatAvatar session={session} peer={conversation.peer} token={token} /></RNHostView>
    <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'body', weight: conversation.unreadCount ? 'semibold' : 'medium' }), lineLimit(1)]}>{conversation.title}</Text>
      <Text modifiers={[font({ textStyle: 'subheadline' }), secondary, lineLimit(1)]}>{conversation.preview}</Text>
    </VStack>
    <VStack alignment="trailing" spacing={6}>
      <Text modifiers={[font({ textStyle: 'caption' }), conversation.unreadCount ? foregroundStyle('#007AFF') : secondary]}>{chatTime(conversation.timestamp)}</Text>
      {conversation.unreadCount ? <Text modifiers={[
        font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle('#ffffff'), padding({ horizontal: 7, vertical: 3 }),
        background('#007AFF', shapes.capsule()),
      ]}>{conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount)}</Text> : null}
    </VStack>
  </HStack>
  </Button>;
}

function ChatList({ items, error, query, session, avatarToken, onRefresh, onOpen }: {
  items: ChatConversation[] | null; error: string; query: string; session: Session; avatarToken: string | null; onRefresh: () => Promise<void>; onOpen: (item: ChatConversation) => void;
}) {
  const visible = filterChatConversations(items ?? [], query);
  return <Host style={styles.root}>
    <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(onRefresh)]}>
      {items === null && !error ? <HStack spacing={10} modifiers={[padding({ vertical: 14 }), listRowSeparator('hidden')]}>
        <ProgressView /><Text modifiers={[secondary]}>Chatlar yuklanmoqda…</Text>
      </HStack> : null}
      {error ? <VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 10 }), listRowSeparator('hidden')]}>
        <Text modifiers={[secondary]}>{error}</Text>
        <Button label="Qayta urinish" onPress={() => { void onRefresh(); }} modifiers={[buttonStyle('bordered')]} />
      </VStack> : null}
      {items !== null && !visible.length ? <VStack alignment="center" spacing={10} modifiers={[
        frame({ maxWidth: Infinity }), padding({ top: 44, bottom: 24 }), listRowSeparator('hidden'),
      ]}>
        <Image systemName={query.trim() ? 'magnifyingglass' : 'bubble.left.and.bubble.right'} size={34} modifiers={[secondary]} />
        <Text modifiers={[font({ textStyle: 'headline' })]}>{query.trim() ? 'Chat topilmadi' : 'Hali suhbatlar yo‘q'}</Text>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{query.trim() ? 'Boshqa so‘z bilan qidirib ko‘ring.' : 'Suhbatlar shu yerda ko‘rinadi.'}</Text>
      </VStack> : null}
      {visible.map(conversation => <ConversationRow key={conversation.id} conversation={conversation} session={session} token={avatarToken} onOpen={onOpen} />)}
    </List>
  </Host>;
}

export function ChatConversationsScreen({ session, onOpenDrawer }: Props) {
  const router = useRouter();
  const { remember } = useChatMetadata();
  const [items, setItems] = useState<ChatConversation[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [avatarToken, setAvatarToken] = useState(() => activeSessionToken(session));
  const focused = useRef(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!focused.current || (AppState.currentState != null && AppState.currentState !== 'active')) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    try {
      const page = await loadChatConversations(session, controller.signal);
      if (!focused.current || controller.signal.aborted || current !== generation.current || !activeSessionToken(session)) return;
      setItems(page.items);
      remember(page.items);
      setAvatarToken(activeSessionToken(session));
      setError('');
    } catch (reason) {
      if (!focused.current || controller.signal.aborted || current !== generation.current || !activeSessionToken(session)) return;
      setError(reason instanceof Error && reason.name !== 'TypeError' ? reason.message : 'Internetni tekshirib, qayta urinib ko‘ring.');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [remember, session]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refresh();
    const stopLive = subscribeChatLive(session, () => { void refresh(); });
    const timer = setInterval(() => { void refresh(); }, 30000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
      else { generation.current++; request.current?.abort(); request.current = null; }
    });
    return () => {
      focused.current = false;
      generation.current++;
      request.current?.abort();
      request.current = null;
      clearInterval(timer);
      appState.remove();
      stopLive();
    };
  }, [refresh, session]));

  return <>
    <Stack.Screen options={{
      title: 'Chatlar', headerLargeTitle: true, headerLargeTitleShadowVisible: false,
      headerShadowVisible: false, headerTransparent: true, scrollEdgeEffects: { top: 'soft' },
      headerSearchBarOptions: {
        placeholder: 'Chatlardan qidirish', autoCapitalize: 'none', hideWhenScrolling: true, obscureBackground: false,
        onChangeText: event => setQuery(event.nativeEvent.text), onCancelButtonPress: () => setQuery(''),
      },
    }} />
    {onOpenDrawer ? <Stack.Toolbar placement="left"><Stack.Toolbar.Button icon="line.3.horizontal" accessibilityLabel="Bo‘limlar" onPress={onOpenDrawer} /></Stack.Toolbar> : null}
    <ChatList items={items} error={error} query={query} session={session} avatarToken={avatarToken} onRefresh={refresh}
      onOpen={conversation => router.push({ pathname: '/ios-worker/chat/[conversationId]', params: { conversationId: conversation.id, title: conversation.title } })} />
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
