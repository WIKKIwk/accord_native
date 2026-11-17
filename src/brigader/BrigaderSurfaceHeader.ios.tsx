import { Button,HStack,Image,RNHostView,Text } from '@expo/ui/swift-ui';
import { accessibilityLabel,buttonStyle,disabled as inactive,font,frame,padding } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
export function BrigaderSurfaceHeader({title,closeLabel,onClose,disabled,actions}:{title:string;closeLabel:string;onClose:()=>void;disabled?:boolean;actions?:ReactNode}){return <BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><HStack spacing={10} modifiers={[frame({maxWidth:Infinity}),padding({horizontal:16,top:12,bottom:8})]}><Text modifiers={[font({textStyle:'title2',weight:'bold'}),frame({maxWidth:Infinity,alignment:'leading'})]}>{title}</Text>{actions?<RNHostView matchContents><View style={{flexDirection:'row'}}>{actions}</View></RNHostView>:null}<Button onPress={onClose} modifiers={[buttonStyle('plain'),inactive(!!disabled),frame({minWidth:44,minHeight:44}),accessibilityLabel(closeLabel)]}><Image systemName="xmark" size={22}/></Button></HStack></BaseHost>;}
