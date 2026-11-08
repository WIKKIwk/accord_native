import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useBoyoqchiGetter, useBoyoqchiText } from './useBoyoqchiText';
import { queueBoyoqchiDockNavigation } from './boyoqchiDockScheduler';
export function BoyoqchiDock({ active }: { active: 'home' | 'astatka' | 'profile' | 'chat' | '' }) {
  const insets = useSafeAreaInsets(), getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  const navigation = useNavigation('/android-boyoqchi');
  const mounted = useRef(true), current = useRef(active);
  useEffect(() => { current.current = active; }, [active]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const items: RoleNavigationItem[] = [
    { id: 'home', label: getter('homeNavTitle'), icon: 'home' },
    { id: 'astatka', label: t('Astatka'), icon: 'inventory_2' },
    { id: 'profile', label: getter('profileTitle'), icon: 'person' },
  ];
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active || (id !== 'home' && id !== 'astatka' && id !== 'profile')) return;
    queueBoyoqchiDockNavigation({ destination: id, active: () => current.current, isMounted: () => mounted.current,
      dispatch: action => navigation.dispatch(action) });
  }} />;
}
