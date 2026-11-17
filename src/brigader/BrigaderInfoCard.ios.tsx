import { HStack,Text,VStack } from '@expo/ui/swift-ui';
import { background,cornerRadius,font,foregroundStyle,frame,lineLimit,onTapGesture,onLongPressGesture,padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { BrigaderInfoCardModel } from './brigaderWipModel';
export function BrigaderInfoCard({ model,onPress,onLongPress }: { model:BrigaderInfoCardModel;index?:number;count?:number;onPress?:()=>void;onLongPress?:()=>void }) {
  const { colors } = useBaseTheme();
  return <View style={{ paddingHorizontal:4,paddingBottom:4 }}><BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><VStack alignment="leading" spacing={10} modifiers={[frame({ maxWidth:Infinity }),padding({ all:16 }),background(colors.surface),cornerRadius(16),...(onPress ? [onTapGesture(onPress)] : []),...(onLongPress ? [onLongPressGesture(onLongPress)] : [])]}>
    <HStack alignment="top"><VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth:Infinity,alignment:'leading' })]}><Text modifiers={[font({ textStyle:'headline' }),lineLimit(2)]}>{model.title}</Text>{model.subtitle ? <Text modifiers={[font({ textStyle:'caption' }),foregroundStyle('secondary')]}>{model.subtitle}</Text> : null}</VStack>{model.badge ? <Text modifiers={[font({ textStyle:'caption',weight:'semibold' }),padding({ horizontal:10,vertical:5 }),background(colors.tertiaryContainer),cornerRadius(99)]}>{model.badge}</Text> : null}</HStack>
    {model.lines.map((line,index) => <HStack key={index} alignment="top" spacing={12}><Text modifiers={[font({ textStyle:'caption' }),foregroundStyle('secondary'),frame({ width:96,alignment:'leading' })]}>{line.label}</Text><Text modifiers={[font({ textStyle:'subheadline',weight:'semibold' }),frame({ maxWidth:Infinity,alignment:'leading' })]}>{line.value}</Text></HStack>)}
    {model.summary ? <Text modifiers={[font({ textStyle:'caption' }),foregroundStyle('secondary')]}>{model.summary}</Text> : null}{model.footer ? <Text modifiers={[font({ textStyle:'caption2' }),foregroundStyle('secondary'),lineLimit(1)]}>{model.footer}</Text> : null}
  </VStack></BaseHost></View>;
}
