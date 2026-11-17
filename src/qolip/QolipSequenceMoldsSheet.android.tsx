import { Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useQolipSequenceMolds, type QolipSequenceOrder } from './useQolipSequenceMolds';
/** @v2 _SequenceQolipSheet */
export function QolipSequenceMoldsSheet({ order }: { order: QolipSequenceOrder }) {
  const state = useQolipSequenceMolds(order), colors = useMaterialColors();
  if (!state.valid) return null;
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}><Host matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 6 }}>
    <Text style={{ typography: 'titleLarge', fontWeight: '800' }}>{state.text('title')}</Text><Text>{order.map.title.trim() || order.map.id}</Text><Text style={{ typography: 'bodySmall' }}>{state.text('description')}</Text>
    {!!state.error && <Text color={colors.error}>{state.error}</Text>}
  </Column></Host>{state.loading ? <ActivityIndicator style={{ height: 160 }} /> : !state.items.length ? <Host matchContents><Text>{state.text('empty')}</Text></Host>
    : state.items.map((item, index) => <View key={`${item.qolip_code}:${index}`} style={{ backgroundColor: colors.surfaceContainerHigh, borderRadius: 16, padding: 12 }}><Host matchContents={{ vertical: true }}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
      <RNHostView matchContents><SymbolView name={{ android: item.is_in_use ? 'precision_manufacturing' : 'inventory_2' }} size={24} tintColor={item.is_in_use ? colors.primary : colors.onSurfaceVariant} /></RNHostView>
      <Column modifiers={[weight(1)]}><Text style={{ fontWeight: '700' }}>{item.qolip_code}</Text><Text>{[item.color.trim(), item.size > 0 ? String(item.size) : ''].filter(Boolean).join(' • ')}</Text></Column>
      <Text color={item.is_in_use ? colors.primary : colors.onSurfaceVariant}>{state.text(item.is_in_use ? 'in_use' : 'available')}</Text>
    </Row></Host></View>)}
    <WorkerSheetButton label={state.text('add')} disabled={state.saving} height={54} icon={{ android: 'add_box' }} onPress={state.add} />
  </ScrollView>{state.content}</View>;
}
