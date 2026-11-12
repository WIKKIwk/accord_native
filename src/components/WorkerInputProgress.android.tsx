import { Column, LinearProgressIndicator, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import type { WorkerInputProgressModel } from '../workerInputProgress';
import { BaseHost } from './BaseHost';

// @v2 _PreviousProgressQrTile
// @v2 _InputProgressBatchList
// @v2 _InputProgressBatchTile
export function WorkerInputProgress({ model }: { model: WorkerInputProgressModel }) {
  const colors = useMaterialColors();
  return <View testID="worker-input-progress" style={[styles.container, { backgroundColor: model.ready ? colors.primaryContainer : colors.surfaceContainerHighest }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.host}>
      <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
        <RNHostView matchContents><SymbolView name={{ android: model.ready ? 'check_circle' : 'qr_code_scanner' }} size={26} tintColor={colors.primary} accessible={false} /></RNHostView>
        <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
          <Text color={colors.onSurface} style={{ typography: 'titleMedium', fontWeight: '700' }}>{model.title}</Text>
          <Text color={colors.onSurfaceVariant} maxLines={2} overflow="ellipsis" style={{ typography: 'bodySmall' }}>{model.subtitle}</Text>
        </Column>
      </Row>
    </BaseHost>
    <View style={[styles.list, { backgroundColor: colors.surface }]}>
      <BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Column verticalArrangement={{ spacedBy: 5 }} modifiers={[fillMaxWidth()]}>
          <Text color={colors.onSurface} style={{ typography: 'titleSmall', fontWeight: '700' }}>{model.products}</Text>
          {model.summary ? <Text color={colors.onSurfaceVariant} maxLines={3} overflow="ellipsis" style={{ typography: 'bodySmall' }}>{model.summary}</Text> : null}
          {model.loading ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : model.error ? <Text color={colors.error}>{model.error}</Text>
            : !model.rows.length ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.empty}</Text> : null}
        </Column>
      </BaseHost>
      {model.rows.map(row => <View key={row.id} testID={row.selected ? 'worker-input-selected' : 'worker-input-candidate'}
        accessibilityState={{ selected: row.selected }} style={[styles.row, {
          backgroundColor: row.selected ? colors.primaryContainer : colors.surfaceContainerHighest,
          borderColor: row.selected ? colors.primary : 'transparent',
        }]}>
        <BaseHost matchContents={{ vertical: true }} style={styles.host}>
          <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
            <RNHostView matchContents><SymbolView name={{ android: row.selected ? 'check' : row.available ? 'qr_code_scanner' : 'done_all' }} size={24} tintColor={row.selected || row.available ? colors.primary : colors.onSurfaceVariant} accessible={false} /></RNHostView>
            <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
              <Text color={colors.onSurface} maxLines={2} overflow="ellipsis" style={{ typography: 'bodyMedium', fontWeight: '700' }}>{row.title}</Text>
              <Text color={row.available ? colors.primary : colors.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={{ typography: 'bodySmall', fontWeight: '600' }}>{row.status}</Text>
              <Text color={colors.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={{ typography: 'bodySmall' }}>{row.qr}</Text>
            </Column>
          </Row>
        </BaseHost>
      </View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  host: { width: '100%' }, container: { borderRadius: 12, padding: 12, gap: 16 },
  list: { borderRadius: 12, padding: 10, gap: 8 }, row: { borderRadius: 10, borderWidth: 1.4, padding: 10 },
});
