import type { Href, router } from 'expo-router';
import type { ChatConversation } from '../../chatModel';
import type { ChatNavigation } from './chatPageTypes';

/** The same pages can live under any role's navigator or the shared Chat route. */
export function createChatNavigation(basePath: string, navigator: Pick<typeof router, 'push' | 'replace'>): ChatNavigation {
  const base = basePath.replace(/\/$/, '');
  const conversationRoute = (conversation: ChatConversation) => ({ pathname: `${base}/[conversationId]`,
    params: { conversationId: conversation.id, title: conversation.title } }) as Href;
  return {
    openDirectory: () => navigator.push(`${base}/new` as Href),
    openConversation: conversation => navigator.push(conversationRoute(conversation)),
    replaceConversation: conversation => navigator.replace(conversationRoute(conversation)),
  };
}
