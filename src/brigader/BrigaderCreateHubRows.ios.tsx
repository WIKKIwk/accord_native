import { Button,Divider,HStack,Image,Text,VStack } from '@expo/ui/swift-ui';
import { background,buttonStyle,cornerRadius,font,foregroundStyle,frame,padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { BrigaderCreateHubRowsProps } from './BrigaderCreateHubTypes';
export function BrigaderCreateHubRows({rows}:BrigaderCreateHubRowsProps){const{colors}=useBaseTheme();return <View style={{marginHorizontal:12}}><BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><VStack spacing={0} modifiers={[frame({maxWidth:Infinity}),background(colors.surface),cornerRadius(24)]}>{rows.map((row,index)=><VStack key={index} spacing={0}>{index?<Divider/>:null}<Button onPress={row.open} modifiers={[buttonStyle('plain'),frame({maxWidth:Infinity,minHeight:78}),padding({horizontal:18,vertical:16})]}><HStack spacing={12}><VStack alignment="leading" spacing={6} modifiers={[frame({maxWidth:Infinity,alignment:'leading'})]}><Text modifiers={[font({size:22})]}>{row.title}</Text><Text modifiers={[font({size:13}),foregroundStyle('secondary')]}>{row.subtitle}</Text></VStack><Image systemName="arrow.right" size={22}/></HStack></Button></VStack>)}</VStack></BaseHost></View>;}
