import { ChatRouteProvider } from '../../../shared/chat/ChatRouteContext';
import { ChatRouteStack } from '../../../shared/chat/ChatPages';
import { useQolipRole } from '../../../qolip/QolipRoleContext';
export default function Layout() { const role=useQolipRole(); return <ChatRouteProvider session={role.session} basePath="/android-qolip/chat" onOpenDrawer={role.onMenu}><ChatRouteStack /></ChatRouteProvider>; }
