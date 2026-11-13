import { useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';
import { RoleHeaderButton } from '../navigation/RoleHeaderButton';
import { OrdersSearchInput } from './OrdersSearchInput';
import type { OrdersSearchInputHandle } from './OrdersSearchInput.types';
import { SearchTextSync } from './SearchTextSync';

type Props = {
  search: string; searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onProfile?: () => void;
  showProfile?: boolean;
  trailing?: ReactNode;
  actions?: ReactNode;
  onSearchFocus?: () => void; onSearchBlur?: () => void;
} & ({ onMenu: () => void; onBack?: never } | { onMenu?: never; onBack: () => void });

export type { Props as OrdersHeaderProps };

/** The worker queue uses the same menu and search layout as V2. */
export function OrdersHeader({ search, onSearchChange, onMenu, onBack, onProfile, showProfile = true, trailing, actions, onSearchFocus, onSearchBlur, searchPlaceholder = 'Buyurtmani izlash' }: Props) {
  const colors = useWorkerColors();
  const [searchFocused, setSearchFocused] = useState(false);
  const input = useRef<OrdersSearchInputHandle>(null);
  const nativeSearch = useNativeState(search);
  const textSync = useRef<SearchTextSync | null>(null);
  if (textSync.current == null) textSync.current = new SearchTextSync(search);
  useEffect(() => {
    if (textSync.current!.reactChanged(search)) nativeSearch.set(search);
  }, [nativeSearch, search]);
  const changeSearch = useCallback((value: string) => {
    textSync.current!.nativeChanged(value);
    onSearchChange(value);
  }, [onSearchChange]);

  return (
    <View style={styles.row}>
      {!searchFocused && <RoleHeaderButton icon={onBack ? 'back' : 'menu'} label={onBack ? 'Orqaga' : 'Bo‘limlar'} onPress={onBack ?? onMenu!} tintColor={colors.icon} />}
      <View style={[styles.field, searchFocused && styles.focusedField, { backgroundColor: colors.field }]}>
        {!searchFocused && <View pointerEvents="none" accessible={false} style={styles.searchIcon}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.icon} />
        </View>}
        <OrdersSearchInput inputRef={input} value={nativeSearch} onChangeText={changeSearch}
          onFocus={() => { setSearchFocused(true); onSearchFocus?.(); }} onBlur={() => { setSearchFocused(false); onSearchBlur?.(); }}
          placeholder={searchPlaceholder} color={colors.text} placeholderColor={colors.muted} />
        {(searchFocused || search.length > 0) && (
          <Pressable accessibilityRole="button" accessibilityLabel={searchFocused ? 'Yopish' : 'Qidiruvni tozalash'} onPress={() => {
            if (searchFocused) input.current?.blur();
            else { nativeSearch.set(''); changeSearch(''); }
          }} style={styles.clear} hitSlop={5}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={colors.clear} />
          </Pressable>
        )}
      </View>
      {actions}
      {trailing ?? (!searchFocused && showProfile && onProfile ? <RoleHeaderButton icon="profile" label="Profil" onPress={onProfile} tintColor={colors.icon} /> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, minHeight: 70 },
  field: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 4 },
  focusedField: { paddingLeft: 16 },
  searchIcon: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  clear: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
