import { Box, Column, Icon, Row, Text } from '@expo/ui/jetpack-compose';
import { background, clip, combinedClickable, fillMaxWidth, paddingAll, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { assignedMaterialPresentation, rawMaterialBalances, type WorkerMaterialListProps } from '../workerMaterialPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';
import { BaseHost } from './BaseHost';
import { useBaseTheme } from './useBaseTheme';
export function WorkerMaterialList({ rows, scanned, orderId, onLongPress, showBalances = true }: WorkerMaterialListProps) {
  const { locale, t, p } = useWorkerOrderText();
  const { colors } = useBaseTheme();
  const secondaryText = colors.onSurfaceVariant ?? colors.onSurface;
  const amount = (value: number, unit: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const balances = showBalances ? rawMaterialBalances(rows) : [];
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
    {!!balances.length && <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth(), clip({ type: 'roundedCorner', radius: 12 }), background(colors.secondaryContainer), paddingAll(12)]}>
      <Text color={colors.onSecondaryContainer} style={{ typography: 'titleSmall', fontWeight: '600' }}>{p('worker.material.balance')}</Text>
      {balances.map(balance => <Text key={balance.uom} color={colors.onSecondaryContainer} style={{ typography: 'bodySmall', fontWeight: '500' }}>{p('worker.material.balance.summary', { received: amount(balance.received, balance.uom), used: amount(balance.consumed, balance.uom), remaining: amount(balance.remaining, balance.uom) })}</Text>)}
    </Column>}
    {rows.map((row, index) => { const item = assignedMaterialPresentation(row, scanned, t, orderId); return <Row key={`${row.barcode}:${index}`} verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth(), clip({ type: 'roundedCorner', radius: 12 }), background(item.confirmed ? colors.primaryContainer : colors.surfaceContainerHighest),
        combinedClickable({ onLongClick: () => onLongPress(row) }), paddingAll(12)]}>
        <Box contentAlignment="center" modifiers={[size(36, 36), clip({ type: 'roundedCorner', radius: 12 }), background(item.confirmed ? colors.surfaceContainerHigh : colors.surface)]}>
          <Icon source={item.confirmed ? require('../../assets/icons/gscale/check_circle.xml') : require('../../assets/icons/worker/material.xml')} size={20}
            tint={item.confirmed ? colors.onPrimaryContainer : secondaryText} />
        </Box>
        <Text color={item.confirmed ? colors.onPrimaryContainer : secondaryText} style={{ typography: 'bodySmall' }} maxLines={2} overflow="ellipsis" modifiers={[weight(1)]}>
          <Text color={item.confirmed ? colors.onPrimaryContainer : colors.onSurface} style={{ fontSize: 14, fontWeight: '700' }}>{item.title}</Text>
          {item.subtitle ? `${item.title ? ' • ' : ''}${item.subtitle}` : ''}
        </Text>
      </Row>; })}
  </Column></BaseHost>;
}
