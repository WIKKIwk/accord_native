import { Button,Image } from '@expo/ui/swift-ui';
import { accessibilityLabel,buttonStyle,frame } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
export function BrigaderSelectionBox({value,onChange,label}:{value:boolean;onChange:(value:boolean)=>void;label:string}){return <BaseHost matchContents style={{width:48,height:48}}><Button onPress={()=>onChange(!value)} modifiers={[buttonStyle('plain'),frame({minWidth:44,minHeight:44}),accessibilityLabel(label)]}><Image systemName={value?'checkmark.circle.fill':'circle'} size={26}/></Button></BaseHost>;}
