import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { ChatRequestError, loadChatMessages, markChatRead } from './chatApi';
import { sendChatImage, uploadChatImage, type PickedChatImage } from './chatMedia';
import { subscribeChatLive } from './chatLive';
import { mergeChatMessages, reconcileChatRefresh, type ChatMessage } from './chatModel';
import { chatDeviceId, pendingChatTexts, queueChatText, type PendingChatText } from './chatOutbox';
import { flushChatOutbox } from './chatOutboxDelivery';

export function useChatThread(session: Session, conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [pending, setPending] = useState<PendingChatText[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [queueing, setQueueing] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [lastQueuedId, setLastQueuedId] = useState<string | null>(null);
  const focused = useRef(false);
  const storageReadyRef = useRef(false);
  const uploadingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const initialized = useRef(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const olderRequest = useRef<AbortController | null>(null);
  const sendRequest = useRef<AbortController | null>(null);
  const draining = useRef(false);
  const drainAgain = useRef(false);
  const resumeDrain = useRef<(() => void) | null>(null);
  const queueingRef = useRef(false);
  const retryBlocked = useRef(false);
  const restoreStorage = useRef<(() => void) | null>(null);

  const visible = useCallback(() => focused.current && activeSessionToken(session) !== null &&
    (AppState.currentState == null || AppState.currentState === 'active'), [session]);
  const merge = useCallback((incoming: ChatMessage[]) => {
    const next = mergeChatMessages(messagesRef.current, incoming);
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!visible()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    try {
      const page = await loadChatMessages(session, conversationId, controller.signal);
      if (!visible() || controller.signal.aborted || current !== generation.current) return;
      const reconciled = reconcileChatRefresh(messagesRef.current, page.items);
      if (!initialized.current || reconciled.droppedOlder) {
        setHasMore(reconciled.droppedOlder || page.hasMore);
        initialized.current = true;
      }
      if (reconciled.droppedOlder) olderRequest.current?.abort();
      messagesRef.current = reconciled.items;
      setMessages(reconciled.items);
      setError('');
      const sequence = page.items.at(-1)?.sequence ?? 0;
      if (sequence) {
        try {
          const deviceId = await chatDeviceId();
          if (visible() && !controller.signal.aborted && current === generation.current) {
            await markChatRead(session, conversationId, sequence, deviceId, controller.signal);
          }
        } catch { /* A later refresh retries the receipt. */ }
      }
    } catch (reason) {
      if (!visible() || controller.signal.aborted || current !== generation.current) return;
      setError(reason instanceof Error && reason.name !== 'TypeError' ? reason.message : 'Internetni tekshirib, qayta urinib ko‘ring.');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [conversationId, session, visible]);

  const loadOlder = useCallback(async () => {
    const before = messagesRef.current[0]?.sequence;
    if (!visible() || !before || olderRequest.current) return;
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingMore(true);
    try {
      const page = await loadChatMessages(session, conversationId, controller.signal, before);
      if (!visible() || controller.signal.aborted) return;
      merge(page.items);
      setHasMore(page.hasMore);
      setError('');
    } catch (reason) {
      if (visible() && !controller.signal.aborted) setError(reason instanceof Error && reason.name !== 'TypeError' ? reason.message : 'Avvalgi xabarlarni yuklab bo‘lmadi.');
    } finally {
      if (olderRequest.current === controller) olderRequest.current = null;
      if (focused.current) setLoadingMore(false);
    }
  }, [conversationId, merge, session, visible]);

  const drain = useCallback(async (manual = false) => {
    if (!visible() || !storageReadyRef.current || (retryBlocked.current && !manual)) return;
    if (manual) retryBlocked.current = false;
    if (draining.current) { drainAgain.current = true; return; }
    draining.current = true;
    setSending(true);
    setSendError('');
    const controller = new AbortController();
    sendRequest.current = controller;
    try {
      await flushChatOutbox(session, conversationId, controller.signal, (message, item) => {
        if (!focused.current || !activeSessionToken(session)) return;
        merge([message]);
        setPending(current => current.filter(value => value.clientMessageId !== item.clientMessageId));
      });
    } catch (reason) {
      if (visible() && !sendRequest.current?.signal.aborted) {
        if (reason instanceof ChatRequestError && reason.status >= 400 && reason.status < 500 && reason.status !== 408 && reason.status !== 429) retryBlocked.current = true;
        setSendError('Xabar yuborilmadi. Qayta urinib ko‘ring.');
      }
    } finally {
      sendRequest.current = null;
      draining.current = false;
      if (focused.current) setSending(false);
      if (drainAgain.current) {
        drainAgain.current = false;
        if (visible() && !retryBlocked.current) setTimeout(() => resumeDrain.current?.(), 0);
      }
    }
  }, [conversationId, merge, session, visible]);

  const send = useCallback(async (body: string): Promise<boolean> => {
    if (!visible() || !storageReadyRef.current || queueingRef.current) return false;
    queueingRef.current = true;
    setQueueing(true);
    try {
      const item = await queueChatText(session, conversationId, body);
      if (focused.current && activeSessionToken(session)) {
        setPending(current => [...current, item]);
        setLastQueuedId(item.clientMessageId);
        retryBlocked.current = false;
        if (visible()) void drain();
      }
      return true;
    } catch (reason) {
      if (visible()) setSendError(reason instanceof Error && reason.message === 'Xabar matni noto‘g‘ri.' ? reason.message : 'Xabarni saqlab bo‘lmadi. Qayta urinib ko‘ring.');
      return false;
    } finally {
      queueingRef.current = false;
      if (focused.current) setQueueing(false);
    }
  }, [conversationId, drain, session, visible]);

  /** Photos upload online only; a finished upload never depends on the screen staying open. */
  const sendImage = useCallback(async (image: PickedChatImage): Promise<boolean> => {
    if (!visible() || uploadingRef.current) return false;
    uploadingRef.current = true;
    setUploading(true);
    setUploadProgress(0);
    setSendError('');
    try {
      const media = await uploadChatImage(session, conversationId, image, progress => {
        if (focused.current) setUploadProgress(progress);
      });
      const message = await sendChatImage(session, conversationId, media.mediaId);
      if (focused.current && activeSessionToken(session)) merge([message]);
      return true;
    } catch (reason) {
      if (focused.current) setSendError(reason instanceof Error ? reason.message : 'Rasm yuborilmadi.');
      return false;
    } finally {
      uploadingRef.current = false;
      if (focused.current) {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  }, [conversationId, merge, session, visible]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    resumeDrain.current = () => { void drain(); };
    setStorageReady(false);
    setQueueing(queueingRef.current);
    setSending(draining.current);
    setLoadingMore(!!olderRequest.current && !olderRequest.current.signal.aborted);
    let active = true;
    let restoring = false;
    void refresh();
    const restore = async () => {
      if (!visible() || restoring || storageReadyRef.current) return;
      restoring = true;
      try {
        const restored = await pendingChatTexts(session, conversationId);
        if (!active || !visible()) return;
        setPending(restored);
        storageReadyRef.current = true;
        setStorageReady(true);
        setSendError('');
        void drain();
      } catch {
        if (active && visible()) setSendError('Xabarlar uchun qurilma xotirasini ochib bo‘lmadi.');
      } finally { restoring = false; }
    };
    restoreStorage.current = () => { void restore(); };
    void restore();
    const stopLive = subscribeChatLive(session, () => { void refresh(); void drain(); });
    const timer = setInterval(() => { void refresh(); void drain(); }, 30000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setQueueing(queueingRef.current);
        setSending(draining.current);
        setLoadingMore(!!olderRequest.current && !olderRequest.current.signal.aborted);
        void restore(); void refresh(); void drain();
      }
      else {
        generation.current++;
        request.current?.abort();
        olderRequest.current?.abort();
        sendRequest.current?.abort();
      }
    });
    return () => {
      active = false;
      focused.current = false;
      resumeDrain.current = null;
      storageReadyRef.current = false;
      restoreStorage.current = null;
      generation.current++;
      request.current?.abort();
      olderRequest.current?.abort();
      sendRequest.current?.abort();
      clearInterval(timer);
      appState.remove();
      stopLive();
    };
  }, [conversationId, drain, refresh, session, visible]));

  const retry = useCallback(() => {
    if (!storageReadyRef.current) { restoreStorage.current?.(); return; }
    void drain(true);
  }, [drain]);

  return { messages, pending, hasMore, loadingMore, error, sendError, queueing, sending, uploading, uploadProgress, storageReady, lastQueuedId, refresh, loadOlder, send, sendImage, retry };
}
