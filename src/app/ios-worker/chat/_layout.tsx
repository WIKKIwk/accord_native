import { Stack } from 'expo-router';
import { ChatMetadataProvider } from '../../../components/ChatMetadata';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerChatLayout() {
  const { session } = useWorkerSession();
  return <ChatMetadataProvider key={session.imageCacheScope}><Stack /></ChatMetadataProvider>;
}
