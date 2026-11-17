import { Column,Row,Switch,Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth,padding,weight } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText } from '../admin/AdminTypography.android';
import { workerDetailShape } from '../admin/AdminWorkerDetailNative.android';
export function BrigaderRequiredMaterialRow({title,subtitle,value,disabled,onChange}:{title:string;subtitle:string;value:boolean;disabled:boolean;onChange:(value:boolean)=>void}){const{colors}=useBaseTheme();return <View style={{paddingHorizontal:12,paddingBottom:8}}><BaseHost matchContents={{vertical:true}} style={{width:'100%'}}><Surface color={colors.surfaceContainerLowest} shape={workerDetailShape(8)} modifiers={[fillMaxWidth()]}><Row verticalAlignment="center" horizontalArrangement={{spacedBy:12}} modifiers={[fillMaxWidth(),padding(16,12,16,12)]}><Column modifiers={[weight(1)]}><AdminText style={{typography:'bodyLarge'}}>{title}</AdminText><AdminText color={colors.onSurfaceVariant} style={{typography:'bodyMedium'}}>{subtitle}</AdminText></Column><Switch value={value} onCheckedChange={onChange} enabled={!disabled}/></Row></Surface></BaseHost></View>;}
