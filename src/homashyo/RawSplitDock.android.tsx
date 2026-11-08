import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { rawSplitNonChatDockItems } from './rawSplitNavigationModel';

export function RawSplitDock({ profile = false }: { profile?: boolean }) {
  const t = usePreparationText(), insets = useSafeAreaInsets();
  const items = rawSplitNonChatDockItems(t).map(item => ({ id: item.id, label: item.label, icon: item.android }));
  return <RoleBottomBar active={profile ? 'profile' : 'home'} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === 'profile') router.navigate('/android-homashyo/profile' as Href);
    else if (id === 'home') router.dismissTo('/android-homashyo' as Href);
  }} />;
}
