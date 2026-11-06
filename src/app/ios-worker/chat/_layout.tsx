import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useWorkerSession } from '../../../components/WorkerSession';
export default function WorkerChatLayout() {
  const { session, onOpenDrawer, setChatClosing } = useWorkerSession();
  return <ChatRouteProvider session={session} basePath="/ios-worker/chat" onOpenDrawer={onOpenDrawer} onClosingChange={setChatClosing}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
