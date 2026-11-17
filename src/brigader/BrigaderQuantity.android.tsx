import { Text } from '@expo/ui/jetpack-compose';
import { BaseHost } from '../components/BaseHost.android';
export function BrigaderQuantity({value}:{value:string}){return <BaseHost matchContents><Text style={{fontSize:14,fontWeight:'800'}}>{value}</Text></BaseHost>;}
