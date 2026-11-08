import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { useBoyoqchiText } from './useBoyoqchiText';
export function BoyoqchiMessage({ title, onRefresh, error }: { title: string; onRefresh: () => void; error: boolean }) {
  const colors = useWorkerColors(), t = useBoyoqchiText();
  return <View style={styles.root}>
    <SymbolView name={{ ios: error ? 'wifi.slash' : 'tray', android: error ? 'cloud_off' : 'inventory_2' }} size={44} tintColor={colors.muted} />
    <Text style={{ color: colors.text, textAlign: 'center' }}>{t(title)}</Text>
    <View style={styles.button}><WorkerSheetButton label={t(error ? 'Qayta yuklash' : 'Yangilash')} onPress={onRefresh} variant="filled" /></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 }, button: { minWidth: 150, marginTop: 4 } });
