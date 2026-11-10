import { Host, TextInput, useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';
import { RoleHeaderButton } from '../navigation/RoleHeaderButton';

type Props = {
  search: string; searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onProfile?: () => void;
  showProfile?: boolean;
  trailing?: ReactNode;
  actions?: ReactNode;
  onSearchFocus?: () => void; onSearchBlur?: () => void;
} & ({ onMenu: () => void; onBack?: never } | { onMenu?: never; onBack: () => void });

/** The worker queue uses the same menu and search layout as V2. */
export function OrdersHeader({ search, onSearchChange, onMenu, onBack, onProfile, showProfile = true, trailing, actions, onSearchFocus, onSearchBlur, searchPlaceholder = 'Buyurtmani izlash' }: Props) {
  const colors = useWorkerColors();
  const nativeSearch = useNativeState(search);
  useEffect(() => {
    if (nativeSearch.get() !== search) nativeSearch.set(search);
  }, [nativeSearch, search]);

  return (
    <View style={styles.row}>
      <RoleHeaderButton icon={onBack ? 'back' : 'menu'} label={onBack ? 'Orqaga' : 'Bo‘limlar'} onPress={onBack ?? onMenu!} tintColor={colors.icon} />
      <View style={[styles.field, { backgroundColor: colors.field }]}>
        <Host colorScheme={Platform.OS === 'android' ? undefined : 'light'} matchContents={{ vertical: true }} style={styles.inputHost}>
          <TextInput
            value={nativeSearch}
            onChangeText={onSearchChange}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            textAlign="left"
            textStyle={{ color: typeof colors.text === 'string' ? colors.text : undefined, fontSize: 15 }}
            style={{ width: '100%', paddingHorizontal: 40 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </Host>
        <View pointerEvents="none" accessible={false} style={styles.searchIcon}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.icon} />
        </View>
        {search.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Qidiruvni tozalash" onPress={() => { nativeSearch.set(''); onSearchChange(''); }} style={styles.clear} hitSlop={5}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={colors.clear} />
          </Pressable>
        )}
      </View>
      {actions}
      {trailing ?? (showProfile && onProfile ? <RoleHeaderButton icon="profile" label="Profil" onPress={onProfile} tintColor={colors.icon} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, minHeight: 70 },
  field: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 4 },
  inputHost: { flex: 1 },
  searchIcon: { position: 'absolute', left: 4, width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  clear: { position: 'absolute', right: 4, width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
