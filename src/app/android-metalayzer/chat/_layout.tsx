import { useMetalayzerContext } from '../../../metalayzer/MetalayzerContext';
import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useRoleDrawer } from '../../../shared/navigation/roleDrawerContext';
export default function Layout() {
  const { session } = useMetalayzerContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/android-metalayzer/chat" onOpenDrawer={drawer.open}><ChatRouteStack /></ChatRouteProvider>;
}
