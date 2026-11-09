import { useRawSplitContext } from '../../../homashyo/RawSplitContext';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';
export default function RawSplitChatLayout() {
  const { session, setChatClosing } = useRawSplitContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/ios-homashyo/chat" onOpenDrawer={drawer.open} onClosingChange={setChatClosing}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
