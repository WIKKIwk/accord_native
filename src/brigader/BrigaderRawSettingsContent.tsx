import { FlatList,View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { adminText,localizedGetter } from '../shared/localization';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderBottomBar } from './BrigaderBottomBar';
import { BrigaderTabs } from './BrigaderTabs';
import { FeatureBusy,FeatureError,FeatureRow } from './BrigaderList';
import { Form,Select,Action } from './BrigaderForm';
import { BrigaderRequiredMaterialRow } from './BrigaderRequiredMaterialRow';
import { BrigaderRawAssignments } from './BrigaderRawAssignments';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderRawGroupDialog } from './BrigaderRawGroupDialog';
import type { RawRequirementGroup } from '../admin/rawMaterialRulesApi';
import { useBrigaderRawRules } from './useBrigaderRawRules';
import { rawGroupsSummary } from './brigaderRawRulesModel';
export class BrigaderRawMaterialAssignmentArgs{constructor(readonly initialBarcode:string){}}
export function BrigaderRawSettingsContent({route=appRoutes.adminRawMaterialSettings}:{route?:string}){const{page,owner,state}=useBrigaderRawRules(route),a=(key:string)=>adminText(key,page.locale),initialBarcode=page.args instanceof BrigaderRawMaterialAssignmentArgs?page.args.initialBarcode:'';
 const ruleTab=<FlatList data={state.rules} keyExtractor={item=>item.apparatus_id} contentContainerStyle={{paddingTop:10,paddingBottom:136}} ListHeaderComponent={<Form><Select label={a('worker.apparatus_label')} value={state.selected||null} options={state.apparatus.map(item=>({value:item.id,label:item.name.trim()}))} disabled={state.saving||!state.apparatus.length} onChange={owner.select}/><Select label={a('raw_material.start_rule')} value={state.policy} disabled={state.saving} options={[{value:'state_all',label:a('raw_material.state_all')},{value:'requirement_groups',label:a('raw_material.each_group_min')}]} onChange={owner.policy}/><Action label={`${a('raw_material.groups_label')}: ${rawGroupsSummary(state.groups)||a('raw_material.select')}`} disabled={state.saving} secondary onPress={()=>{void owner.pickGroups();}}/><Action label={a('action.save')} disabled={state.saving} onPress={()=>{void owner.save();}}/></Form>} renderItem={({item,index})=><FeatureRow title={item.apparatus} subtitle={`${item.item_groups.join(', ')}\n${a(item.requires_material?'raw_material.mandatory':'raw_material.optional')}`} index={index} count={state.rules.length} onPress={()=>owner.selectRule(item.apparatus_id)}/>}/>;
 const required=<FlatList data={state.apparatus} keyExtractor={item=>item.id} contentContainerStyle={{paddingTop:10,paddingBottom:136}} renderItem={({item})=>{const rule=state.rules.find(rule=>rule.apparatus_id===item.id);return <BrigaderRequiredMaterialRow title={item.name.trim()} subtitle={rule?.item_groups.join(', ')||a('raw_material.select_group_first')} value={rule?.requires_material??false} disabled={!rule?.item_groups.length||state.saving} onChange={value=>{void owner.require(item,value);}}/>;}}/>;
 return <BrigaderFeatureFrame route={route} drawer title={a('raw_material.settings_title')} footer={<BrigaderBottomBar active="settings"/>}>{state.loading?<FeatureBusy/>:state.error?<FeatureError message={localizedGetter('serverDisconnectedRetry',page.locale)} label={localizedGetter('retry',page.locale)} retry={()=>{void owner.load();}}/>:<BrigaderTabs labels={[a('raw_material.link_tab'),a('raw_material.rules_tab'),a('raw_material.requirement_tab')]} selected={state.tab} onSelect={owner.selectTab}>{[<BrigaderRawAssignments key="assignments" route={route} initialBarcode={initialBarcode}/>,ruleTab,required]}</BrigaderTabs>}<BrigaderPresentationHost owner={owner.presentations} options={()=>({inset:12,maxWidth:560})} render={(entry,interactive)=>{const data=entry.data as {options:string[];groups:RawRequirementGroup[]};return <View><BrigaderRawGroupDialog options={data.options} groups={data.groups} locale={page.locale} interactive={interactive} close={()=>{if(interactive())owner.presentations.close(entry.id);}} select={groups=>{if(interactive())owner.presentations.close(entry.id,groups);}}/></View>;}}/></BrigaderFeatureFrame>;
}
