import { useBoyoqchiContext } from '../../../boyoqchi/BoyoqchiContext';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';
export default function BoyoqchiChatLayout() {
  const { session } = useBoyoqchiContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/ios-boyoqchi/chat" onOpenDrawer={drawer.open}><ChatRouteStack /></ChatRouteProvider>;
}
