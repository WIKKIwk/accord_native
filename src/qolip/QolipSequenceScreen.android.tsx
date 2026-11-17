import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useQolipSequence } from './useQolipSequence';
import { useQolipText } from './useQolipText';
/** @v2 AdminProductionMapOrdersScreen */
export function QolipSequenceScreen() {
 const h=useQolipSequence(), {text}=useQolipText(), colors=useMaterialColors(), insets=useSafeAreaInsets(), offset=useSharedValue(0), height=useSharedValue(0);
 return <View style={{flex:1,paddingTop:insets.top,backgroundColor:colors.surfaceContainerLow}}>
  <OrdersHeader search={h.query} searchPlaceholder={text('nav.sequence')} onSearchChange={h.setQuery} onMenu={h.role.onMenu} onProfile={h.role.onProfile}/>
  <OrdersWorkspace session={h.role.session} tabs={h.apparatus} selected={h.selected} onSelect={h.select} loading={h.loading}>
   {(id,gesture)=> <OrdersList active={id===h.selected} pagerGesture={gesture} passthrough={()=>true} headerOffset={offset} headerHeight={height} topInset={0} onRefresh={()=>h.reload()}>
    {!!h.error&&<WorkerSheetButton label={text('action.retry')} onPress={()=>{void h.reload();}}/>}
    <Text style={{color:colors.onSurfaceVariant,padding:12}}>Bir marta bosing — ma’lumot. Uzoq bosing — order qoliplarini ochish.</Text>
    {h.loading&&<ActivityIndicator/>}{!h.loading&&!h.error&&!h.orders(id).length&&<Text style={{color:colors.onSurfaceVariant,padding:24}}>{text('tasks.no_orders')}</Text>}
    {h.orders(id).map((row,index)=> <OrderListItem key={row.id} session={h.role.session} orderId={row.id} imageId={row.imageId} imageActive last={index===h.orders(id).length-1}
      headline={String(index+1)+'. '+row.code+' · '+row.title} supportingText={row.customer} onPress={()=>h.detail(row.id)} onLongPress={()=>h.molds(row.id)}/>)}
   </OrdersList>}
  </OrdersWorkspace>{h.role.dock}
 </View>;
}
