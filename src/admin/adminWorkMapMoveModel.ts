import type { AdminApparatus } from '../apparatusApi';

/** V2 prefers print apparatus, retains existing choices, then uses the first distinct fallback. */
export function adminWorkMapMoveDefaults(source: readonly AdminApparatus[], currentTop: AdminApparatus | null = null,
  currentBottom: AdminApparatus | null = null): { top: AdminApparatus | null; bottom: AdminApparatus | null } {
  const print = source.filter(item => item.operation === 'print'), candidates = print.length ? print : source;
  if (!candidates.length) return { top: null, bottom: null };
  return { top: currentTop ?? candidates[0], bottom: currentBottom ?? (candidates.length > 1 ? candidates[1]
    : source.find(item => item.id !== candidates[0].id) ?? null) };
}
