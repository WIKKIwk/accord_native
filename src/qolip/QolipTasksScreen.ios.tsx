import { HStack, ProgressView, RNHostView, Section, Text, VStack, Button } from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, View } from 'react-native';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { PreparationList } from '../preparation/PreparationUI';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { QolipFormSelect } from './QolipFormControls';
import { localizedGetter, productionText } from '../shared/localization';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { useQolipTasks } from './useQolipTasks';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
/** @v2 _SupplyTasksScreenState */
export function QolipTasksScreen() {
 const { state, controller, refresh, attach } = useQolipTasks(), role = useQolipRole(), { text, locale } = useQolipText(), window = state.window;
 return <View style={{ flex: 1 }}><OrdersHeader search={state.searchInput} searchPlaceholder={text('nav.tasks')} onSearchChange={controller.setSearchInput.bind(controller)} onMenu={role.onMenu} onProfile={role.onProfile} />
  {window && <><QolipFormSelect label={productionText('worker.queue.filter.apparatus', locale)} value={window.apparatus_id} options={window.apparatus.map(item => ({ value: item.id, label: item.name }))}
    onChange={id => { const selected=window.apparatus.find(item=>item.id===id); if(selected) void adminSequenceApparatusStore.saveApparatus(selected); void controller.selectApparatus(id); }} />
    <QolipFormSelect label={text('tasks.check')} value={String(window.limit)} options={[5,10,20,50].map(count => ({ value: String(count), label: text('tasks.count',{count}) }))} onChange={value=>{void controller.selectLimit(Number(value));}} /></>}
  <PreparationList refresh={refresh}>{state.loading ? <ProgressView /> : <>
   {!!state.error && <Section><Text>{text('tasks.load_failed')}</Text><Button label={localizedGetter('retry',locale)} onPress={()=>{void refresh();}} modifiers={[buttonStyle('bordered'),frame({minHeight:48,maxWidth:Infinity})]} /></Section>}
   {window && <><Section><Text>{text('tasks.summary',{count:window.checked_count,missing:window.missing_count})}</Text></Section><Section>
    {!window.rows.length && <Text>{text(window.checked_count===0?'tasks.no_orders':window.missing_count===0?'tasks.ready':'products.search_empty')}</Text>}
    {window.rows.map(row=><Button key={row.id} onPress={()=>{void attach(row.id);}}><HStack spacing={12}><RNHostView matchContents><WorkerOrderThumbnail session={role.session} orderId={row.id} imageId={row.image_id} active backgroundColor={PlatformColor('tertiarySystemGroupedBackground')} iconColor={PlatformColor('secondaryLabel')} /></RNHostView><Text>{String(row.position+1)}</Text><VStack alignment="leading" modifiers={[frame({maxWidth:Infinity,alignment:'leading'})]}>
      <Text>{(row.code||row.order_number||row.id)+' · '+row.title}</Text><Text>{[row.customer_name.trim()||row.product_code.trim(),row.apparatus_count>0?productionText('worker.queue.apparatus_count',locale,{count:row.apparatus_count}):''].filter(Boolean).join(' • ')}</Text></VStack><Text>{text('tasks.attach')}</Text></HStack></Button>)}
   </Section></>}
  </>}</PreparationList>
 </View>;
}
