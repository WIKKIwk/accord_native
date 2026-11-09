import type { AdminApparatus } from '../apparatusApi';
import type { paddonSnapshotFromJson } from '../paddonModels';
import { rezkaPaddonBobinaGroups, rezkaPaddonBobinaLabel } from './rezkaPaddonBobina';
import { rezkaPaddonApparatusOrLocation } from './rezkaPaddonDisplay';

type Snapshot = ReturnType<typeof paddonSnapshotFromJson>;
type Text = (key: string) => string;

/** V2 PaddonWeightTotals: unknown/invalid is a dash; otherwise up to six decimals and kg. */
export function rezkaPaddonWeightText(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const quantity = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `${quantity} kg`;
}

/** Read-only projection of V2's Paddon detail header; it contains no action handlers. */
export function rezkaPaddonDetailHeader(snapshot: Snapshot, catalog: readonly AdminApparatus[], t: Text,
  unspecified: string, countText: (count: number) => string) {
  // progressBatchFromJson supplies this field, although its shared return type is a generic object.
  const paddon = snapshot.paddon, groups = rezkaPaddonBobinaGroups(snapshot.items.map(item => ({ bobina_kg: item.bobina_kg })));
  return { code: paddon.code, peremotka: paddon.contains_peremotka ? t('worker.rezka.print.peremotka') : '',
    location: paddon.location.trim() ? rezkaPaddonApparatusOrLocation(paddon.location, catalog, unspecified) : '',
    creatorLabel: t('worker.paddon.created_by'), creator: paddon.created_by_display_name.trim() || unspecified,
    gross: `${t('worker.paddon.total_gross')}: ${rezkaPaddonWeightText(paddon.total_gross_kg)}`,
    net: `${t('worker.paddon.total_net')}: ${rezkaPaddonWeightText(paddon.total_net_kg)}`,
    locked: paddon.locked_at_unix == null ? '' : t('worker.paddon.locked'), wip: `WIP: ${snapshot.items.length}`,
    bobinaTitle: groups.length ? t('worker.paddon.bobina_summary') : '',
    bobina: groups.map(group => ({ ...group, label: group.units ? rezkaPaddonBobinaLabel(group.units) : t('worker.paddon.bobina_unknown'),
      countText: countText(group.count) })),
    note: paddon.note.trim() ? paddon.note : '' };
}
