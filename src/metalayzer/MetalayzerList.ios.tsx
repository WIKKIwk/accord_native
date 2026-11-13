import { Button, Host, HStack, Image, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { PlatformColor } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { OrdersList } from '../shared/orders/OrdersList';
import { formatMetalayzerQuantity, type MetalayzerMaterial } from './metalayzerApi';
import { useMetalayzerList } from './useMetalayzerList';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function MetalayzerList() {
  const state = useMetalayzerList(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const row = (item: MetalayzerMaterial) => <HStack alignment="top" spacing={12}>
    <Image systemName="checkmark.circle.fill" size={22} color={PlatformColor('systemBlue')} />
    <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), lineLimit(2)]}>{item.itemName || item.itemCode}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{item.warehouse}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>QR: {item.barcode}</Text>
    </VStack><Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{formatMetalayzerQuantity(item.qty, item.uom)}</Text>
  </HStack>;
  return <><Stack.Screen options={{ title: 'Metallangan xomashyolar' }} /><Host style={{ flex: 1 }}>
    <OrdersList rows={state.items} renderRow={row} rowKey={item => item.barcode} active onRefresh={state.reload}
      headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}
      footer={state.cursor ? <Section>{state.moreError && <Text>{state.moreError}</Text>}
        <Button label={state.moreLoading ? 'Yuklanmoqda...' : state.moreError ? 'Qayta urinish' : 'Yana yuklash'}
          onPress={() => { void state.loadMore(); }} modifiers={[disabled(state.moreLoading || state.loading)]} /></Section> : null}>
      {state.loading && !state.items.length ? <Section><ProgressView /></Section> : null}
      {state.error ? <Section><Button onPress={() => { void state.reload(); }}><VStack alignment="leading">
        <Text>Ro‘yxat yuklanmadi</Text><Text>{state.error}</Text><Text>Qayta urinish</Text></VStack></Button></Section>
        : !state.loading && !state.items.length ? <Section><HStack spacing={12}><Image systemName="shippingbox" size={22} modifiers={[secondary]} />
          <Text>Metallangan xomashyo hali yo‘q</Text></HStack></Section> : null}
    </OrdersList>
  </Host></>;
}
