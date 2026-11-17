import { Column,IconButton,RNHostView,Row } from '@expo/ui/jetpack-compose';
import { fillMaxWidth,padding,semantics,weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { AdminText } from '../admin/AdminTypography.android';
export function BrigaderSurfaceHeader({title,closeLabel,onClose,disabled,actions}:{title:string;closeLabel:string;onClose:()=>void;disabled?:boolean;actions?:ReactNode}){return <BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><Row verticalAlignment="center" modifiers={[fillMaxWidth(),padding(16,12,8,8)]}><Column modifiers={[weight(1)]}><AdminText style={{typography:'titleLarge',fontWeight:'800'}}>{title}</AdminText></Column>{actions?<RNHostView matchContents><View style={{flexDirection:'row'}}>{actions}</View></RNHostView>:null}<IconButton enabled={!disabled} onClick={onClose} modifiers={[semantics({contentDescription:closeLabel})]}><RNHostView matchContents><SymbolView name={{android:'close'}} size={24}/></RNHostView></IconButton></Row></BaseHost>;}
