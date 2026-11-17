import { Column,HorizontalDivider,Row,RNHostView,Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth,padding,weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { AdminText as Text } from '../admin/AdminTypography.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { workerDetailShape } from '../admin/AdminWorkerDetailNative.android';
import type { BrigaderCreateHubRowsProps } from './BrigaderCreateHubTypes';
export function BrigaderCreateHubRows({rows}:BrigaderCreateHubRowsProps){const{colors}=useBaseTheme();return <View style={{marginHorizontal:12}}><BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><Surface color={colors.surface} shape={workerDetailShape(24)}><Column modifiers={[fillMaxWidth()]}>{rows.map((row,index)=><Column key={index} modifiers={[fillMaxWidth()]}>{index?<HorizontalDivider/>:null}<Surface onClick={row.open} color={colors.surface}><Row verticalAlignment="center" horizontalArrangement={{spacedBy:12}} modifiers={[fillMaxWidth(),padding(18,16,18,16)]}><Column verticalArrangement={{spacedBy:6}} modifiers={[weight(1)]}><Text style={{typography:'titleLarge'}}>{row.title}</Text><Text color={colors.onSurfaceVariant} style={{typography:'bodySmall'}}>{row.subtitle}</Text></Column><RNHostView matchContents><SymbolView name={{android:'arrow_forward'}} size={24} tintColor={colors.onSurfaceVariant}/></RNHostView></Row></Surface></Column>)}</Column></Surface></BaseHost></View>;}
