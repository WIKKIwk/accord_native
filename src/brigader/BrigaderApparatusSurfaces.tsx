import { ScrollView, View } from 'react-native';
import { useSyncExternalStore } from 'react';
import { adminText } from '../shared/localization';
import { apparatusKindsForFamily } from '../admin/apparatusOptionsApi';
import type { AdminApparatusCollection } from '../admin/apparatusCollection';
import { Form, Label, Field, ChoiceChips, Check, Select, ActionRow } from './BrigaderForm';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import type { BrigaderApparatusController } from './brigaderApparatusController';
export function BrigaderApparatusSurfaces({ owner,locale }: { owner:BrigaderApparatusController;locale:string }) {
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot), a = (key:string,values?:Record<string,unknown>) => adminText(key,locale,values), optionLabel = (value:string) => a(`apparatus.option.${value}`);
  return <BrigaderPresentationHost owner={owner.presentations} filter={entry => ['editor','collection','deleteCollection'].includes(entry.kind)} render={(entry,interactive) => {
    const cancel = { label:a('action.cancel'),secondary:true,disabled:state.saving,onPress:() => { if (interactive()) owner.presentations.close(entry.id); } };
    if (entry.kind === 'deleteCollection') { const collection = entry.data as AdminApparatusCollection; return <Form><Label>{a('apparatus.group_delete')}</Label><Label>{a('apparatus.group_delete_confirm',{ name:collection.name })}</Label><ActionRow actions={[{ ...cancel,disabled:false },{ label:a('action.delete'),onPress:() => { if (interactive()) owner.presentations.close(entry.id,true); } }]} /></Form>; }
    if (entry.kind === 'collection' && state.collection) { const editor = state.collection; return <View style={{ maxHeight:620 }}><Form><Label>{a(editor.current ? 'apparatus.group_edit' : 'apparatus.group_add')}</Label><Field label={a('apparatus.group_name')} value={editor.name} onChange={value => { if (interactive()) owner.collectionName([...value].slice(0,80).join('')); }} /><Label>{a('apparatus.available')}</Label></Form><ScrollView style={{ maxHeight:360 }}><Form>{state.apparatus.map(item => <Check key={item.id} label={`${item.name}\n${item.id}`} value={editor.selected.includes(item.id)} disabled={state.saving} onChange={value => { if (interactive()) owner.collectionMember(item.id,value); }} />)}</Form></ScrollView><Form><ActionRow actions={[cancel,{ label:a('apparatus.group_save'),disabled:state.saving,onPress:() => { if (interactive()) void owner.saveCollection(entry.id); } }]} /></Form></View>; }
    if (entry.kind === 'editor' && state.editor && state.options) { const editor = state.editor,options = state.options; return <ScrollView style={{ maxHeight:640 }} keyboardShouldPersistTaps="handled"><Form><Label>{a(editor.current ? 'apparatus.master_edit' : 'apparatus.add')}</Label>
      <Field label={a('apparatus.name')} value={editor.name} onChange={value => { if (interactive()) owner.changeEditor('name',value); }} />
      <Select label={a('apparatus.family')} value={editor.family} disabled={state.saving} options={options.families.map(value => ({ value,label:optionLabel(value) }))} onChange={value => { if (interactive()) owner.changeEditor('family',value); }} />
      <Select label={a('apparatus.kind')} value={editor.kind} disabled={state.saving} options={apparatusKindsForFamily(options,editor.family).map(value => ({ value,label:optionLabel(value) }))} onChange={value => { if (interactive()) owner.changeEditor('kind',value); }} />
      {editor.kind === 'color_pechat' || editor.kind === 'flexo' ? <Field label={a('apparatus.color_stations')} value={editor.color} numeric onChange={value => { if (interactive()) owner.changeEditor('color',value); }} /> : null}
      <Label>{a('apparatus.capabilities')}</Label><ChoiceChips disabled={state.saving} options={options.capabilities.map(code => ({ label:optionLabel(code),selected:editor.capabilities.includes(code),onChange:value => { if (interactive()) owner.capability(code,value); } }))} />
      {editor.current ? <Label>{editor.current.id}</Label> : null}<ActionRow actions={[cancel,{ label:a('action.save'),disabled:state.saving,onPress:() => { if (interactive()) void owner.saveEditor(entry.id); } }]} />
    </Form></ScrollView>; }
    return null;
  }} />;
}
