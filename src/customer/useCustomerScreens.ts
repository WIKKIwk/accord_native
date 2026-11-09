import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { customerDeliveryDetail, customerRespondDelivery, type CustomerDeliveryDetail } from './customerApi';
import type { CustomerDeliveryResponse } from './customerLogic';
import { useCustomerContext, useCustomerStore, useCustomerText } from './CustomerContext';
import { refreshHub } from '../shared/notificationStoresRuntime';
import type { CustomerStatusKind } from './customerStore';

function useBootstrapAndRefreshTopic() {
  const store = useCustomerStore();
  useEffect(() => {
    void store.bootstrap();
    let version = 0, mounted = true;
    const unsubscribe = refreshHub.subscribe(() => {
      if (!mounted || refreshHub.topic !== 'customer' || version === refreshHub.version) return;
      version = refreshHub.version;
      requestAnimationFrame(() => { if (mounted) void store.refresh(); });
    });
    return () => { mounted = false; unsubscribe(); };
  }, [store]);
  return store;
}

export function useCustomerHome() {
  const store = useBootstrapAndRefreshTopic();
  return { loading: store.loading, loaded: store.loaded, error: store.error, summary: store.summary,
    records: store.historyItems, refresh: () => store.refresh() };
}

export function useCustomerStatus(kind: CustomerStatusKind) {
  const store = useCustomerStore();
  useEffect(() => { void store.bootstrap(); }, [store]);
  return { loading: store.loading, loaded: store.loaded, error: store.error, records: store.itemsForKind(kind), refresh: () => store.refresh() };
}

export function useCustomerNotifications() {
  const { notifications, store } = useCustomerContext();
  const subscribe = useCallback((listener: () => void) => notifications.subscribe(listener), [notifications]);
  const version = useCallback(() => notifications.version, [notifications]);
  useSyncExternalStore(subscribe, version, version);
  const storeSubscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const storeVersion = useCallback(() => store.version, [store]);
  useSyncExternalStore(storeSubscribe, storeVersion, storeVersion);
  // V2 keeps its refresh listener while a delivery detail is pushed on top.
  useEffect(() => { notifications.start(); return () => notifications.stop(); }, [notifications]);
  return { loading: store.loading, loaded: store.loaded, error: store.error, records: notifications.items,
    highlightedIds: notifications.highlightedIds, refresh: () => notifications.reload(),
    markSeen: (id: string) => notifications.markDetailSeen(id), clearAll: () => notifications.clearAll() };
}

export function useCustomerDelivery(deliveryNoteID: string, onChanged: () => void) {
  const { session, store } = useCustomerContext();
  const { method } = useCustomerText();
  const [detail, setDetail] = useState<CustomerDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false), [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const generation = useRef(0), mounted = useRef(false), submittingRef = useRef(false), nextMessageId = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const result = await customerDeliveryDetail(session, deliveryNoteID);
      if (mounted.current && request === generation.current) setDetail(result);
    } catch (failure) {
      if (mounted.current && request === generation.current) setError(failure == null ? { cause: failure } : failure);
    }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, [deliveryNoteID, session]);
  useEffect(() => {
    mounted.current = true; let active = true; const currentGeneration = generation;
    void Promise.resolve().then(() => { if (active) return reload(); });
    return () => { active = false; mounted.current = false; currentGeneration.current++; };
  }, [reload]);
  const send = async (reply: CustomerDeliveryResponse) => {
    if (!detail || submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true);
    try {
      const updated = await customerRespondDelivery(session, reply);
      if (!mounted.current) return;
      setDetail(updated);
      store.applyDetailTransition(detail.record, updated.record);
      requestAnimationFrame(() => refreshHub.emit('customer'));
      onChanged();
    } catch (failure) {
      if (mounted.current) {
        const notice = { id: ++nextMessageId.current, text: method('responseSendFailed', { error: String(failure) }) };
        setMessages(current => [...current, notice]);
      }
    } finally { submittingRef.current = false; if (mounted.current) setSubmitting(false); }
  };
  const messageId = messages[0]?.id ?? null;
  const clearMessage = useCallback(() => {
    if (messageId != null) setMessages(current => current[0]?.id === messageId ? current.slice(1) : current);
  }, [messageId]);
  return { detail, loading, error, submitting, message: messages[0]?.text ?? '', messageId, clearMessage, reload, send };
}
