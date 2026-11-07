import { Column, Host, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { StyleSheet, View } from 'react-native';
import { RoleHeaderButton } from './RoleHeaderButton';

type Navigation = { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string };

export function RoleHeader({ title, subtitle, navigation }: { title: string; subtitle?: string; navigation?: Navigation }) {
  const colors = useMaterialColors();
  return <View style={styles.row}>
    {navigation ? <RoleHeaderButton {...navigation} tintColor={colors.onSurfaceVariant} /> : null}
    <View style={styles.text}><Host matchContents={{ vertical: true }} style={styles.host}>
      <Column>
        <Text color={colors.onSurface} style={{ typography: 'titleLarge' }}>{title}</Text>
        {subtitle ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{subtitle}</Text> : null}
      </Column>
    </Host></View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, minHeight: 70 },
  text: { flex: 1 },
  host: { width: '100%' },
});
