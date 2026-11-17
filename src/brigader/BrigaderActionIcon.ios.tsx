import { Button,Image } from '@expo/ui/swift-ui';
import { accessibilityLabel,buttonStyle,disabled,frame } from '@expo/ui/swift-ui/modifiers';
import type { SymbolViewProps } from 'expo-symbols';
import { BaseHost } from '../components/BaseHost.ios';
export function BrigaderActionIcon({label,icon,onPress,disabled:blocked,tonal=true}:{label:string;icon:NonNullable<SymbolViewProps['name']>;onPress:()=>void;disabled?:boolean;tonal?:boolean}){const name=typeof icon==='string'?icon:icon.ios??'ellipsis';return <BaseHost matchContents style={{width:48,height:48}}><Button onPress={onPress} modifiers={[buttonStyle(tonal?'bordered':'plain'),disabled(!!blocked),accessibilityLabel(label),frame({minWidth:44,minHeight:44})]}><Image systemName={name} size={22}/></Button></BaseHost>;}
