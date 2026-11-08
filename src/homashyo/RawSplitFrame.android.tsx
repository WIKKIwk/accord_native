import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitDock } from './RawSplitDock.android';

export function RawSplitFrame({ title, page, busy = false, onPrinter, children }: { title: string; page: 'home' | 'history' | 'profile';
  busy?: boolean; onPrinter?: () => void; children: ReactNode }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer(), t = usePreparationText();
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/android-homashyo' as Href); };
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ flex: 1 }}><RoleHeader title={title} navigation={{ icon: page === 'home' ? 'menu' : 'back', label: t(page === 'home' ? 'Bo‘limlar' : 'Orqaga'),
      onPress: page === 'home' ? drawer.open : back }} /></View>
    {page === 'home' && <Pressable accessibilityRole="button" accessibilityLabel={t('Rezka tarixi')} disabled={busy}
      onPress={() => router.push('/android-homashyo/history' as Href)} style={{ padding: 12 }}><SymbolView name={{ android: 'history' }} size={24} tintColor={colors.onSurfaceVariant} /></Pressable>}
    {onPrinter && <Pressable accessibilityRole="button" accessibilityLabel={t('Printer tanlash')} disabled={busy} onPress={onPrinter} style={{ padding: 12 }}>
      <SymbolView name={{ android: 'print' }} size={24} tintColor={colors.onSurfaceVariant} /></Pressable>}</View>
    <View style={{ flex: 1 }}>{children}</View><RawSplitDock profile={page === 'profile'} />
  </View>;
}
