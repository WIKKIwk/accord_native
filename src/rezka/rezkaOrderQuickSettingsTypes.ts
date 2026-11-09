import type { RezkaOrderEntry, RezkaOrderMap } from './rezkaOrderEligibility';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

export type RezkaQuickOrder = RezkaOrderMap & { duplicate_rezka_labels: boolean | null; include_bobina_in_net: boolean | null;
  standard_print_side: boolean | null };
export type RezkaOrderQuickSettingsProps = { snapshot: RezkaSessionSnapshot; map: RezkaQuickOrder; entry: RezkaOrderEntry;
  onSaved: () => void };
