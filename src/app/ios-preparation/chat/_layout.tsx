import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { usePreparationContext } from '../../../preparation/PreparationContext';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';
export default function PreparationChatLayout() {
  const { session, setChatClosing } = usePreparationContext();
  const drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/ios-preparation/chat" onOpenDrawer={drawer.open} onClosingChange={setChatClosing}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
