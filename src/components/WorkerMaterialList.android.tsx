import { Column, Host, HorizontalDivider, Icon, Row, Text } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { assignedMaterialPresentation, rawMaterialBalances, type WorkerMaterialListProps } from '../workerMaterialPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';
export function WorkerMaterialList({ rows, scanned, onLongPress, showBalances = true }: WorkerMaterialListProps) {
  const { locale, t, p } = useWorkerOrderText();
  const amount = (value: number, unit: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)} ${unit}`;
  const balances = showBalances ? rawMaterialBalances(rows) : [];
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]}>
    {!!balances.length && <Column verticalArrangement={{ spacedBy: 5 }} modifiers={[padding(0, 10, 0, 10)]}>
      <Text>{p('worker.material.balance')}</Text>
      {balances.map(balance => <Text key={balance.uom}>{p('worker.material.balance.summary', { received: amount(balance.received, balance.uom), used: amount(balance.consumed, balance.uom), remaining: amount(balance.remaining, balance.uom) })}</Text>)}
    </Column>}
    {rows.map((row, index) => { const item = assignedMaterialPresentation(row, scanned, t); return <Column key={`${row.barcode}:${index}`} modifiers={[fillMaxWidth()]}>
      {index > 0 && <HorizontalDivider />}
      <Row horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 12, 0, 12), combinedClickable({ onLongClick: () => onLongPress(row) })]}>
        <Icon source={item.scanned ? require('../../assets/icons/gscale/check_circle.xml') : require('../../assets/icons/navigation/outlined/home.xml')} size={24} />
        <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}><Text>{item.title}</Text>{item.details.map((line, i) => <Text key={i}>{line}</Text>)}</Column>
      </Row>
    </Column>; })}
  </Column></Host>;
}
