import { Column, Host, IconButton, OutlinedTextField, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { RezkaItemPickerProps } from './rezkaItemPickerTypes';
import { useRezkaItemPicker, useRezkaText } from './useRezkaSplit';

// V2 _RezkaItemPickerSheet, available only through the split screen's native sheet.
export function RezkaItemPicker({ session, scope, select }: RezkaItemPickerProps) {
  const { controller, state } = useRezkaItemPicker(session, scope), query = useNativeState(state.query), t = useRezkaText(), colors = useMaterialColors();
  const { height } = useWindowDimensions();
  useEffect(() => { if (query.get() !== state.query) query.set(state.query); }, [query, state.query]);
  return <View style={{ height: height * 0.72, paddingTop: 8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="center">
    <OutlinedTextField value={query} onValueChange={value => controller.setQuery(value)} singleLine
      keyboardOptions={{ imeAction: 'search' }} keyboardActions={{ onSearch: () => controller.submit() }}>
      <OutlinedTextField.Label><Text>{t('ERPNext item qidirish')}</Text></OutlinedTextField.Label>
    </OutlinedTextField>
    <IconButton onClick={() => controller.submit()} modifiers={[semantics({ contentDescription: t('ERPNext item qidirish') })]}>
      <RNHostView matchContents><SymbolView name={{ android: 'arrow_forward' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
    </IconButton>
  </Row></Host>
  <ScrollView keyboardShouldPersistTaps="handled">
    {state.loading ? <ActivityIndicator /> : null}
    {!state.loading && !state.items.length ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{t('Mahsulot topilmadi')}</Text></Host> : null}
    {!state.loading ? state.items.map((item, index) => <WorkerQueueCard key={`${item.code}:${index}`} first last backgroundColor={colors.surfaceContainerHighest} onPress={() => select(item)}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
        <Text>{item.name || item.code}</Text><Text>{`${item.code} • ${item.uom} • ${item.warehouse}`}</Text>
      </Column></Host>
    </WorkerQueueCard>) : null}
  </ScrollView></View>;
}
