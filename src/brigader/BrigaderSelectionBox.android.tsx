import { Checkbox } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from '../components/BaseHost.android';
export function BrigaderSelectionBox({value,onChange,label}:{value:boolean;onChange:(value:boolean)=>void;label:string}){return <BaseHost matchContents style={{width:48,height:48}}><Checkbox value={value} onCheckedChange={onChange} modifiers={[semantics({contentDescription:label})]}/></BaseHost>;}
