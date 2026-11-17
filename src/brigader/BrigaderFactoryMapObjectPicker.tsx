import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AdminFactoryMapViewer, type FactoryMapObjectSelection } from '../admin/AdminFactoryMapViewer';
import { adminText } from '../shared/localization';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { Form, Label, ActionRow } from './BrigaderForm';
import type { BrigaderPresentation, BrigaderPresentations } from './brigaderPresentations';
export function BrigaderFactoryMapObjectPicker({ entry,owner,interactive,locale }: { entry:BrigaderPresentation;owner:BrigaderPresentations;interactive:()=>boolean;locale:string }) {
  const data = entry.data as { initialObjectId:string }, [selection,setSelection] = useState<FactoryMapObjectSelection|null>(null), size = useWindowDimensions(), a = (key:string) => adminText(key,locale);
  return <View style={{ height:Math.max(420,Math.min(760,size.height*.86)) }}><View style={{ flexDirection:'row',alignItems:'center',paddingRight:8 }}><View style={{ flex:1 }}><Form><Label>{a('factory_map.viewer_title')}</Label><Label>{a('factory_map.viewer_instruction')}</Label></Form></View><WorkerIconButton icon="close" label={a('factory_map.close')} onPress={() => { if (interactive()) owner.close(entry.id); }} /></View>
    <View style={{ flex:1 }}><AdminFactoryMapViewer locale={locale} selectedObjectId={data.initialObjectId} selectionMode onObjectTap={value => { if (interactive()) setSelection(value); }} /></View>
    <Form><Label>{selection?.label ?? a('factory_map.viewer_not_selected')}</Label><ActionRow actions={[{ label:a('action.cancel'),secondary:true,onPress:() => { if (interactive()) owner.close(entry.id); } },{ label:a('factory_map.viewer_select'),disabled:!selection,onPress:() => { if (interactive() && selection) owner.close(entry.id,selection); } }]} /></Form>
  </View>;
}
