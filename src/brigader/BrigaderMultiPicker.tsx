import { useState } from 'react';
import { FlatList,View,useWindowDimensions } from 'react-native';
import { Form,Field,Label,Check } from './BrigaderForm';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
import { BrigaderActionIcon } from './BrigaderActionIcon';
type Item={id:string;title:string;subtitle?:string;search?:string};
/** Source M3AsyncPickerSheet multiSelectOnTap, with selection retained across search. */
export function BrigaderMultiPicker({title,supporting,hint,items,initial,selectedLabel,confirmLabel,closeLabel,interactive,close,confirm}:{title:string;supporting?:string;hint:string;items:Item[];initial:string[];selectedLabel:(count:number)=>string;confirmLabel:string;closeLabel:string;interactive:()=>boolean;close:()=>void;confirm:(ids:string[])=>void}){
  const [query,setQuery]=useState(''),[selected,setSelected]=useState(()=>new Set(initial.filter(id=>items.some(item=>item.id===id)))),size=useWindowDimensions(),needle=query.trim().toLowerCase(),rows=items.filter(item=>!needle||(item.search??`${item.title} ${item.subtitle??''}`).toLowerCase().includes(needle));
  return <View style={{height:size.height*.66}}><BrigaderSurfaceHeader title={selected.size?selectedLabel(selected.size):title} closeLabel={closeLabel} onClose={close} actions={<BrigaderActionIcon label={confirmLabel} icon={{ios:'checkmark',android:'check'}} onPress={()=>{if(interactive())confirm([...selected]);}}/>}/><Form>{supporting?<Label>{supporting}</Label>:null}<Field label={hint} value={query} onChange={value=>{if(interactive())setQuery(value);}} /></Form><FlatList data={rows} keyExtractor={item=>item.id} keyboardShouldPersistTaps="handled" renderItem={({item})=><Form><Check label={`${item.title}${item.subtitle?'\n'+item.subtitle:''}`} value={selected.has(item.id)} onChange={checked=>{if(!interactive())return;setSelected(previous=>{const next=new Set(previous);if(checked)next.add(item.id);else next.delete(item.id);return next;});}} /></Form>}/></View>;
}
