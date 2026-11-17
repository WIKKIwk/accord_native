import { ScrollView, View } from 'react-native';
import { adminText, localizedGetter } from '../shared/localization';
import { appRoutes } from '../shared/appRoutes';
import { AdminQueuePolicyPanel } from '../admin/AdminQueuePolicyScreen';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderBottomBar } from './BrigaderBottomBar';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { BrigaderPopupMenu } from './BrigaderPopupMenu';
import { FeatureBusy, FeatureError, FeatureRow } from './BrigaderList';
import { Form, Label } from './BrigaderForm';
import { BrigaderApparatusSurfaces } from './BrigaderApparatusSurfaces';
import { BrigaderCapacityPanel } from './BrigaderCapacityPanel';
import { canonicalApparatusGroups, type ApparatusModule } from './brigaderApparatusController';
import { useBrigaderApparatus } from './useBrigaderApparatus';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { BrigaderApparatusDetail } from './BrigaderApparatusDetail';
import { useBrigaderNotice } from './useBrigaderNotice';
export function BrigaderApparatusScreen({ initial = 'hub',focusName = false,route = appRoutes.adminApparatusSettings }: { initial?:ApparatusModule;focusName?:boolean;route?:string }) {
  const page = useBrigaderFeature(route), args = page.args as { detail?: Parameters<typeof BrigaderApparatusDetail>[0] } | undefined;
  return args?.detail ? <BrigaderApparatusDetail {...args.detail} /> : <Content initial={initial} focusName={focusName} route={route} />;
}
function Content({ initial,focusName,route }: { initial:ApparatusModule;focusName:boolean;route:string }) {
  const { page,owner,state,back,openDetail } = useBrigaderApparatus(route,initial,focusName), notice = useBrigaderNotice(), a = (key:string,values?:Record<string,unknown>) => adminText(key,page.locale), module = state.module;
  const title = module === 'catalog' ? 'Aparatlar ro‘yxati' : a(module === 'hub' ? 'apparatus.title' : module === 'groups' ? 'apparatus.groups' : module === 'queue' ? 'apparatus.tabs_queue' : 'apparatus.tabs_capacity');
  const fab = module === 'catalog' || module === 'groups' ? [{ id:module,label:a(module === 'catalog' ? 'apparatus.add' : 'apparatus.group_add'),icon:{ ios:module === 'catalog' ? 'gearshape.2' as const : 'folder.badge.plus' as const,android:module === 'catalog' ? 'precision_manufacturing' as const : 'create_new_folder' as const },enabled:!state.saving,onPress:() => { if (page.interactive()) { if (module === 'catalog') void owner.edit(); else void owner.editCollection(); } } }] : undefined;
  const footer = <><BrigaderBottomBar active="home" primary={!fab} />{fab ? <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} actions={fab} /> : null}</>;
  const menu = (actions:{ label:string;onPress:()=>void }[]) => <BrigaderPopupMenu label={a('action.more')} disabled={state.saving} actions={actions} />;
  const catalog = state.apparatus.map((item,index) => <FeatureRow key={item.id} index={index} count={state.apparatus.length} title={item.name} subtitle={`${item.family === 'other' ? item.family : a(`apparatus.option.${item.family}`)} · ${item.id}`} onPress={() => { void openDetail(item); }} trailing={menu([{ label:a('apparatus.settings'),onPress:() => { void openDetail(item); } },{ label:a('action.edit'),onPress:() => { void owner.edit(item); } }])} />);
  return <BrigaderFeatureFrame route={route} title={title} drawer={module === 'hub'} onBack={back} footer={footer}>
    {state.loading ? <FeatureBusy /> : state.error ? <FeatureError message={localizedGetter('serverDisconnectedRetry',page.locale)} label={localizedGetter('retry',page.locale)} retry={() => { void owner.load(true); }} /> : <ScrollView contentContainerStyle={{ padding:4,paddingBottom:112 }} keyboardShouldPersistTaps="handled">
      {module === 'hub' ? [{ module:'catalog',title:'Aparatlar ro‘yxati',subtitle:`${state.apparatus.length} ta apparat faol` },{ module:'groups',title:a('apparatus.groups'),subtitle:`${state.collections.length} ta maxsus guruh` },{ module:'queue',title:a('apparatus.tabs_queue'),subtitle:'FIFO va navbat qoidalari' },{ module:'capacity',title:a('apparatus.tabs_capacity'),subtitle:'Ish vaqti, smena va parallel slotlar' }].map((row,index) => <FeatureRow key={row.module} index={index} count={4} title={row.title} subtitle={row.subtitle} onPress={() => owner.module(row.module as ApparatusModule)} />) : null}
      {module === 'catalog' ? state.apparatus.length ? catalog : <Form><Label>{a('apparatus.empty')}</Label></Form> : null}
      {module === 'groups' ? <><Form><Label>{a('apparatus.custom_groups_description')}</Label><Label>{a('apparatus.saved_groups')}</Label>{!state.collections.length ? <Label>{a('apparatus.custom_groups_empty')}</Label> : null}</Form>{state.collections.map((collection,index) => <View key={collection.id}><FeatureRow index={index} count={state.collections.length} title={collection.name} subtitle={a('apparatus.count',{ count:String(collection.apparatusIds.length) })} onPress={() => owner.toggleExpanded(collection.id)} trailing={menu([{ label:a('action.edit'),onPress:() => { void owner.editCollection(collection); } },{ label:a('action.delete'),onPress:() => { void owner.deleteCollection(collection); } }])} />{state.expanded.has(collection.id) ? collection.apparatusIds.length ? collection.apparatusIds.map(id => { const item = state.apparatus.find(row => row.id === id); return <FeatureRow key={id} title={item?.name ?? id} subtitle={item ? `${item.family} · ${id}` : undefined} disabled={!item} onPress={() => { if (item) void openDetail(item); }} />; }) : <Form><Label>{a('apparatus.empty')}</Label></Form> : null}</View>)}
        <Form><Label>{a('apparatus.automatic_groups')}</Label><Label>{a('apparatus.groups_canonical_description')}</Label></Form>{canonicalApparatusGroups(state.apparatus).map((group,index,groups) => <View key={group.key}><FeatureRow index={index} count={groups.length} title={a(group.key === 'extrusion_lamination' ? 'apparatus.option.extruder_laminatsiya' : `apparatus.group.${group.key}`)} subtitle={a('apparatus.count',{ count:String(group.apparatus.length) })} onPress={() => owner.toggleExpanded(group.key)} />{state.expanded.has(group.key) ? group.apparatus.map(item => <FeatureRow key={item.id} title={item.name} subtitle={`${item.family} · ${item.id}`} onPress={() => { void openDetail(item); }} />) : null}</View>)}{!canonicalApparatusGroups(state.apparatus).length ? <Form><Label>{a('apparatus.groups_empty')}</Label></Form> : null}</> : null}
      {module === 'queue' ? <AdminQueuePolicyPanel session={page.shell.session} witness={page.shell.witness} isCurrent={page.current} navigation={{ icon:'back',label:page.backLabel,onPress:back }} onErrorNotice={message => notice(message,'error')} /> : null}
      {module === 'capacity' ? <BrigaderCapacityPanel apparatus={state.apparatus} /> : null}
    </ScrollView>}
    <BrigaderApparatusSurfaces owner={owner} locale={page.locale} />
  </BrigaderFeatureFrame>;
}
