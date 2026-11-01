import { Stack, usePathname } from 'expo-router';
import { ChatMetadataProvider } from '../../../components/ChatMetadata';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerChatLayout() {
  const { session, setChatClosing } = useWorkerSession();
  const pathname = usePathname();
  return <ChatMetadataProvider key={session.imageCacheScope}>
    <Stack>
      <Stack.Screen name="index" listeners={{ focus: () => setChatClosing(false) }} />
      <Stack.Screen name="new" listeners={{
        transitionStart: event => {
          if (!event.data.closing || pathname === '/ios-worker/chat/new') setChatClosing(event.data.closing);
        },
        gestureCancel: () => setChatClosing(false),
      }} />
      <Stack.Screen name="[conversationId]" listeners={{
        transitionStart: event => setChatClosing(event.data.closing),
        gestureCancel: () => setChatClosing(false),
      }} />
    </Stack>
  </ChatMetadataProvider>;
}
