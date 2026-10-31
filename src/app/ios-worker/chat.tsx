import { StyleSheet, Text, View } from 'react-native';
import { useWorkerColors } from '../../components/useWorkerColors';

export default function IosWorkerChat() {
  const colors = useWorkerColors();
  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Text style={{ color: colors.text }}>Bu bo‘lim hozircha tayyor emas.</Text>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
