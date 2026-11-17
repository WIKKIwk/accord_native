import { Column as UniversalColumn, Host as UniversalHost, ListItem, RNHostView as UniversalRNHostView } from '@expo/ui';
import { Box, Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, combinedClickable, fillMaxWidth, padding, paddingAll, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { QolipOrderMoldRow as Mold, QolipOrderStageRow as Stage } from './useQolipSequenceOrderDetail';
/** @v2 _ScannedItemsExpansionHeader / _AttachedQolipTile / _SequenceStepTile */
export function QolipOrderSection({ title, subtitle, count, expanded, enabled, onPress, children }: { title: string; subtitle?: string; count?: string; expanded: boolean; enabled: boolean; onPress(): void; children?: ReactNode }) {
  const colors = useMaterialColors();
  return <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surfaceContainerLow }}>
    <UniversalHost matchContents={{ vertical: true }} style={{ width: '100%' }}><UniversalColumn><ListItem onPress={enabled ? onPress : undefined} supportingText={subtitle}
      trailing={<UniversalRNHostView matchContents><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{!!count && <Host matchContents><Text style={{ typography: 'labelLarge' }}>{count}</Text></Host>}
        {enabled && <SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more' }} size={22} tintColor={colors.onSurfaceVariant} />}</View></UniversalRNHostView>}>{title}</ListItem></UniversalColumn></UniversalHost>
    {expanded && <View style={{ padding: 12, gap: 8 }}>{children}</View>}
  </View>;
}
export function QolipOrderMoldRow({ row, onLongPress }: { row: Mold; onLongPress(): void }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }}><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), clip({ type: 'roundedCorner', radius: 12 }), background(colors.surfaceContainerHighest), combinedClickable({ onLongClick: onLongPress }), padding(12, 10, 12, 10)]}>
    <Box contentAlignment="center" modifiers={[size(36, 36), clip({ type: 'roundedCorner', radius: 12 }), background(colors.surface)]}><RNHostView matchContents><SymbolView name={{ android: 'qr_code_2' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></Box>
    <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 3 }}><Text style={{ typography: 'bodyMedium', fontWeight: '800' }} maxLines={2}>{row.title}</Text>
      <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">{row.color && <Box modifiers={[size(12, 12), clip({ type: 'roundedCorner', radius: 6 }), background(row.color)]} />}<Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', fontWeight: '600' }} modifiers={[weight(1)]}>{row.subtitle}</Text></Row>
      {!!row.rework && <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center"><RNHostView matchContents><SymbolView name={{ android: 'build' }} size={16} tintColor={colors.error} /></RNHostView><Text color={colors.error} style={{ typography: 'bodySmall', fontWeight: '700' }}>{row.rework}</Text></Row>}
    </Column>
  </Row></Host>;
}
const iconFor = (row: Stage) => row.done ? 'check' : row.type === 'start' ? 'play_circle' : row.type === 'end' ? 'flag_circle' : row.type === 'apparatus'
  ? row.operation === 'laminate' || row.operation === 'glue' ? 'layers' : row.operation === 'cut' ? 'content_cut' : 'print' : 'account_tree';
export function QolipOrderStageRow({ row, onPress }: { row: Stage; onPress(): void }) {
  const colors = useMaterialColors(), color = row.done ? '#2E7D32' : colors.onSurfaceVariant;
  return <Host matchContents={{ vertical: true }}><Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="top" modifiers={[fillMaxWidth(), ...(row.enabled ? [combinedClickable({ onClick: onPress })] : []), padding(12, 6, 12, 6)]}>
    <Column horizontalAlignment="center"><Box contentAlignment="center" modifiers={[size(36, 36), clip({ type: 'roundedCorner', radius: 18 }), background(row.done ? '#2E7D321F' : colors.surfaceContainerHigh)]}>
      <RNHostView matchContents><SymbolView name={{ android: iconFor(row) }} tintColor={color} size={22} /></RNHostView></Box>
      {!row.last && <Box modifiers={[size(2.5, 30), background(row.done ? '#2E7D32' : colors.outlineVariant)]} />}
    </Column>
    <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 3 }}><Text color={row.done ? colors.onSurfaceVariant : colors.onSurface} style={{ typography: 'titleSmall', fontWeight: '800' }}>{row.title}</Text>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', fontWeight: '600' }}>{row.kind}</Text>
      {!!row.status && <Box modifiers={[clip({ type: 'roundedCorner', radius: 8 }), background(`${row.statusColor}1F`), paddingAll(5)]}><Text color={row.statusColor} style={{ typography: 'labelSmall', fontWeight: '600' }}>{row.status}</Text></Box>}
      {!!row.produced && <Text style={{ typography: 'bodySmall' }}>{row.produced}</Text>}{!!row.input && <Text style={{ typography: 'bodySmall' }}>{row.input}</Text>}
    </Column>
  </Row></Host>;
}
