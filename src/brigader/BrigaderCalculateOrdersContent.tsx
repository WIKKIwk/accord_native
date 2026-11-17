import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appRoutes } from '../shared/appRoutes';
import { adminText,localizedGetter } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { FeatureBusy,FeatureError } from './BrigaderList';
import { Form,Label } from './BrigaderForm';
import { useBrigaderCalculateOrders } from './useBrigaderCalculateOrders';
import { BrigaderCalculateOrderRow } from './BrigaderCalculateOrderRow';
import { BrigaderCalculateArgs } from './brigaderCalculateArgs';
export function BrigaderCalculateOrdersContent(){const{page,owner,state}=useBrigaderCalculateOrders(),flows=useBrigaderFlows(),drawer=useRoleDrawer(),insets=useSafeAreaInsets(),a=(key:string)=>adminText(key,page.locale),rows=owner.visible(),header=<OrdersHeader search={state.query} onSearchChange={owner.search} searchPlaceholder={a('calculate.order_search')} enabled={page.interactive()} onMenu={()=>{if(page.interactive())drawer.open();}} onSearchFocus={()=>owner.focus(true)} onSearchBlur={()=>owner.focus(false)} trailing={!state.focused?<AdminShellProfileAction/>:null}/>;return <BrigaderFeatureFrame route={appRoutes.adminCalculateOrders} title="" header={header} hideProfile drawer>{state.loading?<FeatureBusy/>:state.error?<FeatureError message={localizedGetter('serverDisconnectedRetry',page.locale)} label={localizedGetter('retry',page.locale)} retry={()=>{void owner.load();}}/>:<FlatList data={rows} contentContainerStyle={{paddingTop:4,paddingBottom:insets.bottom+240}} keyExtractor={item=>item.id} ListEmptyComponent={<Form><Label>{a(state.query.trim()?'calculate.order_empty':'calculate.saved_templates_empty')}</Label></Form>} renderItem={({item,index})=><BrigaderCalculateOrderRow template={item} index={index} count={rows.length} session={page.shell.session} witness={page.shell.witness} current={page.current} interactive={page.interactive} locale={page.locale} onPress={()=>{if(page.interactive())void flows.open({route:appRoutes.adminCalculate,args:new BrigaderCalculateArgs(item)},{isCurrent:page.current,canInteract:page.interactive});}} onDelete={()=>{void owner.remove(item).catch(()=>{});}}/>}/>}</BrigaderFeatureFrame>;}
