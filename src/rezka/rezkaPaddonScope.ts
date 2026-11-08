import type { AdminApparatus } from '../apparatusApi';
import type { paddonFromJson } from '../paddonModels';

type Paddon = ReturnType<typeof paddonFromJson>;

/** @v2 assignedPaddonApparatus */
export function assignedPaddonApparatus(catalog: readonly AdminApparatus[], assigned: readonly string[]): AdminApparatus[] {
  const ids = new Set(assigned.map(id => id.trim()));
  // canonicalApparatusGroups first drops inactive machines, groups by normalized
  // operation, and orders the cut group by catalog order then lowercase name.
  return catalog.filter(row => row.lifecycle_state === 'active' && row.operation.trim().toLowerCase() === 'cut' && ids.has(row.id))
    .sort((left, right) => left.sort_order - right.sort_order ||
      (left.name.toLowerCase() < right.name.toLowerCase() ? -1 : left.name.toLowerCase() > right.name.toLowerCase() ? 1 : 0));
}

/**
 * V2's operator Paddon screen resolves a blank route to its sole assigned
 * cutting machine; with multiple or no matches it asks the user to choose.
 * This only models display state. It does not authorize a supplied route ID.
 */
export function resolveRezkaPaddonScope(options: readonly AdminApparatus[], routeId = '', routeName = '') {
  let apparatusId = routeId.trim(), apparatusName = routeName.trim();
  if (!apparatusId && options.length === 1) {
    apparatusId = options[0].id;
    apparatusName = options[0].name;
  } else if (!apparatusName) {
    for (const row of options) if (row.id === apparatusId) apparatusName = row.name;
  }
  return { apparatusId, apparatusName, needsApparatus: !apparatusId };
}

/** V2 filters a scoped response again and totals the displayed rows, in server order. */
export function rezkaPaddonList(rows: readonly Paddon[], apparatusId: string) {
  const paddons = apparatusId ? rows.filter(row => row.apparatus_id === apparatusId) : [...rows];
  return { paddons, paddonCount: paddons.length, wipCount: paddons.reduce((sum, row) => sum + row.item_count, 0) };
}
