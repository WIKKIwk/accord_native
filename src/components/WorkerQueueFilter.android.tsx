import { QUEUE_LIMITS, type QueueLimit } from '../workerQueueLimit';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import type { WorkerQueueFilterProps } from './workerQueueFilterProps';

const label = (count: QueueLimit, labels?: WorkerQueueFilterProps['labels']) => count === 0 ? labels?.all ?? 'Barchasi' : labels?.counts[count] ?? `${count} ta`;

export function WorkerQueueFilter({ value, enabled, labels, backgroundColor, onChange }: WorkerQueueFilterProps) {
  return <DropdownFilter label={labels?.title ?? 'Ko‘rsatish'} selectedLabel={label(value, labels)} enabled={enabled}
    backgroundColor={backgroundColor} options={QUEUE_LIMITS.map(count => ({ value: count, label: label(count, labels) }))} onChange={onChange} />;
}
