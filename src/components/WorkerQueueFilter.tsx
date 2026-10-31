import { Column, Picker, Row, Spacer, Text } from '@expo/ui';
import { QUEUE_LIMITS, isQueueLimit, type QueueLimit } from '../workerQueueLimit';

type Props = { value: QueueLimit; enabled: boolean; loading?: boolean; backgroundColor: string; onChange: (limit: QueueLimit) => void };

export function WorkerQueueFilter({ value, enabled, loading, backgroundColor, onChange }: Props) {
  return <Column style={{ paddingHorizontal: 8 }}><Row alignment="center" spacing={8} style={{ width: '100%', backgroundColor, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 }}>
    <Text>{loading ? 'Yangilanmoqda…' : 'Ko‘rsatish'}</Text>
    <Spacer flexible />
    <Picker selectedValue={value} enabled={enabled} onValueChange={next => { if (isQueueLimit(next)) onChange(next); }}>
      {QUEUE_LIMITS.map(count => <Picker.Item key={count} value={count} label={count === 0 ? 'Barchasi' : `${count} ta`} />)}
    </Picker>
  </Row></Column>;
}
