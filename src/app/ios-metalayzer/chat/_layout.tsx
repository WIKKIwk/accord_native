import { useMetalayzerContext } from '../../../metalayzer/MetalayzerContext';
import { useMetalayzerChatClosing } from '../../../metalayzer/MetalayzerIosShell';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';

export default function ChatLayout() {
  const { session } = useMetalayzerContext(), setChatClosing = useMetalayzerChatClosing(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/ios-metalayzer/chat" onOpenDrawer={drawer.open} onClosingChange={setChatClosing}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
