import { Button, HStack, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { frame, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { useQolipSequence } from './useQolipSequence';
import { useQolipText } from './useQolipText';
/** @v2 AdminProductionMapOrdersScreen */
export function QolipSequenceScreen() {
 const h=useQolipSequence(), {text}=useQolipText();
 return <View style={{flex:1}}><OrdersHeader search={h.query} searchPlaceholder={text('nav.sequence')} onSearchChange={h.setQuery} onMenu={h.role.onMenu} onProfile={h.role.onProfile}/>
  <OrdersWorkspace session={h.role.session} tabs={h.apparatus} selected={h.selected} onSelect={h.select} loading={h.loading}>
   {id=><PreparationList refresh={()=>h.reload()}>
    {!!h.error&&<Section><Button label={text('action.retry')} onPress={()=>{void h.reload();}}/></Section>}
    <Section><Text>Bir marta bosing — ma’lumot. Uzoq bosing — order qoliplarini ochish.</Text></Section>
    {h.loading?<ProgressView/>:<Section>{!h.error&&!h.orders(id).length&&<Text>{text('tasks.no_orders')}</Text>}
     {h.orders(id).map((row,index)=><Button key={row.id} onPress={()=>h.detail(row.id)} modifiers={[onLongPressGesture(()=>h.molds(row.id))]}>
      <HStack spacing={12}><Text>{String(index+1)}</Text><VStack alignment="leading" modifiers={[frame({maxWidth:Infinity,alignment:'leading'})]}><Text>{row.code+' · '+row.title}</Text><Text>{row.customer}</Text></VStack></HStack>
     </Button>)}</Section>}
   </PreparationList>}
  </OrdersWorkspace>
 </View>;
}
