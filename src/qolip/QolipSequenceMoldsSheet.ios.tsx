import { Button, Host, HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame } from '@expo/ui/swift-ui/modifiers';
import { ScrollView, View } from 'react-native';
import { useQolipSequenceMolds, type QolipSequenceOrder } from './useQolipSequenceMolds';
/** @v2 _SequenceQolipSheet */
export function QolipSequenceMoldsSheet({ order }: { order: QolipSequenceOrder }) {
  const state = useQolipSequenceMolds(order);
  if (!state.valid) return null;
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={14}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{state.text('title')}</Text><Text>{order.map.title.trim() || order.map.id}</Text><Text modifiers={[font({ textStyle: 'caption' })]}>{state.text('description')}</Text>
    {!!state.error && <Text>{state.error}</Text>}{state.loading ? <ProgressView modifiers={[frame({ height: 160 })]} /> : !state.items.length ? <Text>{state.text('empty')}</Text>
      : state.items.map((item, index) => <HStack key={`${item.qolip_code}:${index}`} spacing={12}><Image systemName={item.is_in_use ? 'gearshape.2' : 'shippingbox'} size={24} />
        <VStack alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' })]}>{item.qolip_code}</Text><Text>{[item.color.trim(), item.size > 0 ? String(item.size) : ''].filter(Boolean).join(' • ')}</Text></VStack>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>{state.text(item.is_in_use ? 'in_use' : 'available')}</Text>
      </HStack>)}
    <Button onPress={state.add} modifiers={[buttonStyle('bordered'), disabled(state.saving), frame({ minHeight: 50, maxWidth: Infinity })]}><Text>{state.text('add')}</Text></Button>
  </VStack></Host></ScrollView>{state.content}</View>;
}
