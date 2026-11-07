import { usePreparationContext } from '../../../preparation/PreparationContext.android';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';

export default function PreparationChatLayout() {
  const { session } = usePreparationContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/android-preparation/chat" onOpenDrawer={drawer.open}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
