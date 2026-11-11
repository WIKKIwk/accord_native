import { Button, Host, Icon, TextInput, useNativeState } from '@expo/ui';
import { accessibilityLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useWorkerColors } from './useWorkerColors';
import { ProfilePressTarget } from './ProfilePressTarget.ios';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onMenu: () => void;
  onProfile: () => void;
};

export function WorkerHeader({ search, onSearchChange, onMenu, onProfile }: Props) {
  const colors = useWorkerColors();
  const nativeSearch = useNativeState(search);
  useEffect(() => {
    if (nativeSearch.get() !== search) nativeSearch.set(search);
  }, [nativeSearch, search]);

  return <View style={styles.row}>
    <Host style={styles.button}>
      <Button variant="text" style={styles.button} onPress={onMenu} modifiers={[accessibilityLabel('Bo‘limlar')]}>
        <Icon name="line.3.horizontal" size={22} color={colors.icon} />
      </Button>
    </Host>
    <View style={styles.search}>
      <Host matchContents={{ vertical: true }} style={styles.searchHost}>
        <TextInput value={nativeSearch} onChangeText={onSearchChange} placeholder="Buyurtmani izlash"
          accessibilityLabel="Buyurtmani izlash" autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          style={{ width: '100%' }} modifiers={[textFieldStyle('roundedBorder')]} />
      </Host>
    </View>
    {search.length > 0 && <Host style={styles.button}>
      <Button variant="text" style={styles.button} onPress={() => { nativeSearch.set(''); onSearchChange(''); }}
        modifiers={[accessibilityLabel('Qidiruvni tozalash')]}>
        <Icon name="xmark.circle.fill" size={19} color={colors.clear} />
      </Button>
    </Host>}
    <ProfilePressTarget onPress={onProfile}>
      <SymbolView name={{ ios: 'person.crop.circle' }} size={24} tintColor={colors.icon} />
    </ProfilePressTarget>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, minHeight: 52 },
  button: { width: 44, height: 44 },
  search: { flex: 1 },
  searchHost: { width: '100%' },
});
