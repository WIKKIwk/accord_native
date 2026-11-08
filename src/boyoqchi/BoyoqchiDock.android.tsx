import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useBoyoqchiContext } from './BoyoqchiContext';
import { useBoyoqchiGetter, useBoyoqchiText } from './useBoyoqchiText';
export function BoyoqchiDock({ active }: { active: 'home' | 'astatka' | 'profile' | 'chat' | '' }) {
  const insets = useSafeAreaInsets(), getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  const { unread } = useBoyoqchiContext();
  const items: RoleNavigationItem[] = [
    { id: 'home', label: getter('homeNavTitle'), icon: 'home' },
    { id: 'astatka', label: t('Astatka'), icon: 'inventory_2' },
    { id: 'profile', label: getter('profileTitle'), icon: 'person' },
    { id: 'chat', label: t('Chat'), icon: 'chat_bubble', showBadge: unread > 0 },
  ];
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active) return;
    const path = id === 'home' ? '/android-boyoqchi' : `/android-boyoqchi/${id}`;
    router.navigate(path as Href);
  }} />;
}
