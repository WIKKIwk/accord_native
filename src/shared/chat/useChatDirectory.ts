import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { activeSessionToken, type Session } from '../../auth';
import { loadChatDirectory, openChatConversation } from '../../chatApi';
import type { ChatConversation, ChatPeer } from '../../chatModel';
import { useChatMetadata } from '../../components/ChatMetadata';
const peerKey = (peer: ChatPeer) => JSON.stringify([peer.role, peer.ref]);

export function useChatDirectory(session: Session, onOpenConversation: (conversation: ChatConversation) => void) {
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
      onOpenConversation(conversation);
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

  return { items, query, queryRef, error, hasMore, nextOffset, loadingMore, openingKey, avatarToken, load, loadNextPage, search, open };
}
