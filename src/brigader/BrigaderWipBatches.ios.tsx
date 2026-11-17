import { FlatList,View } from 'react-native';
import { adminText,localizedGetter } from '../shared/localization';
import { appRoutes } from '../shared/appRoutes';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderExpandableFilter } from './BrigaderExpandableFilter';
import { BrigaderInfoCard } from './BrigaderInfoCard';
import { FeatureBusy,FeatureError } from './BrigaderList';
import { Form,Label } from './BrigaderForm';
import { useBrigaderWip } from './useBrigaderWip';
import { wipBatchCard } from './brigaderWipModel';
export function BrigaderWipBatches() {
  const { page,owner,state } = useBrigaderWip(),a = (key:string) => adminText(key,page.locale);
  return <BrigaderFeatureFrame route={appRoutes.adminWipBatches} title={a('wip.title')} drawer>{state.loading && !state.hasData ? <FeatureBusy /> : state.error ? <FeatureError message={localizedGetter('serverDisconnectedRetry',page.locale)} label={localizedGetter('retry',page.locale)} retry={() => { void owner.load(); }} /> : <View style={{ flex:1 }}>
    <BrigaderExpandableFilter label={a('wip.location')} value={state.filter} expanded={state.expanded} toggle={owner.toggle} select={owner.filter} options={[{ value:'',label:a('wip.all_locations') },...state.locations.map(value => ({ value,label:state.apparatus.find(item => item.id.trim() === value)?.name.trim() || value }))]} />
    <FlatList data={state.rows} refreshing={state.refreshing} onRefresh={() => { void owner.load(); }} keyExtractor={(row,index) => `${row.batch_id}:${index}`} contentContainerStyle={{ paddingTop:8,paddingBottom:136 }} ListHeaderComponent={<Form><Label>{a('wip.intro')}</Label></Form>} ListEmptyComponent={<Form><Label>{a('wip.empty.waiting')}</Label></Form>} renderItem={({ item,index }) => <BrigaderInfoCard model={wipBatchCard(item,state.apparatus,page.locale)} index={index} count={state.rows.length} />} />
  </View>}</BrigaderFeatureFrame>;
}
