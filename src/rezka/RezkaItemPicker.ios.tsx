import { Button, Host, HStack, List, ProgressView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelStyle, listStyle, onSubmit } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import type { RezkaItemPickerProps } from './rezkaItemPickerTypes';
import { useRezkaItemPicker, useRezkaText } from './useRezkaSplit';

// V2 _RezkaItemPickerSheet, available only through the split screen's native sheet.
export function RezkaItemPicker({ session, scope, select }: RezkaItemPickerProps) {
  const { controller, state } = useRezkaItemPicker(session, scope), query = useNativeState(state.query), t = useRezkaText();
  const { height } = useWindowDimensions();
  useEffect(() => { if (query.get() !== state.query) query.set(state.query); }, [query, state.query]);
  return <Host style={{ height: height * 0.72 }}><VStack>
    <HStack><TextField text={query} placeholder={t('ERPNext item qidirish')} onTextChange={value => controller.setQuery(value)}
      modifiers={[onSubmit(() => controller.submit())]} />
      <Button label={t('ERPNext item qidirish')} systemImage="arrow.right" modifiers={[labelStyle('iconOnly'), accessibilityLabel(t('ERPNext item qidirish'))]}
        onPress={() => controller.submit()} /></HStack>
    <List modifiers={[listStyle('plain')]}>
      {state.loading ? <ProgressView /> : null}
      {!state.loading && !state.items.length ? <Text>{t('Mahsulot topilmadi')}</Text> : null}
      {!state.loading ? state.items.map((item, index) => <Button key={`${item.code}:${index}`} onPress={() => select(item)}>
        <VStack alignment="leading"><Text>{item.name || item.code}</Text><Text>{`${item.code} • ${item.uom} • ${item.warehouse}`}</Text></VStack>
      </Button>) : null}
    </List>
  </VStack></Host>;
}
