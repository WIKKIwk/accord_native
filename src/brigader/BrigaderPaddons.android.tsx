import { useBrigaderApparatusDrawer } from './useBrigaderApparatusDrawer';
import { FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { adminText, localizedGetter } from '../shared/localization';
import { appRoutes } from '../shared/appRoutes';
import { WorkerPaddonTransfer } from '../components/WorkerPaddonTransfer';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderApparatusDock } from './BrigaderApparatusDock';
import { FeatureBusy, FeatureError, FeatureRow } from './BrigaderList';
import { Form, Label, Action, ActionRow } from './BrigaderForm';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { useBrigaderPaddons } from './useBrigaderPaddons';
import { useBrigaderFeature, BrigaderFeatureAuthority } from './BrigaderFeatureContext';
import type { WorkerPaddon } from '../workerPaddonModel';
export function BrigaderPaddons() {
  const page = useBrigaderFeature(appRoutes.apparatusPaddons), params = useLocalSearchParams<{ apparatus?:string;name?:string }>(), args = page.args as { transfer?:boolean;apparatusId?:string } | undefined;
  if (args?.transfer) return page.current() ? <WorkerPaddonTransfer session={page.shell.session} apparatus={args.apparatusId ?? ''} onBack={page.back} /> : null;
  return <BrigaderFeatureAuthority value={{ current:page.current,interactive:page.interactive,back:page.back,args:page.args ?? { apparatusId:params.apparatus ?? '',apparatusName:params.name ?? '' } }}><List /></BrigaderFeatureAuthority>;
}
function List() {
  const { page,owner,state,p } = useBrigaderPaddons(), a = (key:string) => adminText(key,page.locale), title = owner.name ? p('worker.paddon.apparatus',{ apparatus:owner.name }) : p('worker.paddons');
  useBrigaderApparatusDrawer(appRoutes.apparatusPaddons);
  const actions = [{ id:'transfer',label:p('worker.paddon.transfer.title'),icon:{ ios:'arrow.up.arrow.down' as const,android:'swap_vert' as const },enabled:!state.creating && !state.deleting,onPress:() => { void owner.transfer(); } },{ id:'create',label:p('worker.paddon.create'),icon:{ ios:'plus' as const,android:'add' as const },enabled:!state.creating,onPress:() => { void owner.create(); } }].filter(item => item.id !== 'transfer' || state.canTransfer);
  return <BrigaderFeatureFrame route={appRoutes.apparatusPaddons} title={title} drawer footer={<BrigaderApparatusDock actions={actions} />}>
    {state.loading && !state.hasData ? <FeatureBusy /> : state.error && !state.hasData ? <FeatureError message={p('worker.paddon.load_failed')} label={localizedGetter('retry',page.locale)} retry={() => { void owner.load(); }} /> : <FlatList data={state.rows} refreshing={state.refreshing} onRefresh={owner.load} keyExtractor={row => row.code} contentContainerStyle={{ padding:4,paddingBottom:120 }} ListHeaderComponent={<Form><Label>{p('worker.paddon.location.title')}</Label><Label>{p('worker.paddon.location.subtitle')}</Label><Label>{`${p('worker.paddons')}: ${state.rows.length}   ${p('worker.daily.wip')}: ${state.rows.reduce((sum,row) => sum+row.item_count,0)}`}</Label><Label>{title}</Label></Form>} ListEmptyComponent={<Form><Label>{p('worker.paddon.empty.title')}</Label><Label>{p('worker.paddon.empty.body')}</Label></Form>} renderItem={({ item,index }) => <FeatureRow title={item.code} subtitle={[item.contains_peremotka ? p('worker.rezka.print.peremotka') : '',p('worker.paddon.wip_count',{ count:item.item_count })].filter(Boolean).join(' • ')} index={index} count={state.rows.length} onPress={() => { void owner.open(item); }} onLongPress={state.deleting ? undefined : () => { void owner.remove(item); }} />} />}
    <BrigaderPresentationHost owner={owner.presentations} sheet={entry => entry.kind === 'actions'} render={(entry,interactive) => {
      const row = entry.data as WorkerPaddon;
      return entry.kind === 'actions' ? <Form><Label>{row.code}</Label><Action label={a('action.delete')} onPress={() => { if (interactive()) owner.presentations.close(entry.id,'delete'); }} /></Form> : <Form><Label>{p('worker.paddon.delete.title')}</Label><Label>{p('worker.paddon.delete.body',{ code:row.code })}</Label><ActionRow actions={[{ label:p('worker.action.cancel'),secondary:true,onPress:() => { if (interactive()) owner.presentations.close(entry.id,false); } },{ label:a('action.delete'),onPress:() => { if (interactive()) owner.presentations.close(entry.id,true); } }]} /></Form>;
    }} />
  </BrigaderFeatureFrame>;
}
