import { useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';
import { RoleHeaderButton } from '../navigation/RoleHeaderButton';
import { RoleHeaderRow, RoleHeaderSearchField } from '../navigation/RoleHeaderRow';
import { OrdersSearchInput } from './OrdersSearchInput';
import type { OrdersSearchInputHandle } from './OrdersSearchInput.types';
import { SearchTextSync } from './SearchTextSync';

type Props = {
  search: string; searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onProfile?: () => void;
  showProfile?: boolean;
  profileAction?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  onSearchFocus?: () => void; onSearchBlur?: () => void;
  enabled?: boolean;
  hasSearchText?: boolean;
  blurOnSearchSubmit?: boolean;
  controlLabels?: { back: string; close: string; clear: string };
  testID?: string;
} & ({ onMenu: () => void; onBack?: never } | { onMenu?: never; onBack: () => void });

export type { Props as OrdersHeaderProps };

/** The worker queue uses the same menu and search layout as V2. */
export function OrdersHeader({ search, onSearchChange, onMenu, onBack, onProfile, showProfile = true, profileAction, trailing, actions, onSearchFocus, onSearchBlur,
  searchPlaceholder = 'Buyurtmani izlash', enabled = true, hasSearchText = search.length > 0, blurOnSearchSubmit, controlLabels, testID }: Props) {
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
    if (!enabled) return;
    textSync.current!.nativeChanged(value);
    onSearchChange(value);
  }, [onSearchChange, enabled]);

  return (
    <RoleHeaderRow>
      {!searchFocused && <RoleHeaderButton icon={onBack ? 'back' : 'menu'} label={onBack ? controlLabels?.back ?? 'Orqaga' : 'Bo‘limlar'}
        onPress={onBack ?? onMenu!} tintColor={colors.icon} testID={testID && `${testID}-back`} />}
      <RoleHeaderSearchField focused={searchFocused}>
        <OrdersSearchInput inputRef={input} value={nativeSearch} onChangeText={changeSearch} enabled={enabled}
          onFocus={() => { setSearchFocused(true); onSearchFocus?.(); }} onBlur={() => { setSearchFocused(false); onSearchBlur?.(); }}
          placeholder={searchPlaceholder} color={colors.text} placeholderColor={colors.muted} testID={testID && `${testID}-search`}
          onSubmit={blurOnSearchSubmit ? () => input.current?.blur() : undefined} />
        {(searchFocused || hasSearchText) && (
          <Pressable accessibilityRole="button" disabled={!enabled} testID={testID && `${testID}-search-close`}
            accessibilityLabel={searchFocused ? controlLabels?.close ?? 'Yopish' : controlLabels?.clear ?? 'Qidiruvni tozalash'} onPress={() => {
            if (searchFocused) input.current?.blur();
            else { nativeSearch.set(''); changeSearch(''); }
          }} style={styles.clear} hitSlop={5}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={colors.clear} />
          </Pressable>
        )}
      </RoleHeaderSearchField>
      {actions}
      {trailing ?? (!searchFocused && showProfile ? profileAction ?? (onProfile ? <RoleHeaderButton icon="profile" label="Profil" onPress={onProfile} tintColor={colors.icon} /> : null) : null)}
    </RoleHeaderRow>
  );
}

const styles = StyleSheet.create({
  clear: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
});
