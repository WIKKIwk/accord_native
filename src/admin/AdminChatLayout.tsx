import { Redirect, type Href } from 'expo-router';
import { appRoutes } from '../shared/appRoutes';
import { ChatRouteStack } from '../shared/chat/ChatPages';
import { ChatRouteProvider } from '../shared/chat/ChatRouteContext';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { useAdminShell } from './AdminShellContext';

export function AdminChatLayout({ platform }: { platform: 'android' | 'ios' }) {
  const shell = useAdminShell(), drawer = useRoleDrawer();
  if (!shell.isCurrent()) return null;
  const path = shell.destination(appRoutes.chat, platform);
  if (!path) return <Redirect href={`/${platform}-admin` as Href} />;
  return <ChatRouteProvider session={shell.session} basePath={path} onOpenDrawer={() => { if (shell.isCurrent()) drawer.open(); }}>
    <ChatRouteStack />
  </ChatRouteProvider>;
}
