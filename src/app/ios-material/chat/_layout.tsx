import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';
import { useMaterialContext } from '../../../material/MaterialContext';

export default function MaterialChatLayout() {
  const { session, setChatClosing } = useMaterialContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/ios-material/chat" onOpenDrawer={drawer.open} onClosingChange={setChatClosing}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
