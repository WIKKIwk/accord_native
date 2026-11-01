import { Button, Host, HStack, Image, List, ProgressView, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, disabled, font, foregroundStyle, frame, lineLimit, listRowBackground, listRowInsets, listRowSeparator, listStyle, onAppear, padding, scrollContentBackground, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { loadChatDirectory, openChatConversation } from '../chatApi';
import type { ChatPeer } from '../chatModel';
import { profileRoleLabel } from '../profileModel';
import { ChatAvatar } from './ChatAvatar';
import { useChatMetadata } from './ChatMetadata';
import { useWorkerColors } from './useWorkerColors';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const transparentRow = listRowBackground('transparent');
const peerKey = (peer: ChatPeer) => JSON.stringify([peer.role, peer.ref]);

function DirectoryRow({ peer, session, token, opening, busy, onOpen }: {
  peer: ChatPeer; session: Session; token: string | null; opening: boolean; busy: boolean; onOpen: (peer: ChatPeer) => void;
}) {
  return <Button onPress={() => onOpen(peer)} modifiers={[buttonStyle('plain'), transparentRow, disabled(busy), listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 })]}>
    <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
      <RNHostView matchContents><ChatAvatar session={session} peer={peer} token={token} /></RNHostView>
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(1)]}>{peer.displayName || 'Foydalanuvchi'}</Text>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary, lineLimit(1)]}>{profileRoleLabel(peer.role)}</Text>
      </VStack>
      {opening ? <ProgressView /> : null}
    </HStack>
  </Button>;
}

function DirectoryPageFooter({ onVisible }: { onVisible: () => void }) {
  return <HStack modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden'), onAppear(onVisible)]}>
    <Spacer /><ProgressView /><Spacer />
  </HStack>;
}

export function ChatDirectoryScreen({ session }: { session: Session }) {
  const router = useRouter();
  const colors = useWorkerColors();
  const { remember } = useChatMetadata();
  const [items, setItems] = useState<ChatPeer[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<{ message: string; retryOffset: number } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingKey, setOpeningKey] = useState('');
  const [avatarToken, setAvatarToken] = useState(() => activeSessionToken(session));
  const focused = useRef(false);
  const queryRef = useRef('');
  const generation = useRef(0);
  const directoryRequest = useRef<AbortController | null>(null);
  const openingRequest = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoPage = useRef('');

  const load = useCallback(async (search: string, offset: number) => {
    if (!focused.current) return;
    directoryRequest.current?.abort();
    const controller = new AbortController();
    directoryRequest.current = controller;
    const current = ++generation.current;
    if (offset) setLoadingMore(true);
    setError(null);
    try {
      const page = await loadChatDirectory(session, search, offset, controller.signal);
      if (!focused.current || controller.signal.aborted || current !== generation.current || !activeSessionToken(session)) return;
      setItems(previous => {
        if (!offset) return page.items;
        const seen = new Set((previous ?? []).map(peerKey));
        return [...(previous ?? []), ...page.items.filter(peer => !seen.has(peerKey(peer)))];
      });
      setHasMore(page.hasMore);
      setNextOffset(offset + page.count);
      setAvatarToken(activeSessionToken(session));
    } catch (reason) {
      if (!focused.current || controller.signal.aborted || current !== generation.current || !activeSessionToken(session)) return;
      setError({ message: reason instanceof Error && reason.name !== 'TypeError' ? reason.message : 'Internetni tekshirib, qayta urinib ko‘ring.', retryOffset: offset });
    } finally {
      if (directoryRequest.current === controller) {
        directoryRequest.current = null;
        if (focused.current) setLoadingMore(false);
      }
    }
  }, [session]);

  const loadNextPage = useCallback(() => {
    if (!focused.current || directoryRequest.current || query !== queryRef.current) return;
    const pageKey = JSON.stringify([query, nextOffset]);
    if (lastAutoPage.current === pageKey) return;
    lastAutoPage.current = pageKey;
    void load(query, nextOffset);
  }, [load, nextOffset, query]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    lastAutoPage.current = '';
    void load(queryRef.current, 0);
    return () => {
      focused.current = false;
      generation.current++;
      directoryRequest.current?.abort();
      openingRequest.current?.abort();
      directoryRequest.current = null;
      openingRequest.current = null;
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [load]));

  const search = (value: string) => {
    queryRef.current = value;
    lastAutoPage.current = '';
    setQuery(value);
    generation.current++;
    directoryRequest.current?.abort();
    directoryRequest.current = null;
    if (debounce.current) clearTimeout(debounce.current);
    setItems(null);
    setHasMore(false);
    setLoadingMore(false);
    setError(null);
    debounce.current = setTimeout(() => { void load(value, 0); }, value.trim() ? 300 : 0);
  };

  const open = async (peer: ChatPeer) => {
    if (!focused.current || openingRequest.current) return;
    const controller = new AbortController();
    openingRequest.current = controller;
    setOpeningKey(peerKey(peer));
    try {
      const conversation = await openChatConversation(session, peer, controller.signal);
      if (!focused.current || controller.signal.aborted || !activeSessionToken(session)) return;
      remember([conversation]);
      router.replace({ pathname: '/ios-worker/chat/[conversationId]', params: { conversationId: conversation.id, title: conversation.title } });
    } catch (reason) {
      if (focused.current && !controller.signal.aborted && activeSessionToken(session)) {
        Alert.alert('Suhbatni ochib bo‘lmadi', reason instanceof Error && reason.name !== 'TypeError' ? reason.message : 'Internetni tekshirib, qayta urinib ko‘ring.');
      }
    } finally {
      if (openingRequest.current === controller) {
        openingRequest.current = null;
        if (focused.current) setOpeningKey('');
      }
    }
  };

  return <>
    <Stack.Screen options={{
      title: 'Yangi suhbat', headerLargeTitle: true, headerBackButtonDisplayMode: 'minimal',
      headerLargeTitleShadowVisible: false, headerShadowVisible: false, headerTransparent: true, scrollEdgeEffects: { top: 'soft' },
      headerSearchBarOptions: {
        placeholder: 'Foydalanuvchi qidirish', autoCapitalize: 'none', hideWhenScrolling: false, obscureBackground: false,
        onChangeText: event => search(event.nativeEvent.text), onCancelButtonPress: () => search(''),
      },
    }} />
    <Host style={[styles.root, { backgroundColor: colors.background }]}>
      <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
        {items === null && !error ? <HStack spacing={10} modifiers={[transparentRow, padding({ vertical: 14 }), listRowSeparator('hidden')]}>
          <ProgressView /><Text modifiers={[secondary]}>Foydalanuvchilar yuklanmoqda…</Text>
        </HStack> : null}
        {error && error.retryOffset === 0 ? <VStack alignment="leading" spacing={8} modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden')]}>
          <Text modifiers={[secondary]}>{error.message}</Text>
          <Button label="Qayta urinish" onPress={() => { void load(queryRef.current, error.retryOffset); }} modifiers={[buttonStyle('bordered')]} />
        </VStack> : null}
        {items !== null && !items.length && !error ? <VStack alignment="center" spacing={10} modifiers={[
          transparentRow, frame({ maxWidth: Infinity }), padding({ top: 44, bottom: 24 }), listRowSeparator('hidden'),
        ]}>
          <Image systemName={query.trim() ? 'magnifyingglass' : 'person.2'} size={34} modifiers={[secondary]} />
          <Text modifiers={[font({ textStyle: 'headline' })]}>{query.trim() ? 'Foydalanuvchi topilmadi' : 'Foydalanuvchilar yo‘q'}</Text>
          {query.trim() ? <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>Boshqa ism bilan qidirib ko‘ring.</Text> : null}
        </VStack> : null}
        {(items ?? []).map(peer => <DirectoryRow key={peerKey(peer)} peer={peer} session={session} token={avatarToken}
          opening={openingKey === peerKey(peer)} busy={!!openingKey} onOpen={target => { void open(target); }} />)}
        {error && error.retryOffset > 0 ? <VStack alignment="center" spacing={8} modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden')]}>
          <Text modifiers={[secondary]}>{error.message}</Text>
          <Button label="Qayta urinish" onPress={() => { void load(queryRef.current, error.retryOffset); }} modifiers={[buttonStyle('bordered'), disabled(loadingMore)]} />
        </VStack> : null}
        {hasMore && nextOffset > 0 && !error
          ? <DirectoryPageFooter key={`${query}:${nextOffset}`} onVisible={loadNextPage} /> : null}
      </List>
    </Host>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
