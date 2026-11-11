import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { background, contentShape, font, foregroundStyle, frame, lineLimit, onLongPressGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { assignedMaterialPresentation, rawMaterialBalances, type WorkerMaterialListProps } from '../workerMaterialPresentation';
import { BaseHost } from './BaseHost';
import { useBaseTheme } from './useBaseTheme';
import { useWorkerOrderText } from './useWorkerOrderText';
export function WorkerMaterialList({ rows, scanned, orderId, onLongPress, showBalances = true }: WorkerMaterialListProps) {
  const { locale, t, p } = useWorkerOrderText();
  const { colors } = useBaseTheme();
  const secondaryText = colors.onSurfaceVariant ?? colors.onSurface;
  const amount = (value: number, unit: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const balances = showBalances ? rawMaterialBalances(rows) : [];
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    {!!balances.length && <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' }),
      background(colors.secondaryContainer, shapes.roundedRectangle({ cornerRadius: 12 }))]}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), foregroundStyle(colors.onSecondaryContainer)]}>{p('worker.material.balance')}</Text>
      {balances.map(balance => <Text key={balance.uom} modifiers={[font({ textStyle: 'caption', weight: 'medium' }), foregroundStyle(colors.onSecondaryContainer)]}>{p('worker.material.balance.summary', { received: amount(balance.received, balance.uom), used: amount(balance.consumed, balance.uom), remaining: amount(balance.remaining, balance.uom) })}</Text>)}
    </VStack>}
    {rows.map((row, index) => { const item = assignedMaterialPresentation(row, scanned, t, orderId); return <HStack key={`${row.barcode}:${index}`} alignment="top" spacing={12}
      modifiers={[padding({ all: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(item.confirmed ? colors.primaryContainer : colors.surfaceContainerHighest, shapes.roundedRectangle({ cornerRadius: 12 })),
        contentShape(shapes.rectangle()), onLongPressGesture(() => onLongPress(row), 0.5)]}>
        <Image systemName={item.confirmed ? 'checkmark' : 'shippingbox'} size={20} modifiers={[
          foregroundStyle(item.confirmed ? colors.onPrimaryContainer : secondaryText), frame({ width: 36, height: 36 }),
          background(item.confirmed ? colors.surfaceContainerHigh : colors.surface, shapes.roundedRectangle({ cornerRadius: 12 }))]} />
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(item.confirmed ? colors.onPrimaryContainer : secondaryText),
          frame({ maxWidth: Infinity, alignment: 'leading' }), lineLimit(2)]}>
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), foregroundStyle(item.confirmed ? colors.onPrimaryContainer : colors.onSurface)]}>{item.title}</Text>
          {item.subtitle ? `${item.title ? ' • ' : ''}${item.subtitle}` : ''}
        </Text>
      </HStack>; })}
  </VStack></BaseHost>;
}
