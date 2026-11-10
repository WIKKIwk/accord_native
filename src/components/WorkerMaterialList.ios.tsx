import { Divider, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { contentShape, font, foregroundStyle, frame, onLongPressGesture, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { assignedMaterialPresentation, rawMaterialBalances, type WorkerMaterialListProps } from '../workerMaterialPresentation';
import { BaseHost } from './BaseHost';
import { useWorkerOrderText } from './useWorkerOrderText';
export function WorkerMaterialList({ rows, scanned, onLongPress, showBalances = true }: WorkerMaterialListProps) {
  const { locale, t, p } = useWorkerOrderText();
  const amount = (value: number, unit: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const balances = showBalances ? rawMaterialBalances(rows) : [];
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    {!!balances.length && <VStack alignment="leading" spacing={5} modifiers={[padding({ vertical: 10 })]}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{p('worker.material.balance')}</Text>
      {balances.map(balance => <Text key={balance.uom} modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{p('worker.material.balance.summary', { received: amount(balance.received, balance.uom), used: amount(balance.consumed, balance.uom), remaining: amount(balance.remaining, balance.uom) })}</Text>)}
    </VStack>}
    {rows.map((row, index) => { const item = assignedMaterialPresentation(row, scanned, t); return <VStack key={`${row.barcode}:${index}`} alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      {index > 0 && <Divider />}
      <HStack spacing={10} modifiers={[padding({ vertical: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()), onLongPressGesture(() => onLongPress(row), 0.5)]}>
        <Image systemName={item.scanned ? 'checkmark.circle.fill' : 'shippingbox'} size={24} />
        <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{item.title}</Text>
          {item.details.map((line, i) => <Text key={i} modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{line}</Text>)}
        </VStack>
      </HStack>
    </VStack>; })}
  </VStack></BaseHost>;
}
