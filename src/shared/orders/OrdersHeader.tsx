import { Host, TextInput, useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';

type Props = {
  search: string; searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onMenu: () => void;
  onProfile: () => void;
};

/** The worker queue uses the same menu and search layout as V2. */
export function OrdersHeader({ search, onSearchChange, onMenu, onProfile, searchPlaceholder = 'Buyurtmani izlash' }: Props) {
  const colors = useWorkerColors();
  const nativeSearch = useNativeState(search);
  useEffect(() => {
    if (nativeSearch.get() !== search) nativeSearch.set(search);
  }, [nativeSearch, search]);

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Bo‘limlar" onPress={onMenu} style={styles.iconButton} hitSlop={8}>
        <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} size={25} tintColor={colors.icon} />
      </Pressable>
      <View style={[styles.field, { backgroundColor: colors.field }]}>
        <Host colorScheme={Platform.OS === 'android' ? undefined : 'light'} matchContents={{ vertical: true }} style={styles.inputHost}>
          <TextInput
            value={nativeSearch}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            textAlign="center"
            textStyle={{ color: typeof colors.text === 'string' ? colors.text : undefined, fontSize: 15 }}
            style={{ width: '100%', paddingHorizontal: 40 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </Host>
        {search.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Qidiruvni tozalash" onPress={() => { nativeSearch.set(''); onSearchChange(''); }} style={styles.clear} hitSlop={5}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={colors.clear} />
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={onProfile} style={styles.profile} hitSlop={8}>
        <SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} size={27} tintColor={colors.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, minHeight: 70 },
  iconButton: { width: 38, height: 48, justifyContent: 'center', alignItems: 'center' },
  field: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 4 },
  inputHost: { flex: 1 },
  clear: { position: 'absolute', right: 4, width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  profile: { width: 38, height: 48, justifyContent: 'center', alignItems: 'center' },
});
