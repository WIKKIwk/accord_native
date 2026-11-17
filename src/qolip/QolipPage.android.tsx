import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { BackHandler, View } from 'react-native';
import { useQolipPageHeaderValue } from './QolipPageHeaderContext';
import { IconButton, Host, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { localizedGetter } from '../shared/localization';
export function QolipPage({ title, children, ownHeader = false, back = false, onBack }: { title: string; children: ReactNode; ownHeader?: boolean; back?: boolean; onBack?: () => void }) {
  const header = useQolipPageHeaderValue(), role = useQolipRole(), colors = useMaterialColors(), inset = useSafeAreaInsets(), { locale, text } = useQolipText();
  useFocusEffect(useCallback(() => { if (!onBack) return; const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!role.isCurrent()) return false; onBack(); return true; }); return () => subscription.remove(); }, [onBack, role]));
  if (ownHeader) return <>{children}</>;
  return <View style={{ flex: 1, paddingTop: inset.top, backgroundColor: colors.surfaceContainerLow }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10 }}><View style={{ flex: 1 }}><RoleHeader title={title}
      navigation={{ icon: back ? 'back' : 'menu', label: back ? text('action.back') : localizedGetter('adminDrawerSections', locale),
        onPress: onBack ?? (back ? () => { if (role.isCurrent()) { if (router.canGoBack()) router.back(); else router.navigate('/android-qolip'); } } : role.onMenu) }} /></View>
      {header?.actions.map(action => <Host key={action.id} matchContents><IconButton enabled={!action.disabled} onClick={() => { if(role.isCurrent()) header.onSelect(action.id); }} modifiers={[semantics({ contentDescription: action.label })]}><RNHostView matchContents><SymbolView name={{ android: action.icon }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Host>)}
      {!header?.hideProfile && <RoleHeaderButton tintColor={colors.onSurfaceVariant} icon="profile" label={localizedGetter('profileTitle', locale)} onPress={role.onProfile} />}</View>
    <View style={{ flex: 1 }}>{children}</View>{role.dock}
  </View>;
}
