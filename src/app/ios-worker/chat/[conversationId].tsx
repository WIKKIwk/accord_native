import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { activeSessionToken } from '../../../auth';
import { loadChatConversations } from '../../../chatApi';
import { useChatMetadata } from '../../../components/ChatMetadata';
import { ChatThreadScreen } from '../../../components/ChatThreadScreen';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerChatThread() {
  const { session } = useWorkerSession();
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
