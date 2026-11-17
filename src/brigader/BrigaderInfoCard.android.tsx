import { Column,Row,Spacer,Surface } from '@expo/ui/jetpack-compose';
import { combinedClickable,fillMaxWidth,height,padding,weight,width } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from '../admin/AdminTypography.android';
import { workerDetailSegmentShape,workerDetailShape } from '../admin/AdminWorkerDetailNative.android';
import type { BrigaderInfoCardModel } from './brigaderWipModel';
export function BrigaderInfoCard({ model,index = 0,count = 1,onPress,onLongPress }: { model:BrigaderInfoCardModel;index?:number;count?:number;onPress?:()=>void;onLongPress?:()=>void }) {
  const { colors } = useBaseTheme();
  return <View style={{ paddingHorizontal:4,paddingBottom:2 }}><BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><Surface color={colors.surfaceContainerLowest} shape={workerDetailSegmentShape(index,count)} onClick={onLongPress ? undefined : onPress} modifiers={[fillMaxWidth(),...(onLongPress ? [combinedClickable({ onClick:onPress,onLongClick:onLongPress })] : [])]}><Column modifiers={[fillMaxWidth(),padding(14,13,14,14)]}>
    <Row verticalAlignment="top" modifiers={[fillMaxWidth()]}><Column modifiers={[weight(1)]}><Text maxLines={2} style={{ typography:'titleMedium',fontWeight:'700' }}>{model.title}</Text>{model.subtitle ? <Text style={{ typography:'bodySmall' }} color={colors.onSurfaceVariant}>{model.subtitle}</Text> : null}</Column>{model.badge ? <Surface color={colors.tertiaryContainer} shape={workerDetailShape(999)}><Text style={{ typography:'labelSmall',fontWeight:'700' }} color={colors.onTertiaryContainer} modifiers={[padding(10,5,10,5)]}>{model.badge}</Text></Surface> : null}</Row><Spacer modifiers={[height(12)]} />
    {model.lines.map((line,index) => <Row key={index} verticalAlignment="top" modifiers={[fillMaxWidth(),padding(0,6,0,0)]}><Text color={colors.onSurfaceVariant} style={{ typography:'bodySmall' }} modifiers={[width(121)]}>{line.label}</Text><Text style={{ typography:'bodySmall',fontWeight:'600' }} modifiers={[weight(1)]}>{line.value}</Text></Row>)}
    {model.summary ? <Text style={{ typography:'bodySmall',lineHeight:16.2 }} color={colors.onSurfaceVariant} modifiers={[padding(0,8,0,0)]}>{model.summary}</Text> : null}{model.footer ? <Text style={{ typography:'labelSmall' }} color={colors.onSurfaceVariant} maxLines={1} modifiers={[padding(0,10,0,0)]}>{model.footer}</Text> : null}
  </Column></Surface></BaseHost></View>;
}
