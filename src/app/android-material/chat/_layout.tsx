import { useMaterialContext } from '../../../material/MaterialContext';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';

export default function MaterialChatLayout() {
  const { session } = useMaterialContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/android-material/chat" onOpenDrawer={drawer.open}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
