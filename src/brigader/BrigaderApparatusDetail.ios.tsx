import { ScrollView } from 'react-native';
import { adminText, productionText } from '../shared/localization';
import { appRoutes } from '../shared/appRoutes';
import { AdminQueuePolicyPanel } from '../admin/AdminQueuePolicyScreen';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderCapacityPanel } from './BrigaderCapacityPanel';
import { Form, Label, Action, ActionRow, Toggle } from './BrigaderForm';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderApparatusSurfaces } from './BrigaderApparatusSurfaces';
import { BrigaderFactoryMapObjectPicker } from './BrigaderFactoryMapObjectPicker';
import type { BrigaderApparatusController } from './brigaderApparatusController';
import { useBrigaderApparatusDetail } from './useBrigaderApparatusDetail';
import { useBrigaderNotice } from './useBrigaderNotice';
export function BrigaderApparatusDetail({ owner:parent,id }: { owner:BrigaderApparatusController;id:string }) {
  const { page,owner,state,item,busy,setTraining,setMaterial,placement } = useBrigaderApparatusDetail(parent,id), notice = useBrigaderNotice(), a = (key:string,values?:Record<string,unknown>) => adminText(key,page.locale,values), p = (key:string) => productionText(key,page.locale);
  if (!item) return null;
  return <BrigaderFeatureFrame route={appRoutes.adminApparatusSettings} title={item.name}><ScrollView contentContainerStyle={{ padding:4,paddingBottom:112 }}>
    <Form><Label>{item.name}</Label><Label>{item.family === 'other' ? item.id : `${item.family} · ${item.id}`}</Label><Action label={a('action.edit')} onPress={() => { if (page.interactive()) void owner.edit(item); }} />{item.capabilities.length ? <Label>{item.capabilities.join(' • ')}</Label> : null}</Form>
    <Form><Toggle label={p('worker.material_use.setting')} value={item.worker_material_assignment_allowed} disabled={busy.material} onChange={value => { void setMaterial(value); }} /><Label>{p('worker.material_use.setting_description')}</Label><Label>{a('apparatus.tabs_capacity')}</Label></Form>
    <BrigaderCapacityPanel apparatus={[item]} selector={false} />
    <Form><Label>{a('apparatus.tabs_queue')}</Label></Form><AdminQueuePolicyPanel session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} apparatusId={item.id} navigation={{ icon:'back',label:page.backLabel,onPress:page.back }} onErrorNotice={message => notice(message,'error')} />
    <Form><Label>{a('apparatus.tabs_map')}</Label>{item.factory_map_object_id.trim() ? <Label>{item.factory_map_object_id.trim()}</Label> : null}<Action label={a('apparatus.choose_map_object')} disabled={busy.placement} onPress={() => { void placement(false); }} />{item.factory_map_object_id.trim() ? <Action secondary label={a('apparatus.remove_link')} disabled={busy.placement} onPress={() => { void placement(true); }} /> : null}
      <Label>{a('apparatus.tabs_training')}</Label><Toggle label={a('apparatus.training_switch')} value={state.trainingAvailable && item.training_enabled} disabled={busy.training || !state.trainingAvailable} onChange={value => { void setTraining(value); }} /><Label>{a(!state.trainingAvailable ? 'training.load_failed' : item.training_enabled ? 'apparatus.training_on_description' : 'apparatus.training_off_description')}</Label>
    </Form>
    </ScrollView><BrigaderApparatusSurfaces owner={owner} locale={page.locale} />
    <BrigaderPresentationHost owner={owner.presentations} filter={entry => entry.kind === 'mapObject' || entry.kind === 'unlink'} dismissible={entry => entry.kind !== 'mapObject'} options={entry => entry.kind === 'mapObject' ? { inset:12,maxWidth:920 } : {}} render={(entry,interactive) => entry.kind === 'mapObject' ? <BrigaderFactoryMapObjectPicker entry={entry} owner={owner.presentations} interactive={interactive} locale={page.locale} /> : <Form><Label>{a('apparatus.remove_link')}</Label><Label>{a('factory_map.unlink_confirmation',{ name:String(entry.data) })}</Label><ActionRow actions={[{ label:a('action.cancel'),secondary:true,onPress:() => { if (interactive()) owner.presentations.close(entry.id,false); } },{ label:a('apparatus.remove_link'),onPress:() => { if (interactive()) owner.presentations.close(entry.id,true); } }]} /></Form>} />
  </BrigaderFeatureFrame>;
}
