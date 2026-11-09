import { Stack, router, useFocusEffect, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import type { SupplierStatusKind } from './supplierApi';
import { SupplierDrawer } from './SupplierShell';
import { useSupplierSession } from './SupplierSession';
import { SupplierHomeScreen, SupplierRecentScreen, SupplierStatusBreakdownScreen,
  SupplierStatusDetailScreen, SupplierSubmittedCategoryDetailScreen } from './SupplierOverviewScreens';
import type { SupplierCategory } from './supplierScreenModel';
import { useSupplierText } from './useSupplierOverview';

const paths: Record<string, string> = { home: '/ios-supplier', recent: '/ios-supplier/recent', profile: '/ios-supplier/profile' };
function useSupplierNavigation() {
  const navigation = useNavigation(), [canBack, setCanBack] = useState(false);
  useFocusEffect(useCallback(() => { setCanBack((navigation.getState()?.index ?? 0) > 0); }, [navigation]));
  const back = () => { if (navigation.canGoBack()) navigation.goBack(); };
  const drawer = (id: string) => { const path = paths[id]; if (!path) throw new Error('Supplier drawer destination is unavailable');
    router.navigate(path as Href); };
  return { back, canBack, drawer };
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
    onRootBack={nav.canBack ? nav.back : undefined} onStatus={kind => router.push(href('/ios-supplier/status', { kind }))} />}</SupplierDrawer>;
}
export function SupplierRecentPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation();
  return <SupplierDrawer active="recent" onSelect={nav.drawer}>{open => <SupplierRecentScreen store={store} onOpenDrawer={open}
    onRootBack={nav.canBack ? nav.back : undefined} />}</SupplierDrawer>;
}
export function SupplierStatusPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ kind?: string }>();
  const kind = requiredStatus(params.kind);
  return <SupplierStatusBreakdownScreen store={store} kind={kind} onBack={nav.back}
    onCategory={category => router.push(href('/ios-supplier/category', { category }))}
    onDetail={(nextKind, itemCode, itemName) => router.push(href('/ios-supplier/status-detail', { kind: nextKind, itemCode, itemName }))} />;
}
export function SupplierCategoryPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ category?: string }>();
  return <SupplierSubmittedCategoryDetailScreen store={store} category={requiredCategory(params.category)} onBack={nav.back} />;
}
export function SupplierStatusDetailPage() {
  const { store } = useSupplierSession(), nav = useSupplierNavigation(), params = useLocalSearchParams<{ kind?: string; itemCode?: string; itemName?: string }>();
  return <SupplierStatusDetailScreen store={store} kind={requiredStatus(params.kind)} itemCode={requiredText(params.itemCode)}
    itemName={requiredText(params.itemName)} onBack={nav.back} />;
}
export function SupplierProfilePage() {
  const { session, onLogout } = useSupplierSession(), nav = useSupplierNavigation(), { l } = useSupplierText();
  return <SupplierDrawer active="profile" onSelect={nav.drawer}>{() => <SafeAreaView edges={['left', 'right']}
    style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <Stack.Screen options={{ title: l('profileTitle') }} />
    <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/ios-supplier' as Href)} />
  </SafeAreaView>}</SupplierDrawer>;
}
