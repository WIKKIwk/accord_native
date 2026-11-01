import { ChatConversationsScreen } from '../../../components/ChatConversationsScreen';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerChat() {
  const { session, onOpenDrawer } = useWorkerSession();
  return <ChatConversationsScreen key={session.imageCacheScope} session={session} onOpenDrawer={onOpenDrawer} />;
}
