import type { paddonSnapshotFromJson } from '../paddonModels';

type Snapshot = ReturnType<typeof paddonSnapshotFromJson>;
export function rezkaPaddonWipSection(data: Snapshot, t: (key: string) => string, countText: (count: number) => string) {
  return { title: t('worker.paddon.assigned.title'), count: countText(data.items.length),
    hint: data.free_movement_enabled && data.can_manage_items ? t('paddon.management.free_movement.hint') : '',
    empty: data.items.length ? '' : t('worker.paddon.assigned.empty'), items: data.items };
}
