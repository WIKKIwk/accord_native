import { Text,Toggle,VStack } from '@expo/ui/swift-ui';
import { background,cornerRadius,disabled as inactive,font,foregroundStyle,frame,padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
export function BrigaderRequiredMaterialRow({title,subtitle,value,disabled,onChange}:{title:string;subtitle:string;value:boolean;disabled:boolean;onChange:(value:boolean)=>void}){const{colors}=useBaseTheme();return <View style={{paddingHorizontal:12,paddingBottom:8}}><BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><VStack alignment="leading" spacing={6} modifiers={[frame({maxWidth:Infinity}),padding({all:16}),background(colors.surface),cornerRadius(12)]}><Toggle label={title} isOn={value} onIsOnChange={onChange} modifiers={[inactive(disabled)]}/><Text modifiers={[font({textStyle:'caption'}),foregroundStyle('secondary')]}>{subtitle}</Text></VStack></BaseHost></View>;}
