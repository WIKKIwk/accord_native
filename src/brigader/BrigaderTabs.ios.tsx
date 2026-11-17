import { Picker,Text } from '@expo/ui/swift-ui';
import { frame,padding,pickerStyle,tag } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import type { BrigaderTabsProps } from './brigaderTabsTypes';
export function BrigaderTabs(props:BrigaderTabsProps) {
  return <View style={{ flex:1 }}><BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><Picker label="" selection={props.selected} onSelectionChange={value => { if (typeof value === 'number') props.onSelect(value); }} modifiers={[pickerStyle('segmented'),frame({ minHeight:44 }),padding({ horizontal:12,vertical:4 })]}>{props.labels.map((label,index) => <Text key={index} modifiers={[tag(index)]}>{label}</Text>)}</Picker></BaseHost>{props.children.map((child,index) => <View key={index} style={{ flex:1,display:props.selected === index ? 'flex' : 'none' }}>{child}</View>)}</View>;
}
