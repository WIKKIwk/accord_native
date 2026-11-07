import { QUEUE_LIMITS, type QueueLimit } from '../workerQueueLimit';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import type { WorkerQueueFilterProps } from './workerQueueFilterProps';

const label = (count: QueueLimit) => count === 0 ? 'Barchasi' : `${count} ta`;

export function WorkerQueueFilter({ value, enabled, loading, backgroundColor, onChange }: WorkerQueueFilterProps) {
  return <DropdownFilter label={loading ? 'Yangilanmoqda…' : 'Ko‘rsatish'} selectedLabel={label(value)} enabled={enabled}
    backgroundColor={backgroundColor} options={QUEUE_LIMITS.map(count => ({ value: count, label: label(count) }))} onChange={onChange} />;
}
