import { Host, IconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { RawSplitBusy } from './RawSplitBusy';
import { RawSplitDock } from './RawSplitDock.android';

export function RawSplitFrame({ title, page, busy = false, printerDisabled = false, onPrinter, children }: { title: string; page: 'home' | 'history' | 'profile';
  busy?: boolean; printerDisabled?: boolean; onPrinter?: () => void; children: ReactNode }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer(), t = usePreparationText();
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/android-homashyo' as Href); };
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ flex: 1 }}><RoleHeader title={title} navigation={{ icon: page === 'home' ? 'menu' : 'back', label: t(page === 'home' ? 'Bo‘limlar' : 'Orqaga'),
      onPress: page === 'home' ? drawer.open : back }} /></View>
    {page === 'home' && <Host matchContents><IconButton enabled={!busy}
      onClick={() => router.push('/android-homashyo/history' as Href)} modifiers={[semantics({ contentDescription: t('Rezka tarixi') }), testID('homashyo-history')]}>
      <RNHostView matchContents><SymbolView name={{ android: 'history' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
    </IconButton></Host>}
    {onPrinter && <Host matchContents><IconButton enabled={!busy && !printerDisabled} onClick={onPrinter}
      modifiers={[semantics({ contentDescription: t('Printer tanlash') }), testID('homashyo-printer')]}>
      <RNHostView matchContents><SymbolView name={{ android: 'print' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
    </IconButton></Host>}</View>
    {busy && <RawSplitBusy />}
    <View style={{ flex: 1 }}>{children}</View><RawSplitDock profile={page === 'profile'} />
  </View>;
}
