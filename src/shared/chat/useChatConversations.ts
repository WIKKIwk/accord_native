import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, type Session } from '../../auth';
import { loadChatConversations } from '../../chatApi';
import { subscribeChatLive } from '../../chatLive';
import type { ChatConversation } from '../../chatModel';
import { useChatMetadata } from '../../components/ChatMetadata';
import { existingChatUnreadRuntimeFor, subscribeChatUnreadRuntimeChanges } from './chatUnreadRuntime';
import { useChatLivePolicy } from './ChatLivePolicy';
import { SECURE_CHAT_UNAVAILABLE } from './chatSecureSocket';
import { subscribeSecureChatLive } from './secureChatLive';

const noUnreadRuntime = () => null;

export function useChatConversations(session: Session) {
  const policy = useChatLivePolicy();
  const unreadRuntime = useSyncExternalStore(subscribeChatUnreadRuntimeChanges, () => existingChatUnreadRuntimeFor(session, policy), noUnreadRuntime);
  const { remember } = useChatMetadata();
  const [items, setItems] = useState<ChatConversation[] | null>(null);
  const [error, setError] = useState('');
  const [liveError, setLiveError] = useState('');
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
    const onInvalidate = () => { void refresh(); };
    let stopLive = () => {};
    if (policy === 'secure') setLiveError('');
    if (unreadRuntime) stopLive = unreadRuntime.subscribeInvalidation(onInvalidate);
    else if (policy === 'secure') {
      try {
        stopLive = subscribeSecureChatLive(session, onInvalidate, undefined, state => {
          if (state === 'ready') setLiveError('');
          else if (state === 'unavailable') setLiveError('Chat aloqasi ochilmadi.');
        });
      } catch (reason) {
        setLiveError(reason instanceof Error && reason.message === SECURE_CHAT_UNAVAILABLE ? reason.message : 'Chat aloqasi ochilmadi.');
      }
    } else stopLive = subscribeChatLive(session, onInvalidate);
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
  }, [policy, refresh, session, unreadRuntime]));

  return { items, error: (policy === 'secure' && liveError) || error, query, setQuery, avatarToken, refresh };
}
