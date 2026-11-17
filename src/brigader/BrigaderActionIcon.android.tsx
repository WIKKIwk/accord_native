import { FilledTonalIconButton,IconButton,RNHostView } from '@expo/ui/jetpack-compose';
import { semantics,size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
export function BrigaderActionIcon({label,icon,onPress,disabled,tonal=true}:{label:string;icon:NonNullable<SymbolViewProps['name']>;onPress:()=>void;disabled?:boolean;tonal?:boolean}){const{colors}=useBaseTheme(),Component=tonal?FilledTonalIconButton:IconButton;return <BaseHost matchContents style={{width:48,height:48}}><Component enabled={!disabled} onClick={onPress} modifiers={[size(48,48),semantics({contentDescription:label})]}><RNHostView matchContents><SymbolView name={icon} size={22} tintColor={disabled?colors.outline:colors.onSurfaceVariant}/></RNHostView></Component></BaseHost>;}
