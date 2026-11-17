import { Box, CircularProgressIndicator, Column, Icon, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { background, clip, combinedClickable, fillMaxWidth, paddingAll, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { assignedMaterialPresentation, assignedMaterialStatus, rawMaterialBalances, type WorkerMaterialListProps } from '../workerMaterialPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';
import { BaseHost } from './BaseHost';
export function WorkerMaterialList({ rows, scanned, orderId, onLongPress, showBalances = true, onUnlink, canUnlink, unlinkingBarcode }: WorkerMaterialListProps) {
  const { locale, t, p } = useWorkerOrderText();
  const colors = useMaterialColors({});
  const secondaryText = colors.onSurfaceVariant ?? colors.onSurface;
  const amount = (value: number, unit: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const balances = showBalances ? rawMaterialBalances(rows) : [];
  return <BaseHost dynamicColors matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
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
        {onUnlink ? <Column modifiers={[weight(1)]}>
        <Text color={item.confirmed ? colors.onPrimaryContainer : secondaryText} style={{ typography: 'bodySmall' }} maxLines={2} overflow="ellipsis" modifiers={[]}>
          <Text color={item.confirmed ? colors.onPrimaryContainer : colors.onSurface} style={{ fontSize: 14, fontWeight: '700' }}>{item.title}</Text>
          {item.subtitle ? `${item.title ? ' • ' : ''}${item.subtitle}` : ''}
        </Text>
          {!!assignedMaterialStatus(row, p) && <Text color={secondaryText} style={{ typography: 'labelSmall', fontWeight: '700' }}>{assignedMaterialStatus(row, p)}</Text>}
        </Column> : <Text color={item.confirmed ? colors.onPrimaryContainer : secondaryText} style={{ typography: 'bodySmall' }} maxLines={2} overflow="ellipsis" modifiers={[weight(1)]}>
          <Text color={item.confirmed ? colors.onPrimaryContainer : colors.onSurface} style={{ fontSize: 14, fontWeight: '700' }}>{item.title}</Text>
          {item.subtitle ? `${item.title ? ' • ' : ''}${item.subtitle}` : ''}
        </Text>}
        {onUnlink && <IconButton enabled={!unlinkingBarcode && (canUnlink?.(row) ?? false)} onClick={() => onUnlink(row)}>
          {unlinkingBarcode === row.barcode?.trim().toUpperCase() ? <CircularProgressIndicator modifiers={[size(18, 18)]} />
            : <RNHostView matchContents><SymbolView name={{ android: 'link_off' }} size={20} tintColor={secondaryText} accessibilityLabel={p('worker.material.unlink')} /></RNHostView>}
        </IconButton>}
      </Row>; })}
  </Column></BaseHost>;
}
