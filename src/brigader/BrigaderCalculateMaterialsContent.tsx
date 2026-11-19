import type { ReactNode } from 'react';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
import { ScrollView,useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { appRoutes } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderBottomBar } from './BrigaderBottomBar';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { BrigaderSequenceList } from './BrigaderSequenceList';
import { FeatureBusy,FeatureError,FeatureRow } from './BrigaderList';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
import { BrigaderActionIcon } from './BrigaderActionIcon';
import { Form,Label,Field,Action,FieldsRow,Toggle } from './BrigaderForm';
import { useBrigaderCalculateMaterials } from './useBrigaderCalculateMaterials';
export function BrigaderCalculateMaterialsContent({ showMessage, renderPrimary }: {
  showMessage?: (message: string) => void;
  renderPrimary?: (props: { page: ReturnType<typeof useBrigaderCalculateMaterials>['page']; actions: readonly AdminMenuAction[] }) => ReactNode;
} = {}) {
  const { page, owner, state } = useBrigaderCalculateMaterials(showMessage);
  const size = useWindowDimensions(), a = (key: string) => adminText(key, page.locale);
  const actions: readonly AdminMenuAction[] = [{ id: 'material', label: a('material.add'), icon: { ios: 'shippingbox', android: 'add_box' },
    enabled: !state.saving, onPress: () => { void owner.edit(); } }];
  return <BrigaderFeatureFrame route={appRoutes.adminCalculateMaterials} title={a('material.title')} drawer footer={renderPrimary ? undefined : <><BrigaderBottomBar active="home" primary={false} /><BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} actions={actions} /></>}>
 {state.loading?<FeatureBusy/>:state.error?<FeatureError message={state.error} label={a('action.retry')} retry={()=>{void owner.load();}}/>:<BrigaderSequenceList rows={state.materials} rowKey={item=>item.id} activeCount={state.materials.filter(item=>item.active).length} enabled={!state.saving} current={page.interactive} onReorder={(oldIndex,newIndex)=>{void owner.reorder(oldIndex,newIndex);}} header={<Form><Label>{a('material.description')}</Label></Form>} empty={<Form><Label>{a('material.empty')}</Label></Form>} render={(item,index,handle)=><FeatureRow title={item.name} index={index} count={state.materials.length} disabled={state.saving} onPress={()=>{void owner.edit(item);}} trailing={handle??<SymbolView name={{ios:'eye.slash',android:'visibility_off'}} size={24}/>}/>}/>}<BrigaderPresentationHost owner={owner.presentations} sheet={()=>true} render={(entry,interactive)=>{const editor=state.editor;if(!editor)return null;return <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:size.height*.9}}><BrigaderSurfaceHeader title={a(editor.original?'material.edit':'material.add')} closeLabel={a('action.close')} onClose={()=>{if(interactive())owner.presentations.close(entry.id);}}/><Form><Field label={a('material.name')} value={editor.name} error={editor.errors.name} onChange={value=>{if(interactive())owner.change('name',value);}}/><Field label={a('material.density')} hint={a('material.density_hint')} unit="g/cm³" value={editor.density} numeric error={editor.errors.density} onChange={value=>{if(interactive())owner.change('density',value);}}/><Toggle label={a('material.show_in_picker')} value={editor.active} onChange={value=>{if(interactive())owner.active(value);}}/><Label>{a('material.microns')}</Label><Label>{a('material.actual_gsm_note')}</Label>{editor.variants.map((variant,index)=><FieldsRow key={index} action={editor.variants.length!==1?<BrigaderActionIcon label={a('action.delete')} icon={{ios:'minus.circle',android:'remove_circle_outline'}} tonal={false} onPress={()=>{if(interactive())owner.removeVariant(index);}}/>:undefined}>{[<Field key="micron" label={a('material.micron')} numeric value={variant.micron} error={editor.errors[`${index}:micron`]} onChange={value=>{if(interactive())owner.variant(index,'micron',value);}}/>,<Field key="gsm" label={a('material.actual_gsm')} numeric value={variant.actualGsm} error={editor.errors[`${index}:actualGsm`]} onChange={value=>{if(interactive())owner.variant(index,'actualGsm',value);}}/>]}</FieldsRow>)}{editor.variantError?<Label>{editor.variantError}</Label>:null}<Action label={a('material.add_micron')} secondary onPress={()=>{if(interactive())owner.addVariant();}}/><Action label={a('action.save')} onPress={()=>{if(interactive())owner.saveDraft(entry.id);}}/></Form></ScrollView>;}}/>
 {renderPrimary?.({ page, actions })}
 </BrigaderFeatureFrame>;
}
