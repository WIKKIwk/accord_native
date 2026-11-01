import { useLocalSearchParams } from 'expo-router';
import { ChatThreadScreen } from '../../../components/ChatThreadScreen';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerChatThread() {
  const { session } = useWorkerSession();
  const { conversationId, title } = useLocalSearchParams<{ conversationId: string; title?: string }>();
  return <ChatThreadScreen key={`${session.imageCacheScope}:${conversationId}`} session={session} conversationId={conversationId} title={title ?? ''} />;
}
