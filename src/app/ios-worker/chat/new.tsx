import { ChatDirectoryScreen } from '../../../components/ChatDirectoryScreen.ios';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerNewChat() {
  const { session } = useWorkerSession();
  return <ChatDirectoryScreen key={session.imageCacheScope} session={session} />;
}
