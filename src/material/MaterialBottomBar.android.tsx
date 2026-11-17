import { router, usePathname, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isSessionWitnessCurrent } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useMaterialContext } from './MaterialContext';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;

/** @v2 MaterialTaminotchiDock */
export function MaterialBottomBar() {
  const { session, witness, unread } = useMaterialContext(), path = usePathname(), insets = useSafeAreaInsets();
  const current = useSyncExternalStore(subscribe, locale, locale);
  // Chat's directory, thread and participant pages have their own native navigation.
  if (path.startsWith('/android-material/chat/')) return null;
  const active = path.endsWith('/profile') ? 'profile' : path.endsWith('/tasks') ? 'tasks'
    : path.endsWith('/receipt') ? 'receipt' : path.endsWith('/chat') ? 'chat' : 'home';
  const items: RoleNavigationItem[] = [
    { id: 'home', label: localizedGetter('homeNavTitle', current), icon: 'home' },
    ...(canOpenRoute(session, appRoutes.gscaleMode) ? [{ id: 'receipt', label: 'Kirim', icon: 'scale' as const }] : []),
    ...(canOpenRoute(session, appRoutes.materialTasks) ? [{ id: 'tasks', label: 'Vazifalar', icon: 'assignment' as const }] : []),
    { id: 'profile', label: localizedGetter('profileTitle', current), icon: 'person' },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', showBadge: unread > 0 },
  ];
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (!isSessionWitnessCurrent(witness) || id === active) return;
    if (id === 'home') router.dismissTo('/android-material' as Href);
    else if (id === 'receipt' && canOpenRoute(session, appRoutes.gscaleMode)) router.navigate('/android-material/receipt' as Href);
    else if (id === 'tasks' && canOpenRoute(session, appRoutes.materialTasks)) router.navigate('/android-material/tasks' as Href);
    else if (id === 'profile') router.navigate('/android-material/profile' as Href);
    else if (id === 'chat') router.navigate('/android-material/chat' as Href);
  }} />;
}
