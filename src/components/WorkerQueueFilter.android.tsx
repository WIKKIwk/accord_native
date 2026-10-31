import { Column, Row, Spacer, Text } from '@expo/ui';
import { DropdownMenu, DropdownMenuItem, OutlinedButton, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { QUEUE_LIMITS, type QueueLimit } from '../workerQueueLimit';

type Props = { value: QueueLimit; enabled: boolean; loading?: boolean; backgroundColor: string; onChange: (limit: QueueLimit) => void };
const label = (count: QueueLimit) => count === 0 ? 'Barchasi' : `${count} ta`;

export function WorkerQueueFilter({ value, enabled, loading, backgroundColor, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  return <Column style={{ paddingHorizontal: 8 }}><Row alignment="center" spacing={8} style={{ width: '100%', backgroundColor, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 }}>
    <Text>{loading ? 'Yangilanmoqda…' : 'Ko‘rsatish'}</Text>
    <Spacer flexible />
    <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
      <DropdownMenu.Trigger><OutlinedButton enabled={enabled} onClick={() => setExpanded(true)}><ComposeText>{`${label(value)} ▾`}</ComposeText></OutlinedButton></DropdownMenu.Trigger>
      <DropdownMenu.Items>{QUEUE_LIMITS.map(count => <DropdownMenuItem key={count} onClick={() => { setExpanded(false); onChange(count); }}>
        <DropdownMenuItem.Text><ComposeText>{label(count)}</ComposeText></DropdownMenuItem.Text>
      </DropdownMenuItem>)}</DropdownMenu.Items>
    </DropdownMenu>
  </Row></Column>;
}
