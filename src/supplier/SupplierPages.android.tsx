import { router, useFocusEffect, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { SupplierStatusKind } from './supplierApi';
import { SupplierDock } from './SupplierDock.android';
import { SupplierDrawer } from './SupplierShell';
import { useSupplierSession } from './SupplierSession';
import { supplierDrawerStackAction, supplierRootStackAction, type SupplierDockDestination } from './supplierNavigationModel';
import { SupplierHomeScreen, SupplierRecentScreen, SupplierStatusBreakdownScreen,
  SupplierStatusDetailScreen, SupplierSubmittedCategoryDetailScreen } from './SupplierOverviewScreens';
import type { SupplierCategory } from './supplierScreenModel';
import { useSupplierText } from './useSupplierOverview';

const routeNames: Record<string, string> = { home: 'index', recent: 'recent', profile: 'profile' };
function useSupplierNavigation() {
  const navigation = useNavigation(), [canBack, setCanBack] = useState(false);
  useFocusEffect(useCallback(() => { setCanBack((navigation.getState()?.index ?? 0) > 0); }, [navigation]));
  const back = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const root = (id: SupplierDockDestination) => {
    const name = routeNames[id]; if (!name) throw new Error('Restricted Supplier destination is unavailable');
    navigation.dispatch(supplierRootStackAction(name));
  };
  const drawer = (id: string) => {
    const name = routeNames[id]; if (!name) throw new Error('Supplier drawer destination is unavailable');
    const state = navigation.getState(), current = state?.routes[state.index]?.name ?? '';
    const action = supplierDrawerStackAction(current, name); if (action) navigation.dispatch(action);
  };
  return { back, canBack, root, drawer };
}
function Footer({ active }: { active: 'home' | 'notifications' | 'recent' | null }) {
  const nav = useSupplierNavigation(); return <SupplierDock activeTab={active} onSelect={nav.root} />;
}
const href = (pathname: string, params?: Record<string, string>) => ({ pathname, params } as Href);
function requiredStatus(value: string | string[] | undefined): SupplierStatusKind {
  if (value === 'pending' || value === 'submitted' || value === 'returned') return value;
  throw new Error('Invalid Supplier status route');
}
function requiredCategory(value: string | string[] | undefined): SupplierCategory {
  if (value === 'pendingDispatches' || value === 'pendingUnannounced' || value === 'acceptedByWerka' || value === 'approvedUnannounced') return value;
  throw new Error('Invalid Supplier category route');
}
function requiredText(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value; throw new Error('Invalid Supplier detail route');
}

export function SupplierHomePage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation();
  return <SupplierDrawer active="home" onSelect={nav.drawer}>{open => <SupplierHomeScreen store={store} onOpenDrawer={open}
    onRootBack={nav.canBack ? nav.back : undefined} footer={<Footer active="home" />}
    onStatus={kind => router.push(href('/android-supplier/status', { kind }))} />}</SupplierDrawer>;
}
export function SupplierRecentPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation();
  return <SupplierDrawer active="recent" onSelect={nav.drawer}>{open => <SupplierRecentScreen store={store} onOpenDrawer={open}
    onRootBack={nav.canBack ? nav.back : undefined} footer={<Footer active="recent" />} />}</SupplierDrawer>;
}
export function SupplierStatusPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ kind?: string }>();
  const kind = requiredStatus(params.kind);
  return <SupplierStatusBreakdownScreen store={store} kind={kind} onBack={nav.back} footer={<Footer active={null} />}
    onCategory={category => router.push(href('/android-supplier/category', { category }))}
    onDetail={(nextKind, itemCode, itemName) => router.push(href('/android-supplier/status-detail', { kind: nextKind, itemCode, itemName }))} />;
}
export function SupplierCategoryPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ category?: string }>();
  return <SupplierSubmittedCategoryDetailScreen store={store} category={requiredCategory(params.category)} onBack={nav.back} footer={<Footer active={null} />} />;
}
export function SupplierStatusDetailPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ kind?: string; itemCode?: string; itemName?: string }>();
  return <SupplierStatusDetailScreen store={store} kind={requiredStatus(params.kind)} itemCode={requiredText(params.itemCode)}
    itemName={requiredText(params.itemName)} onBack={nav.back} footer={<Footer active={null} />} />;
}
export function SupplierProfilePage() {
  const { session, onLogout } = useSupplierSession(), nav = useSupplierNavigation(), { l, t, menuTooltip } = useSupplierText();
  const insets = useSafeAreaInsets(), colors = useMaterialColors();
  return <SupplierDrawer active="profile" onSelect={nav.drawer}>{open => <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={l('profileTitle')} navigation={{ icon: nav.canBack ? 'back' : 'menu',
      label: nav.canBack ? t('Orqaga') : menuTooltip, onPress: nav.canBack ? nav.back : open }} />
    <View style={{ flex: 1 }}><ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => nav.root('home')} /></View>
    <Footer active={null} />
  </View>}</SupplierDrawer>;
}
