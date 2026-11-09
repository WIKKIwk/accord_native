import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useRawSplitContext } from './RawSplitContext';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { rawSplitNonChatDockItems } from './rawSplitNavigationModel';

export function RawSplitDock({ profile = false, chat = false }: { profile?: boolean; chat?: boolean }) {
  const t = usePreparationText(), insets = useSafeAreaInsets();
  const { unread, ticket } = useRawSplitContext();
  const items: RoleNavigationItem[] = rawSplitNonChatDockItems(t).map(item => ({ id: item.id, label: item.label, icon: item.android }));
  items.push({ id: 'chat', label: t('Chat'), icon: 'chat_bubble', showBadge: unread > 0 });
  return <RoleBottomBar active={chat ? 'chat' : profile ? 'profile' : 'home'} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (!rawSplitSessionIsCurrent(ticket)) return;
    if (id === 'chat') router.navigate('/android-homashyo/chat' as Href);
    else if (id === 'profile') router.navigate('/android-homashyo/profile' as Href);
    else if (id === 'home') router.dismissTo('/android-homashyo' as Href);
  }} />;
}
