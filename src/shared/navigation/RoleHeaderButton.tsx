import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, type ColorValue } from 'react-native';

type Props = { icon: 'menu' | 'back' | 'profile'; label: string; onPress: () => void; tintColor: ColorValue; testID?: string };

export function RoleHeaderButton({ icon, label, onPress, tintColor, testID }: Props) {
  const name = icon === 'menu' ? { ios: 'line.3.horizontal' as const, android: 'menu' as const, web: 'menu' as const }
    : icon === 'back' ? { ios: 'chevron.left' as const, android: 'arrow_back' as const, web: 'arrow_back' as const }
    : { ios: 'person.crop.circle' as const, android: 'account_circle' as const, web: 'account_circle' as const };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress} style={styles.button} hitSlop={8}>
    <SymbolView name={name} size={icon === 'profile' ? 27 : 25} tintColor={tintColor} />
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 38, height: 48, justifyContent: 'center', alignItems: 'center' },
});
