import { Button, Host, HStack, Image, List, ProgressView, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, contentShape, font, foregroundStyle, frame, lineLimit, listRowBackground, listRowInsets, listRowSeparator, listStyle, padding, refreshable, scrollContentBackground, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { PlatformColor, StyleSheet } from 'react-native';
import type { Session } from '../auth';
import { chatTime, filterChatConversations, type ChatConversation } from '../chatModel';
import { ChatAvatar } from './ChatAvatar';
import { useWorkerColors } from './useWorkerColors';

import type { ChatConversationsProps as Props } from '../shared/chat/chatPageTypes';
import { useChatConversations } from '../shared/chat/useChatConversations';
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const transparentRow = listRowBackground('transparent');

function ConversationRow({ conversation, session, token, onOpen }: { conversation: ChatConversation; session: Session; token: string | null; onOpen: (item: ChatConversation) => void }) {
  return <Button onPress={() => onOpen(conversation)} modifiers={[buttonStyle('plain'), transparentRow, listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 })]}>
  <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
    <RNHostView matchContents><ChatAvatar session={session} peer={conversation.peer} token={token} /></RNHostView>
    <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'body', weight: conversation.unreadCount ? 'semibold' : 'medium' }), lineLimit(1)]}>{conversation.title}</Text>
      <Text modifiers={[font({ textStyle: 'subheadline' }), secondary, lineLimit(1)]}>{conversation.preview}</Text>
    </VStack>
    <VStack alignment="trailing" spacing={6}>
      <Text modifiers={[font({ textStyle: 'caption' }), conversation.unreadCount ? foregroundStyle(PlatformColor('systemBlue')) : secondary]}>{chatTime(conversation.timestamp)}</Text>
      {conversation.unreadCount ? <Text modifiers={[
        font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle('white'), padding({ horizontal: 7, vertical: 3 }),
        background(PlatformColor('systemBlue'), shapes.capsule()),
      ]}>{conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount)}</Text> : null}
    </VStack>
  </HStack>
  </Button>;
}

function ChatList({ items, error, query, session, avatarToken, onRefresh, onOpen }: {
  items: ChatConversation[] | null; error: string; query: string; session: Session; avatarToken: string | null; onRefresh: () => Promise<void>; onOpen: (item: ChatConversation) => void;
}) {
  const visible = filterChatConversations(items ?? [], query);
  const colors = useWorkerColors();
  return <Host style={[styles.root, { backgroundColor: colors.background }]}>
    <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), refreshable(onRefresh)]}>
      {items === null && !error ? <HStack spacing={10} modifiers={[transparentRow, padding({ vertical: 14 }), listRowSeparator('hidden')]}>
        <ProgressView /><Text modifiers={[secondary]}>Chatlar yuklanmoqda…</Text>
      </HStack> : null}
      {error ? <VStack alignment="leading" spacing={8} modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden')]}>
        <Text modifiers={[secondary]}>{error}</Text>
        <Button label="Qayta urinish" onPress={() => { void onRefresh(); }} modifiers={[buttonStyle('bordered')]} />
      </VStack> : null}
      {items !== null && !visible.length ? <VStack alignment="center" spacing={10} modifiers={[
        transparentRow, frame({ maxWidth: Infinity }), padding({ top: 44, bottom: 24 }), listRowSeparator('hidden'),
      ]}>
        <Image systemName={query.trim() ? 'magnifyingglass' : 'bubble.left.and.bubble.right'} size={34} modifiers={[secondary]} />
        <Text modifiers={[font({ textStyle: 'headline' })]}>{query.trim() ? 'Chat topilmadi' : 'Hali suhbatlar yo‘q'}</Text>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{query.trim() ? 'Boshqa so‘z bilan qidirib ko‘ring.' : 'Suhbatlar shu yerda ko‘rinadi.'}</Text>
      </VStack> : null}
      {visible.map(conversation => <ConversationRow key={conversation.id} conversation={conversation} session={session} token={avatarToken} onOpen={onOpen} />)}
    </List>
  </Host>;
}

export function ChatConversationsScreen({ session, onOpenDrawer, onBack, navigation }: Props) {
  const { items, error, query, setQuery, avatarToken, refresh } = useChatConversations(session);
  return <>
    <Stack.Screen options={{
      title: 'Chatlar', headerLargeTitle: true, headerLargeTitleShadowVisible: false,
      headerShadowVisible: false, headerTransparent: true, scrollEdgeEffects: { top: 'soft' },
      headerSearchBarOptions: {
        placeholder: 'Chatlardan qidirish', autoCapitalize: 'none', hideWhenScrolling: true, obscureBackground: false,
        onChangeText: event => setQuery(event.nativeEvent.text), onCancelButtonPress: () => setQuery(''),
      },
    }} />
    {onBack ? <Stack.Toolbar placement="left"><Stack.Toolbar.Button icon="chevron.left" accessibilityLabel="Orqaga" onPress={onBack} /></Stack.Toolbar> : null}
    {onOpenDrawer ? <Stack.Toolbar placement="left"><Stack.Toolbar.Button icon="line.3.horizontal" accessibilityLabel="Bo‘limlar" onPress={onOpenDrawer} /></Stack.Toolbar> : null}
    <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="square.and.pencil" accessibilityLabel="Yangi suhbat" onPress={navigation.openDirectory} /></Stack.Toolbar>
    <ChatList items={items} error={error} query={query} session={session} avatarToken={avatarToken} onRefresh={refresh}
      onOpen={navigation.openConversation} />
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
